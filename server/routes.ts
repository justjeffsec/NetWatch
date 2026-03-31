import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertAlertThresholdSchema } from "@shared/schema";
import { analyzeConnections, analyzeBandwidth } from "./security-engine";
import { recordFlows } from "./flow-analyzer";
import { formatBytes, isLocalIp } from "@shared/utils";

// Simulated network data generator for demo/development
// On Windows, the real monitor (netwatch_monitor.py) posts data via REST API
class NetworkSimulator {
  private interval: ReturnType<typeof setInterval> | null = null;
  private wss: WebSocketServer | null = null;
  private baseIn = 1200000;  // ~1.2 MB/s baseline
  private baseOut = 450000;  // ~450 KB/s baseline

  start(wss: WebSocketServer) {
    this.wss = wss;
    // Seed some initial data
    const now = Date.now();
    for (let i = 60; i > 0; i--) {
      const ts = now - i * 2000;
      this.generateSnapshot(ts);
    }
    // Generate mock connections
    this.generateMockConnections();

    // Live updates every 2 seconds
    this.interval = setInterval(() => {
      const snapshot = this.generateSnapshot(Date.now());
      this.broadcast({ type: "bandwidth", data: snapshot });

      // Occasionally add new connections
      if (Math.random() < 0.3) {
        const conn = this.generateSingleConnection();
        this.broadcast({ type: "connection", data: conn });
        // Run security analysis on new connections + record flows
        analyzeConnections([conn], (data) => this.broadcast(data));
        recordFlows([conn]);
      }

      // Check thresholds + security analysis
      this.checkThresholds(snapshot);
      const totalIn = (snapshot.ipv4?.rateIn || 0) + (snapshot.ipv6?.rateIn || 0);
      const totalOut = (snapshot.ipv4?.rateOut || 0) + (snapshot.ipv6?.rateOut || 0);
      analyzeBandwidth(totalIn, totalOut, (data) => this.broadcast(data));
    }, 2000);
  }

  private generateSnapshot(ts: number) {
    const jitter = () => (Math.random() - 0.5) * 0.4;
    const spike = Math.random() < 0.05 ? 3 + Math.random() * 5 : 1;

    const rateIn = Math.max(0, this.baseIn * (1 + jitter()) * spike);
    const rateOut = Math.max(0, this.baseOut * (1 + jitter()));
    const ipv4Ratio = 0.65 + Math.random() * 0.15;

    // IPv4 snapshot
    const v4 = storage.addBandwidthSnapshot({
      timestamp: ts,
      interface: "Ethernet",
      bytesIn: rateIn * 2 * ipv4Ratio,
      bytesOut: rateOut * 2 * (1 - ipv4Ratio + 0.5),
      rateIn: rateIn * ipv4Ratio,
      rateOut: rateOut * (1 - ipv4Ratio + 0.5),
      protocol: "ipv4",
    });

    // IPv6 snapshot
    const v6 = storage.addBandwidthSnapshot({
      timestamp: ts,
      interface: "Ethernet",
      bytesIn: rateIn * 2 * (1 - ipv4Ratio),
      bytesOut: rateOut * 2 * ipv4Ratio,
      rateIn: rateIn * (1 - ipv4Ratio),
      rateOut: rateOut * ipv4Ratio,
      protocol: "ipv6",
    });

    return { ipv4: v4, ipv6: v6 };
  }

