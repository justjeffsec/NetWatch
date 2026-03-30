/**
 * NetWatch Flow Analyzer
 *
 * Classifies connections by service type and records flow data
 * for traffic analysis (top talkers, protocol breakdown, time patterns).
 */

import { storage } from "./storage";
import type { Connection } from "@shared/schema";

// --- Service classification by port ---

const PORT_SERVICE_MAP: Record<number, string> = {
  // Web
  80: "HTTP",
  443: "HTTPS",
  8080: "HTTP-Alt",
  8443: "HTTPS-Alt",
  
  // Email
  25: "SMTP",
  465: "SMTPS",
  587: "SMTP-Sub",
  110: "POP3",
  995: "POP3S",
  143: "IMAP",
  993: "IMAPS",
  
  // File transfer
  20: "FTP-Data",
  21: "FTP",
  22: "SSH/SFTP",
  69: "TFTP",
  
  // DNS
  53: "DNS",
  853: "DoT",
  5353: "mDNS",
  
  // Remote access
  23: "Telnet",
  3389: "RDP",
  5900: "VNC",
  
  // Database
  1433: "MSSQL",
  1521: "Oracle",
  3306: "MySQL",
  5432: "PostgreSQL",
  6379: "Redis",
  27017: "MongoDB",
  
  // Messaging / streaming
  5222: "XMPP",
  6667: "IRC",
  1935: "RTMP",
  
  // Gaming / voice
  3478: "STUN",
  3479: "TURN",
  
  // System
  123: "NTP",
  161: "SNMP",
  162: "SNMP-Trap",
  514: "Syslog",
  
  // VPN / tunnel
  500: "IKE",
  1194: "OpenVPN",
  1723: "PPTP",
  4500: "IPSec-NAT",
  51820: "WireGuard",
};

/**
 * Classify a connection's service based on remote port.
 */
export function classifyService(remotePort: number, process?: string | null): string {
  // Check well-known port mapping first
  const known = PORT_SERVICE_MAP[remotePort];
  if (known) return known;
  
  // Try to infer from process name
  if (process) {
    const p = process.toLowerCase();
    if (p.includes("chrome") || p.includes("firefox") || p.includes("safari") || p.includes("edge") || p.includes("brave")) return "Web Browser";
    if (p.includes("spotify")) return "Streaming";
    if (p.includes("discord")) return "Voice/Chat";
    if (p.includes("teams") || p.includes("zoom") || p.includes("slack")) return "Video/Chat";
    if (p.includes("steam") || p.includes("epic") || p.includes("game")) return "Gaming";
    if (p.includes("dropbox") || p.includes("onedrive") || p.includes("gdrive")) return "Cloud Sync";
    if (p.includes("code") || p.includes("vim") || p.includes("git")) return "Dev Tools";
    if (p.includes("update") || p.includes("apt") || p.includes("yum") || p.includes("pacman")) return "System Update";
    if (p.includes("ssh")) return "SSH/SFTP";
    if (p.includes("vpn") || p.includes("wireguard") || p.includes("openvpn")) return "VPN";
    if (p.includes("torrent") || p.includes("transmission") || p.includes("qbit")) return "P2P/Torrent";
  }
  
  // Port ranges
  if (remotePort >= 1024 && remotePort <= 49151) return "App/Service";
  if (remotePort >= 49152) return "Ephemeral";
  
  return "Other";
}

/**
 * Estimate bytes for a connection based on service type.
 * Since we can't see actual bytes per connection with psutil,
 * we estimate based on connection characteristics.
 */
function estimateBytes(service: string, status: string): { bytesIn: number; bytesOut: number } {
  // Active connections contribute more traffic
  const active = status === "ESTABLISHED" ? 1 : 0.1;
  
  // Base estimates per 5-second polling interval (rough order of magnitude)
  const estimates: Record<string, [number, number]> = {
    "HTTPS": [15000, 3000],
    "HTTP": [12000, 2500],
    "Streaming": [50000, 2000],
    "Video/Chat": [30000, 25000],
    "Voice/Chat": [8000, 7000],
    "Web Browser": [15000, 3000],
    "Gaming": [5000, 3000],
    "DNS": [500, 400],
    "SSH/SFTP": [2000, 2000],
    "Cloud Sync": [10000, 10000],
    "P2P/Torrent": [20000, 15000],
    "VPN": [20000, 15000],
    "System Update": [30000, 1000],
  };
  
  const [bIn, bOut] = estimates[service] || [2000, 1000];
  return {
    bytesIn: bIn * active * (0.7 + Math.random() * 0.6),
    bytesOut: bOut * active * (0.7 + Math.random() * 0.6),
  };
}

/**
 * Process a batch of connections and record flow data.
 * Called every time connections are pushed by the monitor.
 */
export function recordFlows(conns: Connection[]): void {
  const now = Date.now();
  // Bucket to 30-second intervals for aggregation
  const bucket = Math.floor(now / 30000) * 30000;
  
  for (const conn of conns) {
    if (!conn.remoteAddr || conn.remoteAddr === "") continue;
    const service = classifyService(conn.remotePort, conn.process);
    const bytes = estimateBytes(service, conn.status);
    
    try {
      storage.addFlowRecord({
        timestamp: bucket,
        remoteAddr: conn.remoteAddr,
        remotePort: conn.remotePort,
        protocol: conn.protocol,
        family: conn.family,
        service,
        process: conn.process || null,
        bytesIn: bytes.bytesIn,
        bytesOut: bytes.bytesOut,
        connectionCount: 1,
      });
    } catch {
      // Non-fatal — skip individual record errors
    }
  }
}
