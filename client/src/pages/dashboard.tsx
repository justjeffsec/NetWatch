import { useState, useCallback } from "react";
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
import { Wifi, WifiOff, Sun, Moon, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import type { BandwidthSnapshot, Connection, Alert } from "@shared/schema";

export default function Dashboard() {
  const [bandwidth, setBandwidth] = useState<BandwidthSnapshot[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();

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
          // Keep last 2 minutes
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

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Network Monitor</h1>
          <Badge 
            variant="outline" 
            className={`text-[10px] px-1.5 py-0 font-mono ${connected ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'}`}
            data-testid="status-connection"
          >
            {connected ? (
              <><Wifi className="w-2.5 h-2.5 mr-1" /> Live</>
            ) : (
              <><WifiOff className="w-2.5 h-2.5 mr-1" /> Offline</>
            )}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/traffic")}
            title="Traffic Analysis"
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            <span className="text-xs hidden sm:inline">Traffic</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <KpiCards stats={stats as any} />

      {/* Charts row */}
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

      {/* Connection map + Alert timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ConnectionMap />
        </div>
        <AlertTimeline alerts={alerts} />
      </div>

      {/* Connections table + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ConnectionsTable connections={connections} />
        </div>
        <DevicesPanel />
      </div>
    </div>
  );
}
