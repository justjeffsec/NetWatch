import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Info,
  AlertOctagon,
  X,
  CheckCheck,
  Shield,
  Activity,
  Network,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import type { Alert } from "@shared/schema";

interface Props {
  alerts: Alert[];
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  threshold: "Threshold",
  spike: "Spike",
  new_device: "New Device",
  suspicious_port: "Suspicious Port",
  connection_spike: "Conn Spike",
  port_scan: "Port Scan",
  dns_anomaly: "DNS Anomaly",
  rapid_reconnect: "Rapid Reconnect",
  unusual_protocol: "Protocol",
  large_transfer: "Large Transfer",
  geo_anomaly: "Geo Anomaly",
};

export function AlertsPanel({ alerts, onDismiss, onDismissAll }: Props) {
  const active = alerts.filter((a) => !a.dismissed);

  const severityIcon = (s: string) => {
    switch (s) {
      case "critical":
        return <AlertOctagon className="w-3.5 h-3.5 text-red-400" />;
      case "warning":
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Info className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  const severityBadge = (s: string) => {
    switch (s) {
      case "critical":
        return "bg-red-500/15 text-red-400 border-red-500/20";
      case "warning":
        return "bg-amber-500/15 text-amber-400 border-amber-500/20";
      default:
        return "bg-sky-500/15 text-sky-400 border-sky-500/20";
    }
  };

  const categoryIcon = (cat: string | null) => {
    switch (cat) {
      case "security":
        return <Shield className="w-3 h-3 text-rose-400/70" />;
      case "performance":
        return <Activity className="w-3 h-3 text-amber-400/70" />;
      default:
        return <Network className="w-3 h-3 text-sky-400/70" />;
    }
  };

  const typeBadgeClass = (type: string) => {
    // Security-related types get a distinct color
    if (["suspicious_port", "port_scan", "new_device", "rapid_reconnect", "dns_anomaly"].includes(type)) {
      return "bg-rose-500/10 text-rose-400/80 border-rose-500/15";
    }
    if (["large_transfer", "unusual_protocol"].includes(type)) {
      return "bg-purple-500/10 text-purple-400/80 border-purple-500/15";
    }
    return "bg-slate-500/10 text-slate-400/80 border-slate-500/15";
  };

  const criticalCount = active.filter((a) => a.severity === "critical").length;

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            {active.length > 0 && (
              <Badge
                variant="destructive"
                className="text-[10px] px-1.5 py-0"
              >
                {active.length}
              </Badge>
            )}
            {criticalCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-400 border-red-500/20 animate-pulse"
              >
                {criticalCount} critical
              </Badge>
            )}
          </div>
          {active.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={onDismissAll}
              data-testid="button-dismiss-all"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Dismiss all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ScrollArea className="h-[280px]">
          {active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCheck className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No active alerts</p>
            </div>
          ) : (
            <div className="space-y-0">
              {active.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors group ${
                    a.severity === "critical" ? "bg-red-500/[0.03]" : ""
                  }`}
                  data-testid={`alert-item-${a.id}`}
                >
                  <div className="mt-0.5">{severityIcon(a.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-xs font-medium truncate">
                        {a.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 ${severityBadge(a.severity)}`}
                      >
                        {a.severity}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 ${typeBadgeClass(a.type)}`}
                      >
                        {TYPE_LABELS[a.type] || a.type}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                      {a.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {a.category && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                          {categoryIcon(a.category)}
                          {a.category}
                        </span>
                      )}
                      {a.sourceIp && (
                        <span className="text-[10px] text-muted-foreground/60 font-mono">
                          {a.sourceIp}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {timeAgo(a.timestamp)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onDismiss(a.id)}
                    data-testid={`button-dismiss-${a.id}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
