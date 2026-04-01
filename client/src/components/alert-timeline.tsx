import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Clock } from "lucide-react";
import type { Alert } from "@shared/schema";

interface Props { alerts: Alert[]; }

function bucketAlerts(alerts: Alert[]) {
  if (alerts.length === 0) return [];
  const now = Date.now();
  const bucketSize = 5 * 60_000;
  const windowMs   = 60 * 60_000;
  const bucketCount = Math.ceil(windowMs / bucketSize);
  const buckets: { time: string; critical: number; warning: number; info: number; ts: number }[] = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const bucketStart = now - (i + 1) * bucketSize;
    const bucketEnd   = now - i * bucketSize;
    const label = new Date(bucketEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const inBucket = alerts.filter((a) => a.timestamp >= bucketStart && a.timestamp < bucketEnd);
    buckets.push({
      time: label, ts: bucketEnd,
      critical: inBucket.filter((a) => a.severity === "critical").length,
      warning:  inBucket.filter((a) => a.severity === "warning").length,
      info:     inBucket.filter((a) => a.severity === "info").length,
    });
  }
  return buckets;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
  if (total === 0) return null;
  return (
    <div className="border font-mono text-[11px] px-3 py-2"
      style={{ background: "hsl(128 90% 2%)", borderColor: "rgba(0,230,65,0.25)", borderRadius: "2px", boxShadow: "0 0 10px rgba(0,230,65,0.15)" }}>
      <p className="text-[10px] tracking-wider uppercase mb-1" style={{ color: "hsl(128 40% 40%)" }}>{label}</p>
      {payload.map((p: any) => p.value > 0 ? (
        <p key={p.dataKey} className="text-[11px]" style={{ color: p.fill }}>
          {p.dataKey}: {p.value}
        </p>
      ) : null)}
    </div>
  );
};

export function AlertTimeline({ alerts }: Props) {
  const data = useMemo(() => bucketAlerts(alerts), [alerts]);
  const totalCritical = data.reduce((s, d) => s + d.critical, 0);
  const totalWarning  = data.reduce((s, d) => s + d.warning, 0);
  const hasData = totalCritical + totalWarning + data.reduce((s, d) => s + d.info, 0) > 0;

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-sm" style={{ background: "hsl(0 90% 52%)", boxShadow: "0 0 6px rgba(255,60,60,0.5)" }} />
            <CardTitle className="text-[11px] font-mono tracking-widest uppercase opacity-80">Alert Timeline</CardTitle>
            <span className="border text-[9px] px-1.5 py-0.5 font-mono tracking-widest"
              style={{ borderRadius:"2px", borderColor:"rgba(0,230,65,0.2)", background:"rgba(0,230,65,0.06)", color:"hsl(128 50% 45%)" }}>
              1hr
            </span>
          </div>
          <div className="flex items-center gap-2">
            {totalCritical > 0 && (
              <span className="border text-[9px] px-1.5 py-0.5 font-mono tracking-widest"
                style={{ borderRadius:"2px", borderColor:"rgba(255,40,40,0.35)", background:"rgba(255,40,40,0.1)", color:"#ff6060" }}>
                {totalCritical} crit
              </span>
            )}
            {totalWarning > 0 && (
              <span className="border text-[9px] px-1.5 py-0.5 font-mono tracking-widest"
                style={{ borderRadius:"2px", borderColor:"rgba(0,230,65,0.3)", background:"rgba(0,230,65,0.08)", color:"hsl(128 100% 55%)" }}>
                {totalWarning} warn
              </span>
            )}
            <Clock className="w-3 h-3 opacity-30" style={{ color: "hsl(128 50% 45%)" }} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-3 pt-0">
        {!hasData ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-[11px] font-mono tracking-widest uppercase opacity-40">// No alerts in last hour</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={data} barCategoryGap="15%">
              <XAxis dataKey="time"
                tick={{ fontSize: 9, fill: "hsl(128 35% 34%)", fontFamily: "'Share Tech Mono',monospace" }}
                axisLine={{ stroke: "rgba(0,230,65,0.15)" }}
                tickLine={false}
                interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 9, fill: "hsl(128 35% 34%)", fontFamily: "'Share Tech Mono',monospace" }}
                axisLine={false} tickLine={false} allowDecimals={false} width={22} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,230,65,0.05)" }} />
              <Bar dataKey="critical" stackId="a" fill="#ff3030" radius={[0,0,0,0]} />
              <Bar dataKey="warning"  stackId="a" fill="hsl(128,100%,45%)" radius={[0,0,0,0]} />
              <Bar dataKey="info"     stackId="a" fill="hsl(150,80%,40%)" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
