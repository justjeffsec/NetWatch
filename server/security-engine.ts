/**
 * NetWatch Security Alert Engine
 *
 * Analyzes network traffic in real-time and generates cybersecurity alerts:
 *  - New device detection (unknown IPs appearing on the network)
 *  - Suspicious port usage (known malicious / unusual ports)
 *  - Connection count spikes (sudden surge in connections)
 *  - Port scan detection (single IP hitting many ports rapidly)
 *  - DNS anomaly detection (unusual DNS traffic volume)
 *  - Rapid reconnection detection (same remote reconnecting rapidly)
 *  - Unusual outbound traffic (potential data exfiltration)
 *  - Large transfer detection (abnormally big data flows)
 */

import { storage } from "./storage";
import type { InsertAlert, Connection } from "@shared/schema";

// --- Suspicious port definitions ---

/** Ports commonly associated with malware, C2, or risky services */
const SUSPICIOUS_PORTS: Record<number, string> = {
  // Remote access / C2
  4444: "Metasploit default listener",
  5555: "Android Debug Bridge (ADB) — potential compromise",
  1337: "Common backdoor / leet port",
  31337: "Back Orifice trojan",
  6666: "IRC-based C2 channel",
  6667: "IRC (common C2 channel)",
  6697: "IRC over TLS (potential C2)",
  12345: "NetBus trojan",
  27374: "SubSeven trojan",
  65535: "Common backdoor port",

  // Unencrypted services that shouldn't be exposed
  21: "FTP (unencrypted file transfer)",
  23: "Telnet (unencrypted remote shell)",
  69: "TFTP (trivial file transfer, no auth)",
  445: "SMB/CIFS (file sharing — ransomware vector)",
  135: "MS-RPC (Windows exploit vector)",
  137: "NetBIOS name service",
  138: "NetBIOS datagram",
  139: "NetBIOS session (legacy Windows sharing)",
  161: "SNMP (often default community strings)",
  1433: "MSSQL (database exposed)",
  1521: "Oracle DB (database exposed)",
  3306: "MySQL (database exposed)",
  5432: "PostgreSQL (database exposed)",
  6379: "Redis (often unauthenticated)",
  27017: "MongoDB (often unauthenticated)",
  11211: "Memcached (amplification attack vector)",

  // Mining / crypto
  3333: "Cryptocurrency mining pool",
  8333: "Bitcoin P2P",
  9333: "Litecoin P2P",
  30303: "Ethereum P2P",

  // Tor
  9050: "Tor SOCKS proxy",
  9051: "Tor control port",
  9150: "Tor Browser SOCKS",
};

/** Well-known safe ports that we never flag */
const SAFE_PORTS = new Set([
  80, 443, 8080, 8443, // HTTP/HTTPS
  53,                    // DNS
  22,                    // SSH
  993, 995, 587, 465,    // Email (IMAP/POP3/SMTP over TLS)
  123,                   // NTP
  5353,                  // mDNS
  3478, 3479,            // STUN/TURN
]);

// --- Alert cooldowns ---
const COOLDOWNS: Record<string, number> = {};
const DEFAULT_COOLDOWN_MS = 120_000; // 2 minutes between duplicate alerts

/**
 * Returns true if the IP is a loopback, private, or link-local address
 * that should never trigger security alerts.
 */
function isLocalOrLoopback(ip: string): boolean {
  if (!ip || ip === "") return true;
  // IPv4 loopback: 127.0.0.0/8
  if (ip.startsWith("127.")) return true;
  // IPv6 loopback
  if (ip === "::1" || ip === "::" || ip === "0.0.0.0") return true;
  // IPv4 private ranges
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  // IPv4 link-local
  if (ip.startsWith("169.254.")) return true;
  // IPv6 link-local (fe80::)
  if (ip.toLowerCase().startsWith("fe80:")) return true;
  // IPv6 unique local (fc00::/7)
  if (/^f[cd]/i.test(ip)) return true;
  return false;
}

function shouldAlert(key: string, cooldownMs = DEFAULT_COOLDOWN_MS): boolean {
  const now = Date.now();
  const last = COOLDOWNS[key] || 0;
  if (now - last < cooldownMs) return false;
  COOLDOWNS[key] = now;
  return true;
}

function emitAlert(data: InsertAlert, broadcast: (data: any) => void) {
  const alert = storage.addAlert(data);
  broadcast({ type: "alert", data: alert });
}

// --- State tracking ---
const connectionHistory: { timestamp: number; count: number }[] = [];
const recentRemotes: Map<string, number[]> = new Map(); // IP → timestamps
const portAccessMap: Map<string, Set<number>> = new Map(); // IP → set of ports
const portAccessTimestamps: Map<string, number> = new Map(); // IP → first seen this window

