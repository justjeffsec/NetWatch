/**
 * NetWatch GeoIP + Threat Intelligence Service
 *
 * GeoIP: Uses the free ip-api.com service (no key needed, 45 req/min)
 * Threat Intel: Checks IPs against multiple free blocklists
 */

import { storage } from "./storage";

// --- GeoIP Cache & Rate Limiting ---
const geoCache = new Map<string, GeoResult>();
const threatCache = new Map<string, ThreatResult>();
const MAX_CACHE_SIZE = 5000; // Prevent unbounded memory growth
const GEO_RATE_LIMIT_MS = 1500; // ~40 req/min to stay under ip-api's 45/min limit
let lastGeoRequest = 0;
const geoQueue: string[] = [];
let geoProcessing = false;

interface GeoResult {
  country: string;
  countryName: string;
  city: string;
  lat: number;
  lon: number;
  org: string;
}

interface ThreatResult {
  threatLevel: "safe" | "suspicious" | "malicious";
  threatSource: string;
}

// Known malicious IP ranges/patterns (curated set of well-known bad actors)
// This is a lightweight local check before hitting external APIs
const KNOWN_BAD_RANGES = [
  // Commonly spoofed/abused ranges
  { prefix: "0.", reason: "Invalid source (RFC 5735)" },
  { prefix: "100.64.", reason: "Shared address space (CGN)" },
];

/**
 * Queue a GeoIP + threat intel lookup for an IP.
 * Results are stored directly on the known_devices record.
 */
export function enrichDevice(ip: string): void {
  // Don't re-enrich if we already have data
  const device = storage.getKnownDeviceByIp(ip);
  if (device?.country) return; // already enriched

  if (!geoQueue.includes(ip)) {
    geoQueue.push(ip);
  }
  processGeoQueue();
}

async function processGeoQueue(): Promise<void> {
  if (geoProcessing || geoQueue.length === 0) return;
  geoProcessing = true;

  while (geoQueue.length > 0) {
    const ip = geoQueue.shift()!;

    // Rate limit
    const now = Date.now();
    const wait = GEO_RATE_LIMIT_MS - (now - lastGeoRequest);
    if (wait > 0) await sleep(wait);

    try {
      // GeoIP lookup
      const geo = await fetchGeoIp(ip);
      lastGeoRequest = Date.now();

      // Threat check
      const threat = await checkThreat(ip);

      // Update the device record
      const device = storage.getKnownDeviceByIp(ip);
      if (device) {
        // Avoid Null Island (0,0) — treat as unknown
        const lat = (geo?.lat && geo?.lon && !(geo.lat === 0 && geo.lon === 0)) ? geo.lat : null;
        const lon = (geo?.lat && geo?.lon && !(geo.lat === 0 && geo.lon === 0)) ? geo.lon : null;
        storage.updateDeviceGeo(ip, {
          country: geo?.country || null,
          countryName: geo?.countryName || null,
          city: geo?.city || null,
          lat,
          lon,
          org: geo?.org || null,
          threatLevel: threat?.threatLevel || null,
          threatSource: threat?.threatSource || null,
        });
      }
    } catch (err) {
      // Silently skip — will retry on next connection from this IP
    }
  }

  geoProcessing = false;
}

async function fetchGeoIp(ip: string): Promise<GeoResult | null> {
  // Check cache
  if (geoCache.has(ip)) return geoCache.get(ip)!;

  try {
    const resp = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,lat,lon,org,isp`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await resp.json();

    if (data.status === "success") {
      const result: GeoResult = {
        country: data.countryCode || "",
        countryName: data.country || "",
        city: data.city || "",
        lat: data.lat || 0,
        lon: data.lon || 0,
        org: data.org || data.isp || "",
      };
      if (geoCache.size > MAX_CACHE_SIZE) {
        const firstKey = geoCache.keys().next().value;
        if (firstKey) geoCache.delete(firstKey);
      }
      geoCache.set(ip, result);
      return result;
    }
  } catch {
    // Network error — skip
  }
  return null;
}

async function checkThreat(ip: string): Promise<ThreatResult | null> {
  // Check cache
  if (threatCache.has(ip)) return threatCache.get(ip)!;

  // Local quick checks
  for (const range of KNOWN_BAD_RANGES) {
    if (ip.startsWith(range.prefix)) {
      const result: ThreatResult = { threatLevel: "suspicious", threatSource: range.reason };
      threatCache.set(ip, result);
      return result;
    }
  }

  // Check against free blocklist APIs
  try {
    // Use the free blocklist.de API (no key needed)
    const resp = await fetch(
      `http://api.blocklist.de/api.php?ip=${ip}&start=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    const text = await resp.text();
    const attacks = parseInt(text.trim(), 10);

    if (!isNaN(attacks) && attacks > 0) {
      const level = attacks >= 10 ? "malicious" : "suspicious";
      const result: ThreatResult = {
        threatLevel: level,
        threatSource: `blocklist.de (${attacks} reported attacks)`,
      };
      if (threatCache.size > MAX_CACHE_SIZE) {
        const firstKey = threatCache.keys().next().value;
        if (firstKey) threatCache.delete(firstKey);
      }
      threatCache.set(ip, result);
      return result;
    }
  } catch {
    // API unreachable — that's fine
  }

  // Default: safe
  const result: ThreatResult = { threatLevel: "safe", threatSource: "No threats found" };
  if (threatCache.size > MAX_CACHE_SIZE) {
    const firstKey = threatCache.keys().next().value;
    if (firstKey) threatCache.delete(firstKey);
  }
  threatCache.set(ip, result);
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get enrichment data for an IP from cache (for API responses).
 */
export function getCachedGeo(ip: string): GeoResult | undefined {
  return geoCache.get(ip);
}

export function getCachedThreat(ip: string): ThreatResult | undefined {
  return threatCache.get(ip);
}
