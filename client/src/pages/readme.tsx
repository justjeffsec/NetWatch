import { useState, useEffect, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";

/* ─── Small styled primitives (match traffic.tsx aesthetic) ─── */

const SectionHeader = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="flex items-center gap-2">
    <div className="w-1 h-4 rounded-sm" style={{ background: "hsl(128 100% 45%)", boxShadow: "0 0 6px rgba(0,230,65,0.5)" }} />
    <CardTitle className="text-[11px] font-mono tracking-widest uppercase opacity-80">{title}</CardTitle>
    {sub && (
      <span className="border text-[9px] px-1.5 py-0.5 font-mono tracking-widest"
        style={{ borderRadius: "2px", borderColor: "rgba(0,230,65,0.2)", background: "rgba(0,230,65,0.06)", color: "hsl(128 50% 45%)" }}>
        {sub}
      </span>
    )}
  </div>
);

const Section = ({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) => (
  <Card className="border-card-border">
    <CardHeader className="pb-2 pt-3 px-4">
      <SectionHeader title={title} sub={sub} />
    </CardHeader>
    <CardContent className="px-4 pb-4">{children}</CardContent>
  </Card>
);

const P = ({ children }: { children: ReactNode }) => (
  <p className="text-[12px] font-mono leading-relaxed opacity-70 mb-3 last:mb-0">{children}</p>
);

const Term = ({ children }: { children: ReactNode }) => (
  <span className="font-mono" style={{ color: "hsl(128 80% 58%)" }}>{children}</span>
);

const Pre = ({ children }: { children: ReactNode }) => (
  <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto p-3 border rounded-sm mb-3 last:mb-0"
    style={{ background: "hsl(128 90% 3%)", borderColor: "rgba(0,230,65,0.15)", color: "hsl(128 60% 55%)" }}>
    {children}
  </pre>
);

const Bullet = ({ label, children }: { label: string; children: ReactNode }) => (
  <li className="text-[12px] font-mono leading-relaxed opacity-70 mb-2 flex gap-2">
    <span className="flex-shrink-0" style={{ color: "hsl(128 100% 45%)" }}>▸</span>
    <span><Term>{label}</Term> — {children}</span>
  </li>
);

/* ─── Data ─── */

const ARCH_DIAGRAM = `┌──────────────────────┐    POST /api/*     ┌──────────────────────┐
│  netwatch_monitor.py │ ─────────────────► │   Node.js Dashboard  │
│   (Python + psutil)  │                    │  (Express + React)   │
│                      │    WebSocket       │      :8080           │
│  Captures:           │ ◄───────────────── │  Enriches + analyzes │
│   • Bandwidth v4/v6  │   live push to     │  Pushes to browsers  │
│   • Connections      │   all browsers     │                      │
│   • Alert triggers   │                    │  ├─ security-engine  │
└──────────────────────┘                    │  ├─ geo-intel        │
          ▲                                  │  └─ flow-analyzer    │
    ┌─────┴─────┐                            └──────────┬───────────┘
    │    NIC    │                                       │
    │ /proc/net │                                  ┌────┴────┐
    └───────────┘                                  │ Browser │
                                                   └─────────┘`;

const STRUCTURE = `netwatch/
├── client/                      # React + Vite frontend
│   └── src/
│       ├── components/          # KPI cards, charts, map, tables
│       ├── lib/                 # WebSocket hook, theme, utils
│       └── pages/               # dashboard · traffic · readme
├── server/                      # Express backend
│   ├── routes.ts                # REST API + WebSocket hub
│   ├── security-engine.ts       # Threat/anomaly detection
│   ├── geo-intel.ts             # GeoIP + threat blocklists
│   ├── flow-analyzer.ts         # Service classification / flows
│   └── storage.ts               # SQLite (Drizzle ORM)
├── shared/schema.ts             # DB schema + types
├── monitor/                     # Python agent + installers
│   ├── netwatch_monitor.py      # Cross-platform monitor
│   ├── netwatch_service.py      # Windows service wrapper
│   └── *.service / *.sh / *.bat # systemd + install scripts
├── docker-compose.yml           # Two-container orchestration
└── Dockerfile`;

const API_ROWS: [string, string, string][] = [
  ["GET", "/api/stats", "Summary KPIs (rates, conn counts, alerts, v4/v6 split)"],
  ["GET", "/api/bandwidth?since=<ms>", "Bandwidth snapshots since a timestamp"],
  ["POST", "/api/bandwidth", "Monitor pushes a bandwidth sample"],
  ["GET", "/api/connections?limit=200", "Recent connections"],
  ["POST", "/api/connections/batch", "Monitor pushes a batch of connections"],
  ["GET", "/api/alerts", "Recent security alerts"],
  ["PATCH", "/api/alerts/:id/dismiss", "Dismiss a single alert"],
  ["POST", "/api/alerts/dismiss-all", "Dismiss every active alert"],
  ["GET", "/api/devices", "Known devices seen on the network"],
  ["PATCH", "/api/devices/:id/trust", "Mark a device trusted / untrusted"],
  ["PATCH", "/api/devices/:id/label", "Rename a device"],
  ["GET", "/api/home-location", "GeoIP anchor for the connection map"],
  ["GET", "/api/flows/top-talkers", "Highest-volume remote hosts"],
  ["GET", "/api/flows/by-service", "Bandwidth grouped by service type"],
  ["GET", "/api/flows/by-device", "Per-device bandwidth breakdown"],
  ["GET", "/api/flows/timeline", "Traffic volume over time"],
];

/* ─── Page ─── */

export default function Readme() {
  const [, navigate] = useLocation();
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full overflow-y-auto cyber-grid" style={{ background: "hsl(128 95% 2%)" }}>

      {/* ── NAV BAR ── */}
      <div className="sticky top-0 z-50 border-b border-border/60"
        style={{ background: "hsl(128 95% 2%)", boxShadow: "0 1px 16px rgba(0,230,65,0.1)" }}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm"
              className="h-7 px-2 font-mono text-[11px] tracking-widest uppercase border border-transparent hover:border-primary/30"
              style={{ color: "hsl(128 60% 48%)" }}
              onClick={() => navigate("/")}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Dashboard
            </Button>
            <div className="h-4 w-px bg-border/60" />
            <span className="text-[13px] font-mono font-bold tracking-widest uppercase"
              style={{ color: "hsl(128 100% 55%)", textShadow: "0 0 10px rgba(0,230,65,0.6)", fontFamily: "'Orbitron',monospace" }}>
              System Manual
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm"
              className="h-7 px-3 font-mono text-[11px] tracking-widest uppercase border border-transparent hover:border-primary/30"
              style={{ color: "hsl(128 70% 52%)" }}
              onClick={() => navigate("/traffic")}>
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Traffic
            </Button>
            <div className="h-4 w-px bg-border/60" />
            <span className="text-[11px] font-mono tabular-nums" style={{ color: "hsl(128 100% 55%)", textShadow: "0 0 8px rgba(0,230,65,0.5)" }}>
              {clock}
            </span>
          </div>
        </div>
        <div className="px-4 pb-1.5 flex items-center gap-4">
          <span className="text-[9px] font-mono tracking-widest uppercase opacity-40">
            // README :: WHAT THIS SYSTEM DOES AND HOW IT WORKS
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="p-4 space-y-4 max-w-5xl mx-auto">

        <Section title="Overview" sub="what it is">
          <P>
            <Term>NetWatch</Term> is a real-time network security monitor for home and lab networks,
            running on <Term>Windows</Term> and <Term>Linux</Term>. A lightweight Python agent watches
            your live traffic while a web dashboard turns it into readable intelligence — bandwidth
            charts, a live connection map, per-device breakdowns, and automatic threat alerts.
          </P>
          <P>
            It tracks <Term>IPv4 and IPv6 separately</Term>, enriches remote IPs with geolocation and
            threat-blocklist data, and flags suspicious behavior (port scans, new devices, possible
            data exfiltration) as it happens. Everything updates instantly over a WebSocket — no refresh.
          </P>
        </Section>

        <Section title="Architecture" sub="two moving parts">
          <Pre>{ARCH_DIAGRAM}</Pre>
          <P>
            The <Term>Python monitor</Term> is the only piece that touches the network — it samples the
            NIC and enumerates connections, then POSTs that data to the dashboard. The
            <Term> Node.js dashboard</Term> stores it in SQLite, runs it through the analysis engines,
            and pushes the results to every open browser over a WebSocket.
          </P>
        </Section>

        <Section title="Data Pipeline" sub="how it works">
          <ul className="list-none">
            <Bullet label="Bandwidth tracking">
              The monitor samples byte counters every 2s. On Linux it reads <Term>/proc/net/netstat</Term> and
              <Term> /proc/net/snmp6</Term> for the exact IPv4/IPv6 split; on Windows it estimates from the
              per-family connection ratio.
            </Bullet>
            <Bullet label="Connection scanning">
              Every 5s <Term>psutil.net_connections()</Term> enumerates TCP/UDP sockets — protocol, family,
              local/remote address + port, status, and owning process.
            </Bullet>
            <Bullet label="Security engine">
              Server-side analysis flags new/unknown devices, suspicious ports (Metasploit, ADB, known C2),
              port scans, connection-count spikes, DNS anomalies, rapid reconnects, and unusual outbound
              volume (possible exfiltration).
            </Bullet>
            <Bullet label="Geo + threat intel">
              Remote IPs are enriched via GeoIP (ip-api.com, rate-limited & cached) and checked against free
              threat blocklists — powering the connection map and threat context on alerts.
            </Bullet>
            <Bullet label="Flow analyzer">
              Connections are classified by service (HTTP, DNS, SMTP, …) and aggregated into top talkers,
              by-service, by-device, and timeline views on the Traffic page.
            </Bullet>
            <Bullet label="Real-time push">
              New bandwidth samples, connections, and alerts are broadcast over WebSocket to all connected
              browsers the moment they arrive.
            </Bullet>
          </ul>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Dashboard" sub="/ home">
            <ul className="list-none">
              <Bullet label="KPI cards">Live down/up rates, active connections, and alert count, split by v4/v6.</Bullet>
              <Bullet label="Bandwidth chart">Real-time area chart, filterable All / IPv4 / IPv6.</Bullet>
              <Bullet label="Protocol split">Donut charts of the v4-vs-v6 bandwidth and connection ratio.</Bullet>
              <Bullet label="Connection map">Geo-located remote endpoints anchored to your home location.</Bullet>
              <Bullet label="Alerts + timeline">Live security-alert feed with dismiss controls and history.</Bullet>
              <Bullet label="Connections + devices">Active connection table and known-device roster with trust controls.</Bullet>
            </ul>
          </Section>

          <Section title="Traffic Analysis" sub="/ traffic">
            <ul className="list-none">
              <Bullet label="Traffic over time">Download/upload volume bucketed across the last hour.</Bullet>
              <Bullet label="By service">Bandwidth share per detected service type.</Bullet>
              <Bullet label="Top talkers">Highest-volume remote hosts by total bytes.</Bullet>
              <Bullet label="Per-device">Down/up/total and connection count for every device seen.</Bullet>
            </ul>
          </Section>
        </div>

        <Section title="Tech Stack" sub="under the hood">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] font-mono tracking-widest uppercase mb-1.5" style={{ color: "hsl(128 45% 40%)" }}>Frontend</div>
              <P>React · Vite · TypeScript · Tailwind · TanStack Query · Recharts · wouter</P>
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest uppercase mb-1.5" style={{ color: "hsl(128 45% 40%)" }}>Backend</div>
              <P>Node.js · Express · WebSocket (ws) · Drizzle ORM · SQLite</P>
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest uppercase mb-1.5" style={{ color: "hsl(128 45% 40%)" }}>Agent & Deploy</div>
              <P>Python 3 · psutil · systemd · Windows service · Docker Compose</P>
            </div>
          </div>
        </Section>

        <Section title="API Reference" sub={`${API_ROWS.length} endpoints`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderBottomColor: "rgba(0,230,65,0.12)" }}>
                  {["Method", "Endpoint", "Description"].map((h) => (
                    <th key={h} className="py-2 px-3 text-left font-mono text-[9px] tracking-widest uppercase"
                      style={{ color: "hsl(128 45% 36%)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {API_ROWS.map(([method, path, desc]) => (
                  <tr key={path} className="border-b" style={{ borderBottomColor: "rgba(0,230,65,0.06)" }}>
                    <td className="px-3 py-1.5 font-mono text-[10px] tracking-wider align-top"
                      style={{ color: "hsl(128 100% 50%)" }}>{method}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px] align-top" style={{ color: "hsl(128 80% 60%)" }}>{path}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px] opacity-60 align-top">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Running It" sub="quick start">
          <div className="text-[10px] font-mono tracking-widest uppercase mb-1.5" style={{ color: "hsl(128 45% 40%)" }}>Docker (recommended)</div>
          <Pre>{`docker compose up -d        # dashboard + monitor
# → http://localhost:8080`}</Pre>
          <div className="text-[10px] font-mono tracking-widest uppercase mb-1.5" style={{ color: "hsl(128 45% 40%)" }}>Linux (dev)</div>
          <Pre>{`npm install && npx drizzle-kit push
pip3 install psutil requests
sudo ./monitor/start-linux.sh   # sudo = full connection visibility`}</Pre>
          <div className="text-[10px] font-mono tracking-widest uppercase mb-1.5" style={{ color: "hsl(128 45% 40%)" }}>Windows</div>
          <Pre>{`npm run dev                     # dashboard
python monitor\\netwatch_monitor.py   # monitor (as Administrator)`}</Pre>
          <P>
            The monitor needs elevated privileges (<Term>sudo</Term> / Administrator, or
            <Term> CAP_NET_ADMIN</Term> / <Term>NET_RAW</Term> under Docker) to read <Term>/proc/net</Term> and
            enumerate every connection.
          </P>
        </Section>

        <Section title="Project Layout" sub="file map">
          <Pre>{STRUCTURE}</Pre>
        </Section>

        <div className="text-center py-4">
          <span className="text-[9px] font-mono tracking-widest uppercase opacity-30">
            // END OF MANUAL :: NetWatch — Network Surveillance
          </span>
        </div>

      </div>
    </div>
  );
}