// Cleanup interval (clear stale tracking data every 10 min)
setInterval(() => {
  const cutoff = Date.now() - 600_000;
  // Clean connection history
  while (connectionHistory.length > 0 && connectionHistory[0].timestamp < cutoff) {
    connectionHistory.shift();
  }
  // Clean port scan tracking
  for (const [ip, ts] of portAccessTimestamps.entries()) {
    if (ts < cutoff) {
      portAccessMap.delete(ip);
      portAccessTimestamps.delete(ip);
    }
  }
  // Clean reconnection tracking
  for (const [ip, times] of recentRemotes.entries()) {
    const fresh = times.filter(t => t > cutoff);
    if (fresh.length === 0) recentRemotes.delete(ip);
    else recentRemotes.set(ip, fresh);
  }
}, 300_000);


// =====================================================================
// Public API
// =====================================================================

/**
 * Check if an IP is trusted (whitelisted by the user).
 */
function isTrustedIp(ip: string): boolean {
  const device = storage.getKnownDeviceByIp(ip);
  return device?.trusted === 1;
}

/**
 * Analyze a batch of new connections for security threats.
 * Called every time the monitor pushes connections.
 */
export function analyzeConnections(
  conns: Connection[],
  broadcast: (data: any) => void,
): void {
  const now = Date.now();

  for (const conn of conns) {
    // Skip loopback and local/private IPs entirely — never flag these
    if (isLocalOrLoopback(conn.remoteAddr)) continue;

    // --- 1. New device detection (always runs, even for trusted — just registers) ---
    checkNewDevice(conn, broadcast);

    // Skip all security checks for trusted (whitelisted) IPs
    if (isTrustedIp(conn.remoteAddr)) continue;

    // --- 2. Suspicious port usage ---
    checkSuspiciousPort(conn, broadcast);

    // --- 3. Port scan detection ---
    checkPortScan(conn, broadcast);

    // --- 4. Rapid reconnection ---
    checkRapidReconnection(conn, broadcast);

    // --- 5. DNS anomaly ---
    checkDnsAnomaly(conn, broadcast);
  }

  // --- 6. Connection count spike ---
  checkConnectionSpike(conns.length, broadcast);
}

/**
 * Analyze bandwidth data for security-relevant anomalies.
 * Called every bandwidth poll cycle.
 */
export function analyzeBandwidth(
  totalRateIn: number,
  totalRateOut: number,
  broadcast: (data: any) => void,
): void {
  // --- 7. Unusual outbound traffic (potential exfiltration) ---
  checkExfiltration(totalRateIn, totalRateOut, broadcast);

  // --- 8. Large transfer detection ---
  checkLargeTransfer(totalRateIn, totalRateOut, broadcast);
}


// =====================================================================
// Detection functions
// =====================================================================

/**
 * 1. NEW DEVICE DETECTION
 * Flags any remote IP that hasn't been seen before.
 */
function checkNewDevice(conn: Connection, broadcast: (data: any) => void) {
  const ip = conn.remoteAddr;
  if (isLocalOrLoopback(ip)) return;
  
  const existing = storage.getKnownDeviceByIp(ip);
  if (existing) {
    storage.updateDeviceLastSeen(ip, Date.now());
    return;
  }

  // New IP — register it
  storage.addKnownDevice({
    ipAddress: ip,
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    label: null,
    trusted: 0,
  });

  // Don't alert for already-trusted IPs (shouldn't happen for brand new, but be safe)
  if (shouldAlert(`new_device_${ip}`, 300_000)) {
    emitAlert({
      timestamp: Date.now(),
      type: "new_device",
      severity: "warning",
      title: "New device detected",
      message: `First connection to ${ip} via ${conn.protocol.toUpperCase()}:${conn.remotePort}${conn.process ? ` (${conn.process})` : ""}`,
      dismissed: 0,
      sourceIp: ip,
      category: "security",
    }, broadcast);
  }
}

/**
 * 2. SUSPICIOUS PORT DETECTION
 * Flags connections to/from known malicious or risky ports.
 */
