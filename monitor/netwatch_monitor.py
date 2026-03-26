#!/usr/bin/env python3
"""
NetWatch Monitor — Cross-Platform Network Traffic Monitor (Windows + Linux)
Captures real IPv4/IPv6 network traffic data using psutil and pushes it
to the NetWatch dashboard via REST API.

Linux enhancements:
  - Reads /proc/net/snmp6 and /proc/net/netstat for real per-protocol
    byte counters instead of estimating from connection ratios.
  - Filters loopback correctly on both platforms (lo vs Loopback).
  - Detects the primary interface via routing table on Linux.

Run with: python netwatch_monitor.py [--api-url http://localhost:5000]
Requires: pip install psutil requests
"""

import argparse
import json
import logging
import os
import platform
import re
import signal
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import psutil
except ImportError:
    print("ERROR: psutil is required. Install with: pip install psutil")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("ERROR: requests is required. Install with: pip install requests")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEFAULT_API_URL = "http://localhost:5000"
POLL_INTERVAL = 2        # seconds between bandwidth captures
CONN_POLL_INTERVAL = 5   # seconds between connection scans
ALERT_COOLDOWN = 60      # seconds between duplicate alerts

IS_LINUX = platform.system() == "Linux"
IS_WINDOWS = platform.system() == "Windows"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("netwatch")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def format_bytes(b: float) -> str:
    if b < 1024:
        return f"{b:.0f} B"
    if b < 1048576:
        return f"{b / 1024:.1f} KB"
    if b < 1073741824:
        return f"{b / 1048576:.1f} MB"
    return f"{b / 1073741824:.2f} GB"


def is_loopback(name: str) -> bool:
    """Return True if the interface name looks like a loopback adapter."""
    lo_names = {"lo", "lo0"}
    if name.lower() in lo_names:
        return True
    # Windows names
    if "loopback" in name.lower():
        return True
    return False


def is_virtual(name: str) -> bool:
    """Return True for virtual/container interfaces we want to skip."""
    skip_prefixes = ("veth", "br-", "docker", "virbr", "vbox", "vmnet")
    return name.lower().startswith(skip_prefixes)


# ---------------------------------------------------------------------------
# Interface detection
# ---------------------------------------------------------------------------

def get_default_interface_linux() -> Optional[str]:
    """Read the default route to find the primary NIC on Linux."""
    try:
        route_file = Path("/proc/net/route")
        if route_file.exists():
            for line in route_file.read_text().splitlines()[1:]:
                fields = line.split()
                if len(fields) >= 2 and fields[1] == "00000000":
                    return fields[0]
    except Exception:
        pass

    # Fallback: ip route
    try:
        out = subprocess.check_output(
            ["ip", "route", "show", "default"],
            text=True, timeout=5,
        )
        # default via 192.168.1.1 dev eth0 ...
        m = re.search(r"dev\s+(\S+)", out)
        if m:
            return m.group(1)
    except Exception:
        pass
    return None


def get_primary_interface() -> str:
    """Find the primary network interface (cross-platform)."""
    if IS_LINUX:
        iface = get_default_interface_linux()
        if iface:
            log.info(f"Detected default interface from route table: {iface}")
            return iface

    # Fallback: pick the NIC with the most traffic
    counters = psutil.net_io_counters(pernic=True)
    best_name = "eth0" if IS_LINUX else "Ethernet"
    best_total = 0
    for name, stats in counters.items():
        if is_loopback(name) or is_virtual(name):
            continue
        total = stats.bytes_sent + stats.bytes_recv
        if total > best_total:
            best_name = name
            best_total = total
    return best_name


# ---------------------------------------------------------------------------
# Linux: real IPv4 / IPv6 byte counters from /proc
# ---------------------------------------------------------------------------

