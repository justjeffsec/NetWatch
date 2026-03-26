import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatBytes, formatTimestamp } from "@/lib/format";
import type { BandwidthSnapshot } from "@shared/schema";

interface Props {
  data: BandwidthSnapshot[];
}

function prepareChartData(data: BandwidthSnapshot[], filter?: string) {
  const byTimestamp = new Map<number, any>();

  for (const d of data) {
    if (filter && d.protocol !== filter) continue;
    const key = Math.floor(d.timestamp / 2000) * 2000;
    if (!byTimestamp.has(key)) {
      byTimestamp.set(key, { timestamp: key, v4In: 0, v4Out: 0, v6In: 0, v6Out: 0 });
    }
    const entry = byTimestamp.get(key);
    if (d.protocol === "ipv4") {
      entry.v4In = d.rateIn;
      entry.v4Out = d.rateOut;
    } else if (d.protocol === "ipv6") {
      entry.v6In = d.rateIn;
      entry.v6Out = d.rateOut;
    }
  }

  return Array.from(byTimestamp.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-60);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-popover border border-popover-border rounded-md p-3 text-xs font-mono shadow-lg">
      <p className="text-muted-foreground mb-1">{formatTimestamp(label)}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatBytes(p.value)}/s
        </p>
      ))}
    </div>
  );
};

function ChartView({ data, filter }: { data: BandwidthSnapshot[]; filter?: string }) {
  const chartData = prepareChartData(data, filter);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="v4InGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(200, 80%, 55%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(200, 80%, 55%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="v4OutGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(155, 65%, 50%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(155, 65%, 50%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="v6InGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(270, 55%, 62%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(270, 55%, 62%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="v6OutGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(35, 80%, 58%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(35, 80%, 58%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 18%)" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTimestamp}
          stroke="hsl(215, 10%, 40%)"
          tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => formatBytes(v)}
          stroke="hsl(215, 10%, 40%)"
          tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
          width={65}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
        />
        {(!filter || filter === "ipv4") && (
          <>
            <Area type="monotone" dataKey="v4In" name="IPv4 In" stroke="hsl(200, 80%, 55%)" fill="url(#v4InGrad)" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="v4Out" name="IPv4 Out" stroke="hsl(155, 65%, 50%)" fill="url(#v4OutGrad)" strokeWidth={1.5} dot={false} />
          </>
        )}
        {(!filter || filter === "ipv6") && (
          <>
            <Area type="monotone" dataKey="v6In" name="IPv6 In" stroke="hsl(270, 55%, 62%)" fill="url(#v6InGrad)" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="v6Out" name="IPv6 Out" stroke="hsl(35, 80%, 58%)" fill="url(#v6OutGrad)" strokeWidth={1.5} dot={false} />
          </>
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BandwidthChart({ data }: Props) {
  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium">Bandwidth Usage</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-2 ml-2">
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="ipv4" data-testid="tab-ipv4">IPv4</TabsTrigger>
            <TabsTrigger value="ipv6" data-testid="tab-ipv6">IPv6</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <ChartView data={data} />
          </TabsContent>
          <TabsContent value="ipv4">
            <ChartView data={data} filter="ipv4" />
          </TabsContent>
          <TabsContent value="ipv6">
            <ChartView data={data} filter="ipv6" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