function checkSuspiciousPort(conn: Connection, broadcast: (data: any) => void) {
  const remotePort = conn.remotePort;
  const localPort = conn.localPort;

  // Check remote port
  if (SUSPICIOUS_PORTS[remotePort] && shouldAlert(`sus_port_${conn.remoteAddr}_${remotePort}`)) {
    emitAlert({
      timestamp: Date.now(),
      type: "suspicious_port",
      severity: remotePort === 4444 || remotePort === 31337 || remotePort === 12345 ? "critical" : "warning",
      title: "Suspicious port activity",
      message: `Connection to ${conn.remoteAddr}:${remotePort} — ${SUSPICIOUS_PORTS[remotePort]}${conn.process ? ` (process: ${conn.process})` : ""}`,
      dismissed: 0,
      sourceIp: conn.remoteAddr,
      category: "security",
    }, broadcast);
  }

  // Check if something is listening on a suspicious local port (inbound)
  if (SUSPICIOUS_PORTS[localPort] && conn.status === "ESTABLISHED" && shouldAlert(`sus_local_${localPort}`)) {
    emitAlert({
      timestamp: Date.now(),
      type: "suspicious_port",
      severity: "critical",
      title: "Suspicious inbound connection",
      message: `Remote ${conn.remoteAddr} connected to local port ${localPort} — ${SUSPICIOUS_PORTS[localPort]}${conn.process ? ` (process: ${conn.process})` : ""}`,
      dismissed: 0,
      sourceIp: conn.remoteAddr,
      category: "security",
    }, broadcast);
  }
}

/**
 * 3. PORT SCAN DETECTION
 * Flags a single remote IP that connects to many different local ports in a short window.
 */
function checkPortScan(conn: Connection, broadcast: (data: any) => void) {
  const ip = conn.remoteAddr;
  if (!ip) return;

  if (!portAccessMap.has(ip)) {
    portAccessMap.set(ip, new Set());
    portAccessTimestamps.set(ip, Date.now());
  }

  const ports = portAccessMap.get(ip)!;
  ports.add(conn.localPort);

  // If a single IP has hit 15+ different local ports in a window, that's suspicious
  if (ports.size >= 15 && shouldAlert(`portscan_${ip}`, 300_000)) {
    emitAlert({
      timestamp: Date.now(),
      type: "port_scan",
      severity: "critical",
      title: "Possible port scan detected",
      message: `${ip} has probed ${ports.size} different local ports — potential reconnaissance activity`,
      dismissed: 0,
      sourceIp: ip,
      category: "security",
    }, broadcast);
  }
}

/**
 * 4. RAPID RECONNECTION DETECTION
 * Flags a remote IP that connects, disconnects, and reconnects many times quickly.
 * Typical of brute-force attacks, C2 beaconing, or unstable malware connections.
 */
function checkRapidReconnection(conn: Connection, broadcast: (data: any) => void) {
  const ip = conn.remoteAddr;
  if (!ip) return;

  const now = Date.now();
  if (!recentRemotes.has(ip)) recentRemotes.set(ip, []);
  
  const times = recentRemotes.get(ip)!;
  times.push(now);

  // Keep only last 60 seconds of timestamps
  const cutoff = now - 60_000;
  const recent = times.filter(t => t > cutoff);
  recentRemotes.set(ip, recent);

  // 20+ connections in 60 seconds from same IP = suspicious
  if (recent.length >= 20 && shouldAlert(`rapid_${ip}`, 300_000)) {
    emitAlert({
      timestamp: now,
      type: "rapid_reconnect",
      severity: "warning",
      title: "Rapid reconnection pattern",
      message: `${ip} made ${recent.length} connections in the last 60s — possible brute-force, C2 beaconing, or scanning`,
      dismissed: 0,
      sourceIp: ip,
      category: "security",
    }, broadcast);
  }
}

/**
 * 5. DNS ANOMALY DETECTION
 * Flags unusual DNS traffic: non-standard DNS ports, or high-volume DNS
 * which could indicate DNS tunneling or exfiltration.
 */
const dnsQueryCount: { timestamp: number; count: number }[] = [];

function checkDnsAnomaly(conn: Connection, broadcast: (data: any) => void) {
  // Standard DNS is port 53 (TCP/UDP), DNS over TLS is 853
  const isDns = conn.remotePort === 53 || conn.remotePort === 853;
  
  if (isDns) {
    const now = Date.now();
    dnsQueryCount.push({ timestamp: now, count: 1 });
    
    // Clean old entries
    const cutoff = now - 60_000;
    while (dnsQueryCount.length > 0 && dnsQueryCount[0].timestamp < cutoff) {
      dnsQueryCount.shift();
    }

    // More than 100 DNS connections in 60 seconds is abnormal for a home network
    if (dnsQueryCount.length > 100 && shouldAlert("dns_flood", 300_000)) {
      emitAlert({
        timestamp: now,
        type: "dns_anomaly",
        severity: "warning",
        title: "Abnormal DNS activity",
        message: `${dnsQueryCount.length} DNS connections in the last 60s — possible DNS tunneling or malware callback`,
        dismissed: 0,
        sourceIp: conn.remoteAddr,
        category: "security",
      }, broadcast);
    }
  }

  // DNS on a non-standard port (not 53 or 853) — could be DNS tunneling
  if (conn.process && conn.process.toLowerCase().includes("dns") && conn.remotePort !== 53 && conn.remotePort !== 853) {
    if (shouldAlert(`dns_nonstandard_${conn.remotePort}`)) {
      emitAlert({
        timestamp: Date.now(),
        type: "dns_anomaly",
        severity: "warning",
        title: "DNS on non-standard port",
        message: `DNS-related process "${conn.process}" communicating on port ${conn.remotePort} to ${conn.remoteAddr}`,
        dismissed: 0,
        sourceIp: conn.remoteAddr,
        category: "security",
      }, broadcast);
    }
  }
}