class ProcNetCounters:
    """
    On Linux, read real per-protocol byte counters from the kernel.
      IPv4 bytes: /proc/net/netstat  → IpExt InOctets / OutOctets
      IPv6 bytes: /proc/net/snmp6    → Ip6InOctets / Ip6OutOctets
    This is far more accurate than estimating from connection ratios.
    """

    @staticmethod
    def available() -> bool:
        return IS_LINUX and Path("/proc/net/snmp6").exists()

    @staticmethod
    def read_ipv6() -> Tuple[int, int]:
        """Return (bytes_in, bytes_out) for IPv6."""
        in_oct = 0
        out_oct = 0
        try:
            for line in Path("/proc/net/snmp6").read_text().splitlines():
                parts = line.split()
                if len(parts) == 2:
                    if parts[0] == "Ip6InOctets":
                        in_oct = int(parts[1])
                    elif parts[0] == "Ip6OutOctets":
                        out_oct = int(parts[1])
        except Exception as e:
            log.debug(f"Failed to read /proc/net/snmp6: {e}")
        return in_oct, out_oct

    @staticmethod
    def read_ipv4() -> Tuple[int, int]:
        """Return (bytes_in, bytes_out) for IPv4 from /proc/net/netstat."""
        in_oct = 0
        out_oct = 0
        try:
            lines = Path("/proc/net/netstat").read_text().splitlines()
            # IpExt header line followed by values line
            for i, line in enumerate(lines):
                if line.startswith("IpExt:") and i + 1 < len(lines):
                    headers = line.split()
                    values = lines[i + 1].split()
                    if len(headers) == len(values):
                        mapping = dict(zip(headers, values))
                        in_oct = int(mapping.get("InOctets", 0))
                        out_oct = int(mapping.get("OutOctets", 0))
                    break
        except Exception as e:
            log.debug(f"Failed to read /proc/net/netstat: {e}")
        return in_oct, out_oct


# ---------------------------------------------------------------------------
# Traffic tracking
# ---------------------------------------------------------------------------

class TrafficTracker:
    """Tracks network I/O deltas between polling intervals."""

    def __init__(self):
        self.prev_counters: Optional[Dict] = None
        self.prev_time: Optional[float] = None
        # Linux proc counters
        self.use_proc = ProcNetCounters.available()
        self.prev_v4: Optional[Tuple[int, int]] = None
        self.prev_v6: Optional[Tuple[int, int]] = None

        if self.use_proc:
            log.info("Using /proc/net kernel counters for real IPv4/IPv6 split")
            self.prev_v4 = ProcNetCounters.read_ipv4()
            self.prev_v6 = ProcNetCounters.read_ipv6()
        else:
            log.info("Using connection-ratio estimation for IPv4/IPv6 split")

    def poll(self) -> Optional[Dict]:
        """
        Returns per-interface traffic data.
        On Linux with /proc access, also provides real v4/v6 split ratios.
        """
        now = time.time()
        counters = psutil.net_io_counters(pernic=True)

        if self.prev_counters is None:
            self.prev_counters = counters
            self.prev_time = now
            return None

        dt = now - self.prev_time
        if dt < 0.5:
            return None

        # Read Linux proc counters for real v4/v6 split
        v4_ratio, v6_ratio = self._get_split(dt)

        results = {}
        for iface, curr in counters.items():
            if is_loopback(iface) or is_virtual(iface):
                continue
            prev = self.prev_counters.get(iface)
            if prev is None:
                continue

            bytes_in = max(0, curr.bytes_recv - prev.bytes_recv)
            bytes_out = max(0, curr.bytes_sent - prev.bytes_sent)
            rate_in = bytes_in / dt
            rate_out = bytes_out / dt

            results[iface] = {
                "bytes_in": bytes_in,
                "bytes_out": bytes_out,
                "rate_in": rate_in,
                "rate_out": rate_out,
                "v4_ratio": v4_ratio,
                "v6_ratio": v6_ratio,
            }

        self.prev_counters = counters
        self.prev_time = now
        return results

    def _get_split(self, dt: float) -> Tuple[float, float]:
        """Get the IPv4/IPv6 traffic ratio."""
        if self.use_proc:
            return self._proc_split(dt)
        return _connection_ratio()

    def _proc_split(self, dt: float) -> Tuple[float, float]:
        """Calculate real v4/v6 ratio from kernel byte counters."""
        v4_now = ProcNetCounters.read_ipv4()
        v6_now = ProcNetCounters.read_ipv6()

        if self.prev_v4 is None or self.prev_v6 is None:
            self.prev_v4 = v4_now
            self.prev_v6 = v6_now
            return (0.7, 0.3)

        v4_bytes = max(0, (v4_now[0] - self.prev_v4[0]) + (v4_now[1] - self.prev_v4[1]))
        v6_bytes = max(0, (v6_now[0] - self.prev_v6[0]) + (v6_now[1] - self.prev_v6[1]))

        self.prev_v4 = v4_now
        self.prev_v6 = v6_now

        total = v4_bytes + v6_bytes
        if total == 0:
            return (0.7, 0.3)
        return (v4_bytes / total, v6_bytes / total)


