import { ArrowDown, ArrowUp, Wifi, AlertTriangle } from "lucide-react";
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
      sub: `v4: ${formatRate(s.ipv4.rateIn)}  v6: ${formatRate(s.ipv6.rateIn)}`,
      icon: ArrowDown,
      accentColor: "hsl(185 85% 40%)",
      glowColor: "rgba(0,200,210,0.35)",
      borderColor: "rgba(0,200,210,0.25)",
      testId: "download",
    },
    {
      label: "Upload",
      value: formatRate(s.totalRateOut),
      sub: `v4: ${formatRate(s.ipv4.rateOut)}  v6: ${formatRate(s.ipv6.rateOut)}`,
      icon: ArrowUp,
      accentColor: "hsl(38 100% 52%)",
      glowColor: "rgba(255,154,0,0.35)",
      borderColor: "rgba(255,154,0,0.25)",
      testId: "upload",
    },
    {
      label: "Connections",
      value: s.activeConnections.toString(),
      sub: `IPv4: ${s.ipv4Connections}  IPv6: ${s.ipv6Connections}`,
      icon: Wifi,
      accentColor: "hsl(270 65% 60%)",
      glowColor: "rgba(150,80,230,0.35)",
      borderColor: "rgba(150,80,230,0.25)",
      testId: "active-connections",
    },
    {
      label: "Alerts",
      value: s.undismissedAlerts.toString(),
      sub: s.undismissedAlerts > 0 ? "!! ACTION REQUIRED" : "ALL CLEAR",
      icon: AlertTriangle,
      accentColor: s.undismissedAlerts > 0 ? "hsl(0 90% 55%)" : "hsl(38 40% 40%)",
      glowColor: s.undismissedAlerts > 0 ? "rgba(255,60,60,0.4)" : "rgba(255,154,0,0.15)",
      borderColor: s.undismissedAlerts > 0 ? "rgba(255,60,60,0.3)" : "rgba(255,154,0,0.15)",
      testId: "alerts",
      pulse: s.undismissedAlerts > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`cyber-corners relative border bg-card p-4 ${c.pulse ? "animate-red-pulse" : ""}`}
          style={{
            borderRadius: "2px",
            borderColor: c.borderColor,
            boxShadow: `0 0 12px ${c.glowColor}, inset 0 0 20px rgba(0,0,0,0.4)`,
          }}
        >
          {/* Top bar accent */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(to right, transparent, ${c.accentColor}, transparent)`, opacity: 0.6 }} />

          {/* Label + Icon */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono tracking-widest uppercase opacity-60">
              {c.label}
            </span>
            <c.icon className="w-3.5 h-3.5" style={{ color: c.accentColor, filter: `drop-shadow(0 0 4px ${c.glowColor})` }} />
          </div>

          {/* Value */}
          <div className="font-mono text-2xl font-bold tabular-nums leading-none mb-1.5"
            data-testid={`text-kpi-${c.testId}`}
            style={{ color: c.accentColor, textShadow: `0 0 12px ${c.glowColor}` }}>
            {c.value}
          </div>

          {/* Sub */}
          <div className="text-[10px] font-mono opacity-50 tracking-wide tabular-nums">{c.sub}</div>

          {/* Bottom-right bracket extra (decorative) */}
          <div className="absolute bottom-2 left-3 text-[8px] font-mono opacity-20"
            style={{ color: c.accentColor }}>
            [{c.label.toUpperCase().slice(0,3)}]
          </div>
        </div>
      ))}
    </div>
  );
}
