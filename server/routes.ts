import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertAlertThresholdSchema } from "@shared/schema";
import { analyzeConnections, analyzeBandwidth } from "./security-engine";

/** Filter out loopback/local IPs at the API boundary */
function isLocalIp(ip: string): boolean {
  if (!ip || ip === "" || ip === "0.0.0.0" || ip === "::" || ip === "::1") return true;
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("::ffff:127.")) return true;
  return false;
}

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
        // Run security analysis on new connections
        analyzeConnections([conn], (data) => this.broadcast(data));
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
      // Analyze for security
      analyzeConnections([conn], (data) => this.broadcast(data));
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
    if (this.interval) clearInterval(this.interval);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
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
      // Stop simulator once real data flows in
      simulator.stop();

      const snapshot = storage.addBandwidthSnapshot(body);
      broadcast({ type: "bandwidth", data: { [body.protocol]: snapshot } });

      // Run security bandwidth analysis
      const latest = storage.getLatestBandwidth();
      const ipv4In = latest.filter(s => s.protocol === "ipv4").reduce((sum, s) => sum + s.rateIn, 0) / Math.max(1, latest.filter(s => s.protocol === "ipv4").length);
      const ipv6In = latest.filter(s => s.protocol === "ipv6").reduce((sum, s) => sum + s.rateIn, 0) / Math.max(1, latest.filter(s => s.protocol === "ipv6").length);
      const ipv4Out = latest.filter(s => s.protocol === "ipv4").reduce((sum, s) => sum + s.rateOut, 0) / Math.max(1, latest.filter(s => s.protocol === "ipv4").length);
      const ipv6Out = latest.filter(s => s.protocol === "ipv6").reduce((sum, s) => sum + s.rateOut, 0) / Math.max(1, latest.filter(s => s.protocol === "ipv6").length);
      analyzeBandwidth(ipv4In + ipv6In, ipv4Out + ipv6Out, broadcast);

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

  // Stats summary
  app.get("/api/stats", (_req, res) => {
    const latest = storage.getLatestBandwidth();
    const activeConns = storage.getActiveConnections();
    const alertList = storage.getAlerts(10);
    const undismissedAlerts = alertList.filter((a) => !a.dismissed);
    const devices = storage.getKnownDevices();

    const ipv4In = latest.filter(s => s.protocol === "ipv4").reduce((sum, s) => sum + s.rateIn, 0) / Math.max(1, latest.filter(s => s.protocol === "ipv4").length);
    const ipv4Out = latest.filter(s => s.protocol === "ipv4").reduce((sum, s) => sum + s.rateOut, 0) / Math.max(1, latest.filter(s => s.protocol === "ipv4").length);
    const ipv6In = latest.filter(s => s.protocol === "ipv6").reduce((sum, s) => sum + s.rateIn, 0) / Math.max(1, latest.filter(s => s.protocol === "ipv6").length);
    const ipv6Out = latest.filter(s => s.protocol === "ipv6").reduce((sum, s) => sum + s.rateOut, 0) / Math.max(1, latest.filter(s => s.protocol === "ipv6").length);

    res.json({
      totalRateIn: ipv4In + ipv6In,
      totalRateOut: ipv4Out + ipv6Out,
      ipv4: { rateIn: ipv4In, rateOut: ipv4Out },
      ipv6: { rateIn: ipv6In, rateOut: ipv6Out },
      activeConnections: activeConns.length,
      ipv4Connections: activeConns.filter(c => c.family === "ipv4").length,
      ipv6Connections: activeConns.filter(c => c.family === "ipv6").length,
      undismissedAlerts: undismissedAlerts.length,
      knownDevices: devices.length,
      trustedDevices: devices.filter(d => d.trusted).length,
    });
  });
}
