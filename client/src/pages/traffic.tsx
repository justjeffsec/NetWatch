import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Sun, Moon, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
  Legend,
} from "recharts";

// --- Helpers ---

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

const COLORS = [
  "#22d3ee", "#34d399", "#a78bfa", "#f59e0b", "#ef4444",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#8b5cf6",
  "#06b6d4", "#10b981", "#eab308", "#e11d48", "#7c3aed",
];

// --- Custom Tooltip ---

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur border border-border rounded-md px-3 py-2 shadow-lg text-xs">
      <p className="font-mono text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: {formatBytes(p.value)}
        </p>
      ))}
    </div>
  );
}

// --- Page ---

export default function TrafficAnalysis() {
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();

  const { data: topTalkers = [] } = useQuery<any[]>({
    queryKey: ["/api/flows/top-talkers"],
    refetchInterval: 15_000,
  });

  const { data: byService = [] } = useQuery<any[]>({
    queryKey: ["/api/flows/by-service"],
    refetchInterval: 15_000,
  });

  const { data: byDevice = [] } = useQuery<any[]>({
    queryKey: ["/api/flows/by-device"],
    refetchInterval: 15_000,
  });

  const { data: timeline = [] } = useQuery<any[]>({
    queryKey: ["/api/flows/timeline"],
    refetchInterval: 15_000,
  });

  const timelineData = timeline.map((t: any) => ({
    time: new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    download: t.bytesIn,
    upload: t.bytesOut,
    connections: t.connections,
  }));

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Dashboard
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Traffic Analysis</h1>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 bg-sky-500/10 text-sky-400 border-sky-500/15"
          >
            last hour
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Row 1: Time-based flow pattern + Protocol breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Traffic timeline */}
        <div className="lg:col-span-2">
          <Card className="border-card-border">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Traffic Over Time</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              {timelineData.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-xs">
                  Collecting flow data...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
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
                      tickFormatter={(v) => formatBytes(v)}
                      width={55}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                      iconSize={8}
                    />
                    <Area
                      type="monotone"
                      dataKey="download"
                      name="Download"
                      stroke="#22d3ee"
                      fill="url(#gradIn)"
                      strokeWidth={1.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="upload"
                      name="Upload"
                      stroke="#a78bfa"
                      fill="url(#gradOut)"
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Protocol/Service breakdown pie */}
        <Card className="border-card-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Traffic by Service</CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-500/10 text-slate-400 border-slate-500/15">
                {byService.length} types
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {byService.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-xs">
                No service data yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={byService.slice(0, 8)}
                      dataKey="totalBytes"
                      nameKey="service"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      strokeWidth={1}
                      stroke="hsl(215,20%,12%)"
                    >
                      {byService.slice(0, 8).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-card/95 backdrop-blur border border-border rounded-md px-2 py-1 text-xs shadow-lg">
                            <span className="font-medium">{d.service}</span>: {formatBytes(d.totalBytes)}
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 mt-1">
                  {byService.slice(0, 8).map((s: any, i: number) => (
                    <div key={s.service} className="flex items-center gap-1.5 text-[10px]">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="truncate text-muted-foreground">{s.service}</span>
                      <span className="ml-auto font-mono text-foreground/70">{formatBytes(s.totalBytes)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Top Talkers + Per-Device Bandwidth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Talkers bar chart */}
        <Card className="border-card-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Top Talkers</CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-sky-500/10 text-sky-400 border-sky-500/15">
                by total bytes
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {topTalkers.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-xs">
                No flow data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={topTalkers.slice(0, 10).map((t: any) => ({
                    name: t.label || t.ip.slice(0, 18),
                    download: t.bytesIn,
                    upload: t.bytesOut,
                  }))}
                  layout="vertical"
                  barCategoryGap="20%"
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: "hsl(215,15%,45%)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatBytes(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 9, fill: "hsl(215,15%,50%)" }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(215,20%,12%)" }} />
                  <Bar dataKey="download" name="Download" fill="#22d3ee" radius={[0, 2, 2, 0]} stackId="a" />
                  <Bar dataKey="upload" name="Upload" fill="#a78bfa" radius={[0, 2, 2, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Per-Device Bandwidth table */}
        <Card className="border-card-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Per-Device Bandwidth</CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-500/10 text-slate-400 border-slate-500/15">
                {byDevice.length} devices
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <ScrollArea className="h-[280px]">
              {byDevice.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-xs">
                  No device data yet
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium">Device</th>
                      <th className="text-right px-3 py-2 font-medium">Down</th>
                      <th className="text-right px-3 py-2 font-medium">Up</th>
                      <th className="text-right px-3 py-2 font-medium">Total</th>
                      <th className="text-right px-4 py-2 font-medium">Conns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDevice.slice(0, 30).map((d: any) => (
                      <tr
                        key={d.ip}
                        className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-2">
                          <div className="font-mono text-[11px]">
                            {d.label || d.ip}
                          </div>
                          {d.label && (
                            <div className="text-[9px] text-muted-foreground/60 font-mono">{d.ip}</div>
                          )}
                          {d.org && (
                            <div className="text-[9px] text-muted-foreground/50">{d.org}</div>
                          )}
                        </td>
                        <td className="text-right px-3 py-2 font-mono text-cyan-400/80">
                          {formatBytes(d.bytesIn)}
                        </td>
                        <td className="text-right px-3 py-2 font-mono text-purple-400/80">
                          {formatBytes(d.bytesOut)}
                        </td>
                        <td className="text-right px-3 py-2 font-mono font-medium">
                          {formatBytes(d.totalBytes)}
                        </td>
                        <td className="text-right px-4 py-2 text-muted-foreground">
                          {d.connections}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