  private generateMockConnections() {
    const remotes = [
      { addr: "142.250.80.46", port: 443, process: "chrome.exe" },
      { addr: "52.96.166.130", port: 443, process: "outlook.exe" },
      { addr: "151.101.1.140", port: 443, process: "firefox.exe" },
      { addr: "104.244.42.193", port: 443, process: "chrome.exe" },
      { addr: "185.199.108.154", port: 443, process: "code.exe" },
      { addr: "13.107.42.14", port: 443, process: "teams.exe" },
      { addr: "172.217.14.99", port: 443, process: "chrome.exe" },
      { addr: "2607:f8b0:4004:800::200e", port: 443, process: "chrome.exe" },
      { addr: "2606:4700:20::681a:5e2", port: 443, process: "firefox.exe" },
      { addr: "2a00:1450:4001:82a::200e", port: 443, process: "spotify.exe" },
    ];
    const statuses = ["ESTABLISHED", "ESTABLISHED", "ESTABLISHED", "TIME_WAIT", "CLOSE_WAIT"];

    for (const r of remotes) {
      const isV6 = r.addr.includes(":");
      const conn = storage.addConnection({
        timestamp: Date.now(),
        protocol: "tcp",
        family: isV6 ? "ipv6" : "ipv4",
        localAddr: isV6 ? "::1" : "192.168.1.100",
        localPort: 49000 + Math.floor(Math.random() * 1000),
        remoteAddr: r.addr,
        remotePort: r.port,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        pid: 1000 + Math.floor(Math.random() * 5000),
        process: r.process,
      });
      // Analyze for security + record flows
      analyzeConnections([conn], (data) => this.broadcast(data));
      recordFlows([conn]);
    }
  }

  private generateSingleConnection() {
    const addrs = [
      { addr: "93.184.216.34", process: "svchost.exe" },
      { addr: "2001:db8::1", process: "node.exe" },
      { addr: "203.0.113.50", process: "python.exe" },
      { addr: "198.51.100.1", process: "steam.exe" },
    ];
    const pick = addrs[Math.floor(Math.random() * addrs.length)];
    const isV6 = pick.addr.includes(":");

    return storage.addConnection({
      timestamp: Date.now(),
      protocol: Math.random() < 0.8 ? "tcp" : "udp",
      family: isV6 ? "ipv6" : "ipv4",
      localAddr: isV6 ? "::1" : "192.168.1.100",
      localPort: 49000 + Math.floor(Math.random() * 1000),
      remoteAddr: pick.addr,
      remotePort: [80, 443, 8080, 3000][Math.floor(Math.random() * 4)],
      status: "ESTABLISHED",
      pid: 1000 + Math.floor(Math.random() * 5000),
      process: pick.process,
    });
  }

  private checkThresholds(snapshot: any) {
    const thresholds = storage.getThresholds();
    for (const t of thresholds) {
      if (!t.enabled) continue;
      const totalRateIn = (snapshot.ipv4?.rateIn || 0) + (snapshot.ipv6?.rateIn || 0);
      const totalRateOut = (snapshot.ipv4?.rateOut || 0) + (snapshot.ipv6?.rateOut || 0);

      let exceeded = false;
      let value = 0;
      if (t.metric === "bandwidth_in" && totalRateIn > t.thresholdValue) {
        exceeded = true;
        value = totalRateIn;
      } else if (t.metric === "bandwidth_out" && totalRateOut > t.thresholdValue) {
        exceeded = true;
        value = totalRateOut;
      }

      if (exceeded) {
        const alert = storage.addAlert({
          timestamp: Date.now(),
          type: "threshold",
          severity: "warning",
          title: `${t.metric === "bandwidth_in" ? "Inbound" : "Outbound"} traffic spike`,
          message: `Rate of ${formatBytes(value)}/s exceeds threshold of ${formatBytes(t.thresholdValue)}/s`,
          dismissed: 0,
          sourceIp: null,
          category: "performance",
        });
        this.broadcast({ type: "alert", data: alert });
      }
    }
  }