/**
 * 6. CONNECTION COUNT SPIKE
 * Flags sudden surges in total active connections.
 */
let connectionBaseline = 0;
let connectionSamples = 0;

function checkConnectionSpike(count: number, broadcast: (data: any) => void) {
  const now = Date.now();
  connectionHistory.push({ timestamp: now, count });

  // Build baseline over time
  connectionSamples++;
  if (connectionSamples <= 10) {
    connectionBaseline = ((connectionBaseline * (connectionSamples - 1)) + count) / connectionSamples;
    return;
  }
  
  // Update rolling baseline (weighted toward recent)
  connectionBaseline = connectionBaseline * 0.95 + count * 0.05;

  // Spike = 3x baseline and at least 50 connections above baseline
  const threshold = Math.max(connectionBaseline * 3, connectionBaseline + 50);
  if (count > threshold && shouldAlert("conn_spike", 120_000)) {
    emitAlert({
      timestamp: now,
      type: "connection_spike",
      severity: "warning",
      title: "Connection count spike",
      message: `${count} active connections detected (baseline: ~${Math.round(connectionBaseline)}) — could indicate malware activity, DDoS, or network scan`,
      dismissed: 0,
      sourceIp: null,
      category: "performance",
    }, broadcast);
  }
}

/**
 * 7. UNUSUAL OUTBOUND TRAFFIC (POTENTIAL EXFILTRATION)
 * Flags when outbound traffic significantly exceeds inbound, which is unusual
 * for a home network (typically download-heavy).
 */
const outboundSamples: number[] = [];
const inboundSamples: number[] = [];

function checkExfiltration(rateIn: number, rateOut: number, broadcast: (data: any) => void) {
  outboundSamples.push(rateOut);
  inboundSamples.push(rateIn);
  if (outboundSamples.length > 60) outboundSamples.shift();
  if (inboundSamples.length > 60) inboundSamples.shift();

  if (outboundSamples.length < 15) return;

  const avgOut = outboundSamples.reduce((a, b) => a + b, 0) / outboundSamples.length;
  const avgIn = inboundSamples.reduce((a, b) => a + b, 0) / inboundSamples.length;

  // Flag if outbound is consistently 3x inbound and at least 1 MB/s
  if (avgOut > avgIn * 3 && avgOut > 1_000_000 && shouldAlert("exfiltration", 600_000)) {
    emitAlert({
      timestamp: Date.now(),
      type: "large_transfer",
      severity: "critical",
      title: "Unusual outbound traffic pattern",
      message: `Sustained outbound rate (~${formatBytes(avgOut)}/s) is ${(avgOut / Math.max(avgIn, 1)).toFixed(1)}x higher than inbound (~${formatBytes(avgIn)}/s) — potential data exfiltration`,
      dismissed: 0,
      sourceIp: null,
      category: "security",
    }, broadcast);
  }
}

/**
 * 8. LARGE TRANSFER DETECTION
 * Flags single-interval transfers that are abnormally large.
 */
const transferSamples: number[] = [];

function checkLargeTransfer(rateIn: number, rateOut: number, broadcast: (data: any) => void) {
  const total = rateIn + rateOut;
  transferSamples.push(total);
  if (transferSamples.length > 60) transferSamples.shift();
  if (transferSamples.length < 10) return;

  const avg = transferSamples.reduce((a, b) => a + b, 0) / transferSamples.length;

  // Flag if current rate is 10x average and at least 10 MB/s
  if (total > avg * 10 && total > 10_000_000 && shouldAlert("large_transfer", 120_000)) {
    emitAlert({
      timestamp: Date.now(),
      type: "large_transfer",
      severity: "info",
      title: "Large data transfer in progress",
      message: `Current throughput of ${formatBytes(total)}/s is ${(total / Math.max(avg, 1)).toFixed(1)}x above normal (~${formatBytes(avg)}/s)`,
      dismissed: 0,
      sourceIp: null,
      category: "performance",
    }, broadcast);
  }
}


// --- Helpers ---

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}
