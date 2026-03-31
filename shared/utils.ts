/**
 * Shared utilities used across server and client.
 */

/**
 * Format a byte count into a human-readable string.
 * Single canonical implementation — import from here instead of duplicating.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

/**
 * Returns true if the given IP is a loopback, private, link-local,
 * or Docker-internal address that should be excluded from monitoring.
 * Covers both IPv4 and IPv6, including IPv4-mapped IPv6 addresses (::ffff:x.x.x.x).
 */
export function isLocalIp(ip: string): boolean {
  if (!ip || ip === "") return true;

  // Loopback
  if (ip === "0.0.0.0" || ip === "::" || ip === "::1") return true;
  if (ip.startsWith("127.")) return true;

  // IPv4-mapped IPv6 loopback (::ffff:127.x.x.x)
  if (ip.startsWith("::ffff:127.")) return true;

  // IPv4-mapped IPv6 private ranges
  if (ip.startsWith("::ffff:10.")) return true;
  if (ip.startsWith("::ffff:192.168.")) return true;
  if (/^::ffff:172\.(1[6-9]|2\d|3[01])\./i.test(ip)) return true;

  // RFC 1918 private ranges (plain IPv4)
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;

  // Link-local
  if (ip.startsWith("169.254.")) return true;

  // IPv6 link-local / unique local
  if (ip.toLowerCase().startsWith("fe80:")) return true;
  if (/^f[cd]/i.test(ip)) return true;

  return false;
}
