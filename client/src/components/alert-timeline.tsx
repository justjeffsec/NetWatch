import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Clock } from "lucide-react";
import type { Alert } from "@shared/schema";

interface Props {
  alerts: Alert[];
}

/** Group alerts into time buckets and count by severity */
function bucketAlerts(alerts: Alert[]) {
  if (alerts.length === 0) return [];

  const now = Date.now();
  const bucketSize = 5 * 60_000; // 5-minute buckets
  const windowMs = 60 * 60_000; // 1 hour lookback
  const bucketCount = Math.ceil(windowMs / bucketSize);

  const buckets: { time: string; critical: number; warning: number; info: number; ts: number }[] = [];

  for (let i = bucketCount - 1; i >= 0; i--) {
    const bucketStart = now - (i + 1) * bucketSize;
    const bucketEnd = now - i * bucketSize;
    const d = new Date(bucketEnd);
    const label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const inBucket = alerts.filter(
      (a) => a.timestamp >= bucketStart && a.timestamp < bucketEnd
    );

    buckets.push({
      time: label,
      ts: bucketEnd,
      critical: inBucket.filter((a) => a.severity === "critical").length,
      warning: inBucket.filter((a) => a.severity === "warning").length,
      info: inBucket.filter((a) => a.severity === "info").length,
    });
  }

  return buckets;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
  if (total === 0) return null;

  return (
    <div className="bg-card/95 backdrop-blur border border-border rounded-md px-3 py-2 shadow-lg">
      <p className="text-[11px] font-mono text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) =>
        p.value > 0 ? (
          <p key={p.dataKey} className="text-[11px]" style={{ color: p.fill }}>
            {p.dataKey}: {p.value}
          </p>
        ) : null
      )}
    </div>
  );
};

export function AlertTimeline({ alerts }: Props) {
  const data = useMemo(() => bucketAlerts(alerts), [alerts]);

  const totalCritical = data.reduce((s, d) => s + d.critical, 0);
  const totalWarning = data.reduce((s, d) => s + d.warning, 0);
  const totalInfo = data.reduce((s, d) => s + d.info, 0);
  const hasData = totalCritical + totalWarning + totalInfo > 0;

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Alert Timeline</CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-slate-500/10 text-slate-400 border-slate-500/15"
            >
              last hour
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {totalCritical > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-400 border-red-500/20">
                {totalCritical} critical
              </Badge>
            )}
            {totalWarning > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400 border-amber-500/20">
                {totalWarning} warning
              </Badge>
            )}
            <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0">
        {!hasData ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-xs">No alerts in the last hour</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} barCategoryGap="15%">
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: "hsl(215,15%,45%)" }}
                axisLine={{ stroke: "hsl(215,15%,20%)" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: "hsl(215,15%,45%)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={24}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(215,20%,15%)" }} />
              <Bar dataKey="critical" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
              <Bar dataKey="warning" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="info" stackId="a" fill="#38bdf8" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
