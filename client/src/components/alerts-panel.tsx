import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle, Info, AlertOctagon, X, CheckCheck,
  Shield, Activity, Network, Bell, BellOff, Download, FileJson, FileSpreadsheet,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import {
  requestNotificationPermission, sendBrowserNotification,
  playAlertTone, exportAlertsCsv, exportAlertsJson,
} from "@/lib/notifications";
import type { Alert } from "@shared/schema";

interface Props {
  alerts: Alert[];
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  threshold: "THRESHOLD", spike: "SPIKE", new_device: "NEW DEV",
  suspicious_port: "SUSP PORT", connection_spike: "CONN SPIKE",
  port_scan: "PORT SCAN", dns_anomaly: "DNS ANOM", rapid_reconnect: "RECONNECT",
  unusual_protocol: "PROTOCOL", large_transfer: "XFER", geo_anomaly: "GEO ANOM",
  unusual_outbound: "OUTBOUND",
};

export function AlertsPanel({ alerts, onDismiss, onDismissAll }: Props) {
  const active = alerts.filter((a) => !a.dismissed);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const prevAlertCount = useRef(active.length);

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (active.length > prevAlertCount.current) {
      const newest = active[0];
      if (newest) { sendBrowserNotification(`NetWatch: ${newest.title}`, newest.message, newest.severity); playAlertTone(newest.severity); }
    }
    prevAlertCount.current = active.length;
  }, [active.length, notificationsEnabled, active]);

  const toggleNotifications = async () => {
    if (notificationsEnabled) { setNotificationsEnabled(false); return; }
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) playAlertTone("warning");
  };

  const severityConfig = (s: string) => {
    switch (s) {
      case "critical": return {
        icon: <AlertOctagon className="w-3.5 h-3.5" style={{ color: "#ff4040", filter: "drop-shadow(0 0 4px rgba(255,40,40,0.8))" }} />,
        badge: "border text-[9px] px-1 py-0 font-mono tracking-widest",
        badgeStyle: { borderColor: "rgba(255,40,40,0.4)", background: "rgba(255,40,40,0.12)", color: "#ff6060" },
        rowClass: "animate-red-pulse",
        rowStyle: { background: "rgba(255,30,30,0.04)", borderLeft: "2px solid rgba(255,60,60,0.4)" },
      };
      case "warning": return {
        icon: <AlertTriangle className="w-3.5 h-3.5" style={{ color: "hsl(128 100% 50%)", filter: "drop-shadow(0 0 3px rgba(0,230,65,0.7))" }} />,
        badge: "border text-[9px] px-1 py-0 font-mono tracking-widest",
        badgeStyle: { borderColor: "rgba(0,230,65,0.35)", background: "rgba(0,230,65,0.10)", color: "hsl(128 100% 55%)" },
        rowClass: "",
        rowStyle: { borderLeft: "2px solid rgba(0,230,65,0.3)" },
      };
      default: return {
        icon: <Info className="w-3.5 h-3.5" style={{ color: "hsl(150 80% 48%)" }} />,
        badge: "border text-[9px] px-1 py-0 font-mono tracking-widest",
        badgeStyle: { borderColor: "rgba(0,200,100,0.3)", background: "rgba(0,200,100,0.08)", color: "hsl(150 80% 52%)" },
        rowClass: "",
        rowStyle: { borderLeft: "2px solid rgba(0,200,210,0.2)" },
      };
    }
  };

  const typeBadgeStyle = (type: string) => {
    if (["suspicious_port","port_scan","new_device","rapid_reconnect","dns_anomaly"].includes(type))
      return { borderColor: "rgba(255,80,80,0.25)", background: "rgba(255,50,50,0.08)", color: "#ff8080" };
    if (["large_transfer","unusual_protocol","unusual_outbound"].includes(type))
      return { borderColor: "rgba(150,80,230,0.25)", background: "rgba(150,80,230,0.08)", color: "#c090ff" };
    return { borderColor: "rgba(0,230,65,0.2)", background: "rgba(0,230,65,0.06)", color: "hsl(128 60% 55%)" };
  };

  const categoryIcon = (cat: string | null) => {
    switch (cat) {
      case "security":    return <Shield className="w-3 h-3" style={{ color: "#ff7070" }} />;
      case "performance": return <Activity className="w-3 h-3" style={{ color: "hsl(128 100% 50%)" }} />;
      default:            return <Network className="w-3 h-3" style={{ color: "hsl(150 80% 48%)" }} />;
    }
  };

  const criticalCount = active.filter((a) => a.severity === "critical").length;

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-sm" style={{ background: criticalCount > 0 ? "#ff4040" : "hsl(128 100% 45%)", boxShadow: criticalCount > 0 ? "0 0 6px rgba(255,40,40,0.7)" : "0 0 6px rgba(0,230,65,0.5)" }} />
            <CardTitle className="text-[11px] font-mono tracking-widest uppercase opacity-80">Alerts</CardTitle>
            {active.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 border"
                style={{ borderRadius:"2px", borderColor:"rgba(0,230,65,0.3)", background:"rgba(0,230,65,0.1)", color:"hsl(128 100% 55%)" }}>
                {active.length}
              </span>
            )}
            {criticalCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 border animate-red-pulse"
                style={{ borderRadius:"2px", borderColor:"rgba(255,40,40,0.4)", background:"rgba(255,40,40,0.12)", color:"#ff6060" }}>
                {criticalCount} CRIT
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm"
              className={`h-6 w-6 p-0 ${notificationsEnabled ? "text-green-400" : ""}`}
              style={{ color: notificationsEnabled ? "#4ade80" : "hsl(128 30% 36%)" }}
              onClick={toggleNotifications}
              title={notificationsEnabled ? "Notifications on" : "Enable notifications"}>
              {notificationsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            </Button>
            <div className="relative">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                style={{ color: "hsl(128 30% 36%)" }}
                onClick={() => setShowExport(!showExport)} title="Export alerts">
                <Download className="w-3.5 h-3.5" />
              </Button>
              {showExport && (
                <div className="absolute right-0 top-7 z-50 border p-1 space-y-0.5 min-w-[120px]"
                  style={{ background:"hsl(128 90% 3%)", borderColor:"rgba(0,230,65,0.25)", borderRadius:"2px", boxShadow:"0 0 12px rgba(0,230,65,0.15)" }}>
                  <Button variant="ghost" size="sm" className="h-7 w-full justify-start text-[11px] px-2 font-mono"
                    style={{ color:"hsl(128 70% 52%)" }}
                    onClick={() => { exportAlertsCsv(alerts); setShowExport(false); }}>
                    <FileSpreadsheet className="w-3 h-3 mr-1.5" /> Export CSV
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-full justify-start text-[11px] px-2 font-mono"
                    style={{ color:"hsl(128 70% 52%)" }}
                    onClick={() => { exportAlertsJson(alerts); setShowExport(false); }}>
                    <FileJson className="w-3 h-3 mr-1.5" /> Export JSON
                  </Button>
                </div>
              )}
            </div>
            {active.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] font-mono tracking-widest uppercase px-2"
                style={{ color: "hsl(128 40% 40%)" }}
                onClick={onDismissAll} data-testid="button-dismiss-all">
                <CheckCheck className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ScrollArea className="h-[260px]">
          {active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10"
              style={{ color: "hsl(128 30% 34%)" }}>
              <CheckCheck className="w-7 h-7 mb-2 opacity-40" />
              <p className="text-[11px] font-mono tracking-widest uppercase">// No Active Alerts</p>
            </div>
          ) : (
            <div className="space-y-0">
              {active.map((a) => {
                const cfg = severityConfig(a.severity);
                return (
                  <div key={a.id}
                    className={`flex items-start gap-3 px-4 py-2.5 border-b group transition-all ${cfg.rowClass}`}
                    style={{ borderBottomColor:"rgba(0,230,65,0.08)", ...cfg.rowStyle }}
                    data-testid={`alert-item-${a.id}`}>
                    <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-[11px] font-mono tracking-wide" style={{ color: "hsl(128 80% 60%)" }}>
                          {a.title}
                        </span>
                        <span className={cfg.badge} style={{ ...cfg.badgeStyle, borderRadius:"2px" }}>{a.severity.toUpperCase()}</span>
                        <span className="border text-[9px] px-1 py-0 font-mono tracking-widest" style={{ ...typeBadgeStyle(a.type), borderRadius:"2px" }}>
                          {TYPE_LABELS[a.type] || a.type.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono leading-relaxed" style={{ color: "hsl(128 30% 40%)" }}>
                        {a.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {a.category && (
                          <span className="flex items-center gap-0.5 text-[9px] font-mono opacity-50">
                            {categoryIcon(a.category)}{a.category.toUpperCase()}
                          </span>
                        )}
                        {a.sourceIp && (
                          <span className="text-[9px] font-mono opacity-50">{a.sourceIp}</span>
                        )}
                        <span className="text-[9px] font-mono opacity-40 tabular-nums">{timeAgo(a.timestamp)}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm"
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      style={{ color: "hsl(128 50% 45%)" }}
                      onClick={() => onDismiss(a.id)}
                      data-testid={`button-dismiss-${a.id}`}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
