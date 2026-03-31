import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { KpiCards } from "@/components/kpi-cards";
import { BandwidthChart } from "@/components/bandwidth-chart";
import { ConnectionsTable } from "@/components/connections-table";
import { AlertsPanel } from "@/components/alerts-panel";
import { ProtocolSplit } from "@/components/protocol-split";
import { DevicesPanel } from "@/components/devices-panel";
import { ConnectionMap } from "@/components/connection-map";
import { AlertTimeline } from "@/components/alert-timeline";
import { useWebSocket } from "@/lib/useWebSocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTheme } from "@/lib/theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, BarChart3, Radio } from "lucide-react";
import { useLocation } from "wouter";
import type { BandwidthSnapshot, Connection, Alert } from "@shared/schema";

export default function Dashboard() {
  const [bandwidth, setBandwidth] = useState<BandwidthSnapshot[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString());
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 3000,
  });

  const handleWsMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case "init":
        setBandwidth(msg.data.bandwidth || []);
        setConnections(msg.data.connections || []);
        setAlerts(msg.data.alerts || []);
        break;
      case "bandwidth":
        setBandwidth((prev) => {
          const next = [...prev];
          if (msg.data.ipv4) next.push(msg.data.ipv4);
          if (msg.data.ipv6) next.push(msg.data.ipv6);
          const cutoff = Date.now() - 120_000;
          return next.filter((s) => s.timestamp > cutoff);
        });
        refetchStats();
        break;
      case "connection":
        setConnections((prev) => [msg.data, ...prev].slice(0, 200));
        break;
      case "alert":
        setAlerts((prev) => [msg.data, ...prev].slice(0, 100));
        refetchStats();
        break;
    }
  }, [refetchStats]);

  const { connected } = useWebSocket(handleWsMessage);

  const dismissAlert = async (id: number) => {
    await apiRequest("PATCH", `/api/alerts/${id}/dismiss`);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, dismissed: 1 } : a));
    refetchStats();
  };

  const dismissAll = async () => {
    await apiRequest("POST", "/api/alerts/dismiss-all");
    setAlerts((prev) => prev.map((a) => ({ ...a, dismissed: 1 })));
    refetchStats();
  };

  const activeAlerts = alerts.filter(a => !a.dismissed);

  return (
    <div className="h-full overflow-y-auto cyber-grid" style={{ background: "hsl(26 95% 3%)" }}>
      {/* ── TOP NAV BAR ── */}
      <div className="sticky top-0 z-50 border-b border-border/60"
        style={{ background: "hsl(26 95% 2.5%)", boxShadow: "0 1px 16px rgba(255,154,0,0.1)" }}>
        <div className="flex items-center justify-between px-4 py-2">

          {/* Left: logo + title */}
          <div className="flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className="animate-glitch"
              style={{ color: "hsl(38 100% 52%)", filter: "drop-shadow(0 0 5px rgba(255,154,0,0.8))" }}>
              <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <line x1="12" y1="7" x2="12" y2="10.5" />
              <line x1="10.7" y1="13.2" x2="6.5" y2="17.5" />
              <line x1="13.3" y1="13.2" x2="17.5" y2="17.5" />
            </svg>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-mono font-bold tracking-widest uppercase animate-glitch-text"
                style={{ color: "hsl(38 100% 60%)", textShadow: "0 0 10px rgba(255,154,0,0.6)", fontFamily: "'Orbitron', monospace" }}>
                NetWatch
              </span>
              <span className="text-[9px] font-mono tracking-widest opacity-50 uppercase">
                Network Surveillance
              </span>
            </div>

            {/* Live / Offline badge */}
            <div className={`flex items-center gap-1.5 px-2 py-0.5 border font-mono text-[10px] tracking-widest uppercase
              ${connected
                ? "border-green-600/40 bg-green-900/20 text-green-400"
                : "border-red-600/40 bg-red-900/20 text-red-400 animate-red-pulse"
              }`}
              style={{ borderRadius: "2px" }}>
              {connected ? (
                <><Radio className="w-2.5 h-2.5" style={{ animation: "blink-cursor 1.2s step-end infinite" }} /> Live</>
              ) : (
                <><WifiOff className="w-2.5 h-2.5" /> Offline</>
              )}
            </div>

            {/* Alert count */}
            {activeAlerts.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 border font-mono text-[10px] tracking-widest uppercase animate-red-pulse"
                style={{ borderRadius: "2px", borderColor: "rgba(255,60,60,0.4)", background: "rgba(255,40,40,0.1)", color: "#ff6060" }}>
                ⚠ {activeAlerts.length} alert{activeAlerts.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Right: nav + clock */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm"
              className="h-7 px-3 font-mono text-[11px] tracking-widest uppercase border border-transparent hover:border-primary/30"
              style={{ color: "hsl(38 70% 55%)" }}
              onClick={() => navigate("/traffic")}>
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
              Traffic
            </Button>

            <div className="h-4 w-px bg-border/60" />

            <span className="text-[11px] font-mono tabular-nums glow-amber"
              style={{ color: "hsl(38 100% 60%)", minWidth: "80px", textAlign: "right" }}>
              {clock}
            </span>
          </div>
        </div>

        {/* Sub-header: system status line */}
        <div className="px-4 pb-1.5 flex items-center gap-4">
          <span className="text-[9px] font-mono tracking-widest uppercase opacity-40">
            // SURVEILLANCE ACTIVE :: MONITORING ALL INTERFACES
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
          <span className="text-[9px] font-mono opacity-30 tabular-nums">
            {new Date().toLocaleDateString('en-US', { year:'numeric', month:'2-digit', day:'2-digit' })}
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="p-4 space-y-4">
        <KpiCards stats={stats as any} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <BandwidthChart data={bandwidth} />
          </div>
          <div className="space-y-4">
            <ProtocolSplit
              ipv4In={(stats as any)?.ipv4?.rateIn || 0}
              ipv4Out={(stats as any)?.ipv4?.rateOut || 0}
              ipv6In={(stats as any)?.ipv6?.rateIn || 0}
              ipv6Out={(stats as any)?.ipv6?.rateOut || 0}
              ipv4Conns={(stats as any)?.ipv4Connections || 0}
              ipv6Conns={(stats as any)?.ipv6Connections || 0}
            />
            <AlertsPanel alerts={alerts} onDismiss={dismissAlert} onDismissAll={dismissAll} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ConnectionMap />
          </div>
          <AlertTimeline alerts={alerts} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ConnectionsTable connections={connections} />
          </div>
          <DevicesPanel />
        </div>
      </div>
    </div>
  );
}
