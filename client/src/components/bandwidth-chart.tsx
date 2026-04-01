import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatBytes, formatTimestamp } from "@/lib/format";
import type { BandwidthSnapshot } from "@shared/schema";

// Terminal green palette
const C_AMBER      = "hsl(128, 100%, 45%)";
const C_ORANGE     = "hsl(90, 100%, 48%)";
const C_TEAL       = "hsl(150, 80%, 40%)";
const C_TEAL_LIGHT = "hsl(150, 70%, 52%)";

interface Props { data: BandwidthSnapshot[]; }

function prepareChartData(data: BandwidthSnapshot[], filter?: string) {
  const byTimestamp = new Map<number, any>();
  for (const d of data) {
    if (filter && d.protocol !== filter) continue;
    const key = Math.floor(d.timestamp / 2000) * 2000;
    if (!byTimestamp.has(key)) {
      byTimestamp.set(key, { timestamp: key, v4In: 0, v4Out: 0, v6In: 0, v6Out: 0 });
    }
    const entry = byTimestamp.get(key);
    if (d.protocol === "ipv4") { entry.v4In = d.rateIn; entry.v4Out = d.rateOut; }
    else if (d.protocol === "ipv6") { entry.v6In = d.rateIn; entry.v6Out = d.rateOut; }
  }
  return Array.from(byTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp).slice(-60);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="border font-mono text-xs shadow-lg px-3 py-2"
      style={{ background: "hsl(128 90% 2%)", borderColor: "rgba(0,230,65,0.3)", borderRadius: "2px",
               boxShadow: "0 0 12px rgba(0,230,65,0.2)" }}>
      <p className="text-[10px] tracking-wider uppercase mb-1.5" style={{ color: "hsl(128 50% 40%)" }}>
        {formatTimestamp(label)}
      </p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-[11px] tabular-nums" style={{ color: p.color }}>
          {p.name}: {formatBytes(p.value)}/s
        </p>
      ))}
    </div>
  );
};

function ChartView({ data, filter }: { data: BandwidthSnapshot[]; filter?: string }) {
  const chartData = prepareChartData(data, filter);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="v4InGrad"  x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C_AMBER} stopOpacity={0.35} />
            <stop offset="95%" stopColor={C_AMBER} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="v4OutGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C_ORANGE} stopOpacity={0.3} />
            <stop offset="95%" stopColor={C_ORANGE} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="v6InGrad"  x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C_TEAL} stopOpacity={0.35} />
            <stop offset="95%" stopColor={C_TEAL} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="v6OutGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C_TEAL_LIGHT} stopOpacity={0.3} />
            <stop offset="95%" stopColor={C_TEAL_LIGHT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,230,65,0.07)" />
        <XAxis dataKey="timestamp" tickFormatter={formatTimestamp}
          stroke="rgba(0,230,65,0.2)"
          tick={{ fontSize: 10, fontFamily: "'Share Tech Mono',monospace", fill: "hsl(128 40% 36%)" }}
          interval="preserveStartEnd" />
        <YAxis tickFormatter={(v) => formatBytes(v)}
          stroke="rgba(0,230,65,0.2)"
          tick={{ fontSize: 10, fontFamily: "'Share Tech Mono',monospace", fill: "hsl(128 40% 36%)" }}
          width={62} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'Share Tech Mono',monospace" }} />
        {(!filter || filter === "ipv4") && (
          <>
            <Area type="monotone" dataKey="v4In"  name="IPv4 ↓" stroke={C_AMBER}      fill="url(#v4InGrad)"  strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="v4Out" name="IPv4 ↑" stroke={C_ORANGE}     fill="url(#v4OutGrad)" strokeWidth={1.5} dot={false} />
          </>
        )}
        {(!filter || filter === "ipv6") && (
          <>
            <Area type="monotone" dataKey="v6In"  name="IPv6 ↓" stroke={C_TEAL}       fill="url(#v6InGrad)"  strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="v6Out" name="IPv6 ↑" stroke={C_TEAL_LIGHT} fill="url(#v6OutGrad)" strokeWidth={1.5} dot={false} />
          </>
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BandwidthChart({ data }: Props) {
  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-sm" style={{ background: "hsl(128 100% 45%)", boxShadow: "0 0 6px rgba(0,230,65,0.6)" }} />
          <CardTitle className="text-[11px] font-mono tracking-widest uppercase opacity-80">
            Bandwidth Usage
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-2 ml-2">
            <TabsTrigger value="all"  data-testid="tab-all"  className="text-[10px] tracking-widest uppercase font-mono">All</TabsTrigger>
            <TabsTrigger value="ipv4" data-testid="tab-ipv4" className="text-[10px] tracking-widest uppercase font-mono">IPv4</TabsTrigger>
            <TabsTrigger value="ipv6" data-testid="tab-ipv6" className="text-[10px] tracking-widest uppercase font-mono">IPv6</TabsTrigger>
          </TabsList>
          <TabsContent value="all">  <ChartView data={data} /></TabsContent>
          <TabsContent value="ipv4"> <ChartView data={data} filter="ipv4" /></TabsContent>
          <TabsContent value="ipv6"> <ChartView data={data} filter="ipv6" /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