  private broadcast(data: any) {
    if (!this.wss) return;
    const msg = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  get isRunning() {
    return this.interval !== null;
  }
}

const simulator = new NetworkSimulator();

export async function registerRoutes(server: Server, app: Express) {
  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server, path: "/ws" });

  const broadcast = (data: any) => {
    const msg = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  };

  wss.on("connection", (ws) => {
    // Send initial state on connect
    const bandwidth = storage.getBandwidthSnapshots(Date.now() - 120_000);
    const conns = storage.getConnections(100);
    const alertList = storage.getAlerts(50);
    ws.send(JSON.stringify({ type: "init", data: { bandwidth, connections: conns, alerts: alertList } }));
  });

  // Start the simulator (in production, the Python monitor pushes data instead)
  simulator.start(wss);

  // REST API endpoints

  // Bandwidth
  app.get("/api/bandwidth", (req, res) => {
    const since = Number(req.query.since) || Date.now() - 300_000;
    const iface = req.query.interface as string | undefined;
    res.json(storage.getBandwidthSnapshots(since, iface));
  });

  app.get("/api/bandwidth/latest", (_req, res) => {
    res.json(storage.getLatestBandwidth());
  });

  // POST endpoint for the real Python monitor to push data
  app.post("/api/bandwidth", (req, res) => {
    try {
      const body = req.body;
      if (!body || typeof body.timestamp !== "number" || !body.protocol) {
        res.status(400).json({ error: "Invalid bandwidth data" });
        return;
      }
      // Stop simulator once real data flows in (only needs to happen once)
      if (simulator.isRunning) simulator.stop();

      const snapshot = storage.addBandwidthSnapshot(body);
      broadcast({ type: "bandwidth", data: { [body.protocol]: snapshot } });

      // Run security bandwidth analysis — single pass over latest snapshots
      const latest = storage.getLatestBandwidth();
      const { ipv4In, ipv4Out, ipv4Count, ipv6In, ipv6Out, ipv6Count } = latest.reduce(
        (acc, s) => {
          if (s.protocol === "ipv4") {
            acc.ipv4In += s.rateIn;
            acc.ipv4Out += s.rateOut;
            acc.ipv4Count++;
          } else if (s.protocol === "ipv6") {
            acc.ipv6In += s.rateIn;
            acc.ipv6Out += s.rateOut;
            acc.ipv6Count++;
          }
          return acc;
        },
        { ipv4In: 0, ipv4Out: 0, ipv4Count: 0, ipv6In: 0, ipv6Out: 0, ipv6Count: 0 },
      );
      const avgIpv4In = ipv4In / Math.max(1, ipv4Count);
      const avgIpv4Out = ipv4Out / Math.max(1, ipv4Count);
      const avgIpv6In = ipv6In / Math.max(1, ipv6Count);
      const avgIpv6Out = ipv6Out / Math.max(1, ipv6Count);
      analyzeBandwidth(avgIpv4In + avgIpv6In, avgIpv4Out + avgIpv6Out, broadcast);

      res.status(201).json(snapshot);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Internal error" });
    }
  });

  // Connections
  app.get("/api/connections", (req, res) => {
    const limit = Number(req.query.limit) || 200;
    res.json(storage.getConnections(limit));
  });

  app.get("/api/connections/active", (_req, res) => {
    res.json(storage.getActiveConnections());
  });

  app.post("/api/connections", (req, res) => {
    try {
      // Drop loopback connections at the API boundary
      if (isLocalIp(req.body.remoteAddr)) {
        res.status(200).json({ skipped: true });
        return;
      }
      const conn = storage.addConnection(req.body);
      broadcast({ type: "connection", data: conn });
      analyzeConnections([conn], broadcast);
      recordFlows([conn]);
      res.status(201).json(conn);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Internal error" });
    }
  });

  // Batch connections endpoint (more efficient for the monitor)
  app.post("/api/connections/batch", (req, res) => {
    try {
      const items: any[] = req.body;
      if (!Array.isArray(items)) {
        res.status(400).json({ error: "Expected array of connections" });
        return;
      }
      // Filter out loopback/local before storing
      const filtered = items.filter(item => !isLocalIp(item?.remoteAddr));
      const saved = filtered.map(item => {
        const conn = storage.addConnection(item);
        broadcast({ type: "connection", data: conn });
        return conn;
      });
      analyzeConnections(saved, broadcast);
      recordFlows(saved);
      res.status(201).json({ count: saved.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Internal error" });
    }
  });

  // Alerts
  app.get("/api/alerts", (req, res) => {
    const limit = Number(req.query.limit) || 100;
    res.json(storage.getAlerts(limit));
  });

  app.patch("/api/alerts/:id/dismiss", (req, res) => {
    storage.dismissAlert(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/alerts/dismiss-all", (_req, res) => {
    storage.dismissAllAlerts();
    res.json({ ok: true });
  });

  // Thresholds
  app.get("/api/thresholds", (_req, res) => {
    res.json(storage.getThresholds());
  });

  app.post("/api/thresholds", (req, res) => {
    const parsed = insertAlertThresholdSchema.parse(req.body);
    const threshold = storage.upsertThreshold(parsed);
    res.status(201).json(threshold);
  });

  app.delete("/api/thresholds/:id", (req, res) => {
    storage.deleteThreshold(Number(req.params.id));
    res.json({ ok: true });
  });

  // Known Devices
  app.get("/api/devices", (_req, res) => {
    res.json(storage.getKnownDevices());
  });

  app.patch("/api/devices/:id/trust", (req, res) => {
    const trusted = req.body.trusted ?? true;
    storage.trustDevice(Number(req.params.id), trusted);
    res.json({ ok: true });
  });

  app.patch("/api/devices/:id/label", (req, res) => {
    storage.labelDevice(Number(req.params.id), req.body.label || "");
    res.json({ ok: true });
  });

  // Home location (auto-detected from server's public IP)
  let homeLocation: { lat: number; lon: number; city: string; country: string } | null = null;

  // Detect on startup (non-blocking)
  (async () => {
    try {
      const resp = await fetch("http://ip-api.com/json/?fields=lat,lon,city,country", {
        signal: AbortSignal.timeout(5000),
      });
      const data = await resp.json();
      if (data.lat && data.lon) {
        homeLocation = { lat: data.lat, lon: data.lon, city: data.city || "", country: data.country || "" };
      }
    } catch {
      // Fallback stays null — client will use default
    }
  })();

  app.get("/api/home-location", (_req, res) => {
    res.json(homeLocation || { lat: 39.8, lon: -98.5, city: "Unknown", country: "US" });
  });

  // --- Flow / Traffic Analysis APIs ---

  /**
   * Shared aggregation helper: aggregate flow records by remote IP in a single pass.
   * Returns a sorted array of per-IP stats enriched with device metadata.
   */
  function aggregateFlowsByIp(records: ReturnType<typeof storage.getFlowRecords>) {
    const byIp = new Map<string, {
      bytesIn: number;
      bytesOut: number;
      connections: number;
      lastService: string;
      services: Set<string>;
    }>();

    for (const r of records) {
      const existing = byIp.get(r.remoteAddr) ?? {
        bytesIn: 0, bytesOut: 0, connections: 0, lastService: "", services: new Set<string>(),
      };
      existing.bytesIn += r.bytesIn;
      existing.bytesOut += r.bytesOut;
      existing.connections += r.connectionCount;
      existing.lastService = r.service;
      existing.services.add(r.service);
      byIp.set(r.remoteAddr, existing);
    }

    return Array.from(byIp.entries())
      .map(([ip, data]) => {
        const device = storage.getKnownDeviceByIp(ip);
        return {
          ip,
          label: device?.label ?? null,
          country: device?.country ?? null,
          org: device?.org ?? null,
          trusted: device?.trusted ?? 0,
          bytesIn: data.bytesIn,
          bytesOut: data.bytesOut,
          totalBytes: data.bytesIn + data.bytesOut,
          connections: data.connections,
          lastService: data.lastService,
          services: Array.from(data.services),
        };
      })
      .sort((a, b) => b.totalBytes - a.totalBytes);
  }

  app.get("/api/flows/top-talkers", (req, res) => {
    try {
      const since = Number(req.query.since) || Date.now() - 3_600_000;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const records = storage.getFlowRecords(since);
      res.json(aggregateFlowsByIp(records).slice(0, limit));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/flows/by-service", (req, res) => {
    try {
      const since = Number(req.query.since) || Date.now() - 3_600_000;
      const records = storage.getFlowRecords(since);

      // Aggregate by service type
      const byService = new Map<string, { bytesIn: number; bytesOut: number; connections: number }>();
      for (const r of records) {
        const existing = byService.get(r.service) || { bytesIn: 0, bytesOut: 0, connections: 0 };
        existing.bytesIn += r.bytesIn;
        existing.bytesOut += r.bytesOut;
        existing.connections += r.connectionCount;
        byService.set(r.service, existing);
      }

      const results = Array.from(byService.entries())
        .map(([service, data]) => ({
          service,
          ...data,
          totalBytes: data.bytesIn + data.bytesOut,
        }))
        .sort((a, b) => b.totalBytes - a.totalBytes);

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/flows/by-device", (req, res) => {
    try {
      const since = Number(req.query.since) || Date.now() - 3_600_000;
      const records = storage.getFlowRecords(since);
      res.json(aggregateFlowsByIp(records));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/flows/timeline", (req, res) => {
    try {
      const since = Number(req.query.since) || Date.now() - 3_600_000;
      const records = storage.getFlowRecords(since);

      // Aggregate into 5-minute buckets
      const bucketSize = 5 * 60_000;
      const buckets = new Map<number, { bytesIn: number; bytesOut: number; connections: number; services: Map<string, number> }>();

      for (const r of records) {
        const bucket = Math.floor(r.timestamp / bucketSize) * bucketSize;
        const existing = buckets.get(bucket) || { bytesIn: 0, bytesOut: 0, connections: 0, services: new Map() };
        existing.bytesIn += r.bytesIn;
        existing.bytesOut += r.bytesOut;
        existing.connections += r.connectionCount;
        existing.services.set(r.service, (existing.services.get(r.service) || 0) + r.bytesIn + r.bytesOut);
        buckets.set(bucket, existing);
      }

      const results = Array.from(buckets.entries())
        .map(([ts, data]) => ({
          timestamp: ts,
          bytesIn: data.bytesIn,
          bytesOut: data.bytesOut,
          connections: data.connections,
          topServices: Array.from(data.services.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, bytes]) => ({ name, bytes })),
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stats summary
  app.get("/api/stats", (_req, res) => {
    const latest = storage.getLatestBandwidth();
    const activeConns = storage.getActiveConnections();
    const alertList = storage.getAlerts(10);
    const devices = storage.getKnownDevices();

    // Single pass over latest bandwidth snapshots
    const bw = latest.reduce(
      (acc, s) => {
        if (s.protocol === "ipv4") {
          acc.ipv4In += s.rateIn;
          acc.ipv4Out += s.rateOut;
          acc.ipv4Count++;
        } else if (s.protocol === "ipv6") {
          acc.ipv6In += s.rateIn;
          acc.ipv6Out += s.rateOut;
          acc.ipv6Count++;
        }
        return acc;
      },
      { ipv4In: 0, ipv4Out: 0, ipv4Count: 0, ipv6In: 0, ipv6Out: 0, ipv6Count: 0 },
    );
    const ipv4In  = bw.ipv4In  / Math.max(1, bw.ipv4Count);
    const ipv4Out = bw.ipv4Out / Math.max(1, bw.ipv4Count);
    const ipv6In  = bw.ipv6In  / Math.max(1, bw.ipv6Count);
    const ipv6Out = bw.ipv6Out / Math.max(1, bw.ipv6Count);

    // Single pass over active connections
    let ipv4Conns = 0;
    let ipv6Conns = 0;
    for (const c of activeConns) {
      if (c.family === "ipv4") ipv4Conns++;
      else if (c.family === "ipv6") ipv6Conns++;
    }

    // Single pass over alerts and devices
    const undismissedAlerts = alertList.filter((a) => !a.dismissed).length;
    const trustedDevices = devices.filter((d) => d.trusted).length;

    res.json({
      totalRateIn: ipv4In + ipv6In,
      totalRateOut: ipv4Out + ipv6Out,
      ipv4: { rateIn: ipv4In, rateOut: ipv4Out },
      ipv6: { rateIn: ipv6In, rateOut: ipv6Out },
      activeConnections: activeConns.length,
      ipv4Connections: ipv4Conns,
      ipv6Connections: ipv6Conns,
      undismissedAlerts,
      knownDevices: devices.length,
      trustedDevices,
    });
  });
}