def _connection_ratio() -> Tuple[float, float]:
    """
    Estimate IPv4 vs IPv6 traffic ratio based on active connections.
    Fallback method when /proc counters are not available (Windows, macOS).
    """
    try:
        conns = psutil.net_connections(kind="inet")
        v4 = sum(1 for c in conns if c.family.name == "AF_INET")
        v6 = sum(1 for c in conns if c.family.name == "AF_INET6")
        total = v4 + v6
        if total == 0:
            return (0.7, 0.3)
        return (v4 / total, v6 / total)
    except (psutil.AccessDenied, PermissionError):
        return (0.7, 0.3)


# ---------------------------------------------------------------------------
# Connection scanner
# ---------------------------------------------------------------------------

# IPs that should never be reported as connections
_SKIP_IPS = {
    "127.0.0.1", "::1", "0.0.0.0", "::", "",
}

def _is_loopback_or_local(ip: str) -> bool:
    """Return True for loopback, private, and link-local IPs."""
    if ip in _SKIP_IPS:
        return True
    if ip.startswith("127."):
        return True
    # IPv6 loopback variants
    if ip.startswith("::ffff:127."):
        return True
    return False


def scan_connections() -> List[dict]:
    """Scan active network connections (cross-platform)."""
    result = []
    try:
        conns = psutil.net_connections(kind="inet")
        for c in conns:
            if not c.raddr:
                continue

            # Skip loopback connections (e.g. localhost → localhost)
            remote_ip = c.raddr.ip if c.raddr else ""
            if _is_loopback_or_local(remote_ip):
                continue

            family = "ipv4" if c.family.name == "AF_INET" else "ipv6"
            proto = "tcp" if c.type.name == "SOCK_STREAM" else "udp"

            # Get process name
            process_name = None
            if c.pid:
                try:
                    proc = psutil.Process(c.pid)
                    process_name = proc.name()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

            result.append({
                "timestamp": int(time.time() * 1000),
                "protocol": proto,
                "family": family,
                "localAddr": c.laddr.ip if c.laddr else "",
                "localPort": c.laddr.port if c.laddr else 0,
                "remoteAddr": c.raddr.ip if c.raddr else "",
                "remotePort": c.raddr.port if c.raddr else 0,
                "status": c.status if hasattr(c, "status") else "NONE",
                "pid": c.pid,
                "process": process_name,
            })
    except (psutil.AccessDenied, PermissionError) as e:
        log.warning(f"Connection scan requires elevated privileges: {e}")
        if IS_LINUX:
            log.warning("Hint: run with sudo, or grant CAP_NET_ADMIN capability")
    return result


# ---------------------------------------------------------------------------
# Alert engine
# ---------------------------------------------------------------------------

class AlertEngine:
    """Checks for traffic anomalies and generates alerts."""

    def __init__(self, spike_threshold: float = 5.0):
        self.spike_threshold = spike_threshold
        self.baseline_in: float = 0
        self.baseline_out: float = 0
        self.samples: list = []
        self.last_alert_time: Dict[str, float] = {}

    def update(self, rate_in: float, rate_out: float) -> list:
        alerts = []
        self.samples.append((rate_in, rate_out))

        if len(self.samples) > 30:
            self.samples = self.samples[-30:]

        if len(self.samples) >= 5:
            self.baseline_in = sum(s[0] for s in self.samples) / len(self.samples)
            self.baseline_out = sum(s[1] for s in self.samples) / len(self.samples)

        now = time.time()

        if self.baseline_in > 0 and rate_in > self.baseline_in * self.spike_threshold:
            key = "spike_in"
            if now - self.last_alert_time.get(key, 0) > ALERT_COOLDOWN:
                alerts.append({
                    "timestamp": int(now * 1000),
                    "type": "spike",
                    "severity": "warning",
                    "title": "Inbound traffic spike detected",
                    "message": (
                        f"Download rate {format_bytes(rate_in)}/s is "
                        f"{rate_in / self.baseline_in:.1f}x above baseline "
                        f"({format_bytes(self.baseline_in)}/s)"
                    ),
                    "dismissed": 0,
                    "sourceIp": None,
                    "category": "performance",
                })
                self.last_alert_time[key] = now

        if self.baseline_out > 0 and rate_out > self.baseline_out * self.spike_threshold:
            key = "spike_out"
            if now - self.last_alert_time.get(key, 0) > ALERT_COOLDOWN:
                alerts.append({
                    "timestamp": int(now * 1000),
                    "type": "spike",
                    "severity": "warning",
                    "title": "Outbound traffic spike detected",
                    "message": (
                        f"Upload rate {format_bytes(rate_out)}/s is "
                        f"{rate_out / self.baseline_out:.1f}x above baseline "
                        f"({format_bytes(self.baseline_out)}/s)"
                    ),
                    "dismissed": 0,
                    "sourceIp": None,
                    "category": "performance",
                })
                self.last_alert_time[key] = now

        return alerts


