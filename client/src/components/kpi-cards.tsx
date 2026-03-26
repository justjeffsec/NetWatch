import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Wifi, AlertTriangle, Globe, Globe2 } from "lucide-react";
import { formatRate } from "@/lib/format";

interface Stats {
  totalRateIn: number;
  totalRateOut: number;
  ipv4: { rateIn: number; rateOut: number };
  ipv6: { rateIn: number; rateOut: number };
  activeConnections: number;
  ipv4Connections: number;
  ipv6Connections: number;
  undismissedAlerts: number;
}

export function KpiCards({ stats }: { stats: Stats | null }) {
  const s = stats || {
    totalRateIn: 0, totalRateOut: 0,
    ipv4: { rateIn: 0, rateOut: 0 },
    ipv6: { rateIn: 0, rateOut: 0 },
    activeConnections: 0, ipv4Connections: 0, ipv6Connections: 0,
    undismissedAlerts: 0,
  };

  const cards = [
    {
      label: "Download",
      value: formatRate(s.totalRateIn),
      sub: `v4: ${formatRate(s.ipv4.rateIn)} / v6: ${formatRate(s.ipv6.rateIn)}`,
      icon: ArrowDown,
      color: "text-emerald-400",
    },
    {
      label: "Upload",
      value: formatRate(s.totalRateOut),
      sub: `v4: ${formatRate(s.ipv4.rateOut)} / v6: ${formatRate(s.ipv6.rateOut)}`,
      icon: ArrowUp,
      color: "text-sky-400",
    },
    {
      label: "Active Connections",
      value: s.activeConnections.toString(),
      sub: `IPv4: ${s.ipv4Connections} / IPv6: ${s.ipv6Connections}`,
      icon: Wifi,
      color: "text-violet-400",
    },
    {
      label: "Alerts",
      value: s.undismissedAlerts.toString(),
      sub: s.undismissedAlerts > 0 ? "Action needed" : "All clear",
      icon: AlertTriangle,
      color: s.undismissedAlerts > 0 ? "text-amber-400" : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="border-card-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className="font-mono text-xl font-semibold tabular-nums" data-testid={`text-kpi-${c.label.toLowerCase().replace(/\s/g, '-')}`}>
              {c.value}
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-1 tabular-nums">{c.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