# ---------------------------------------------------------------------------
# Main monitor
# ---------------------------------------------------------------------------

class NetWatchMonitor:
    def __init__(self, api_url: str):
        self.api_url = api_url.rstrip("/")
        self.tracker = TrafficTracker()
        self.alert_engine = AlertEngine()
        self.running = True
        self.last_conn_scan = 0

    def post(self, endpoint: str, data) -> bool:
        try:
            resp = requests.post(
                f"{self.api_url}{endpoint}", json=data, timeout=5,
            )
            return resp.status_code in (200, 201)
        except requests.RequestException as e:
            log.debug(f"API post failed: {e}")
            return False

    def run(self):
        log.info(f"NetWatch Monitor starting on {platform.system()}")
        log.info(f"Posting to {self.api_url}")
        log.info(
            f"Polling every {POLL_INTERVAL}s, "
            f"connections every {CONN_POLL_INTERVAL}s"
        )

        primary_iface = get_primary_interface()
        log.info(f"Primary interface: {primary_iface}")

        while self.running:
            try:
                now = time.time()
                ts = int(now * 1000)

                # Poll bandwidth
                traffic = self.tracker.poll()
                if traffic:
                    for iface, data in traffic.items():
                        v4r = data["v4_ratio"]
                        v6r = data["v6_ratio"]

                        self.post("/api/bandwidth", {
                            "timestamp": ts,
                            "interface": iface,
                            "bytesIn": data["bytes_in"] * v4r,
                            "bytesOut": data["bytes_out"] * v4r,
                            "rateIn": data["rate_in"] * v4r,
                            "rateOut": data["rate_out"] * v4r,
                            "protocol": "ipv4",
                        })

                        self.post("/api/bandwidth", {
                            "timestamp": ts,
                            "interface": iface,
                            "bytesIn": data["bytes_in"] * v6r,
                            "bytesOut": data["bytes_out"] * v6r,
                            "rateIn": data["rate_in"] * v6r,
                            "rateOut": data["rate_out"] * v6r,
                            "protocol": "ipv6",
                        })

                        total_in = data["rate_in"]
                        total_out = data["rate_out"]
                        alerts = self.alert_engine.update(total_in, total_out)
                        for alert in alerts:
                            self.post("/api/alerts", alert)
                            log.warning(f"ALERT: {alert['title']}")

                # Scan connections periodically
                if now - self.last_conn_scan >= CONN_POLL_INTERVAL:
                    conns = scan_connections()
                    # Use batch endpoint for efficiency
                    if conns:
                        batch = conns[:100]  # cap per cycle
                        self.post("/api/connections/batch", batch)
                    self.last_conn_scan = now
                    log.debug(f"Scanned {len(conns)} connections")

                time.sleep(POLL_INTERVAL)

            except KeyboardInterrupt:
                break
            except Exception as e:
                log.error(f"Monitor error: {e}")
                time.sleep(POLL_INTERVAL)

        log.info("NetWatch Monitor stopped")

    def stop(self):
        self.running = False


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    global POLL_INTERVAL

    parser = argparse.ArgumentParser(
        description="NetWatch Network Monitor (cross-platform)",
    )
    parser.add_argument(
        "--api-url",
        default=DEFAULT_API_URL,
        help=f"Dashboard API URL (default: {DEFAULT_API_URL})",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=POLL_INTERVAL,
        help=f"Polling interval in seconds (default: {POLL_INTERVAL})",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    POLL_INTERVAL = args.interval

    monitor = NetWatchMonitor(args.api_url)

    def signal_handler(sig, frame):
        log.info("Shutdown signal received...")
        monitor.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    monitor.run()


if __name__ == "__main__":
    main()
