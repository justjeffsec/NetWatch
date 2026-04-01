import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { formatBytes } from "@shared/utils";

const COLORS = [
  "hsl(128,100%,45%)", "hsl(150,80%,40%)", "hsl(270,65%,60%)", "hsl(90,100%,48%)",
  "hsl(0,85%,55%)",   "hsl(310,70%,55%)", "hsl(160,75%,45%)", "hsl(50,100%,52%)",
  "hsl(200,85%,50%)", "hsl(280,65%,58%)", "hsl(30,100%,55%)", "hsl(145,70%,48%)",
];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border font-mono text-[11px] px-3 py-2 shadow-lg"
      style={{ background:"hsl(128 90% 2%)", borderColor:"rgba(0,230,65,0.25)", borderRadius:"2px", boxShadow:"0 0 10px rgba(0,230,65,0.15)" }}>
      <p className="text-[10px] tracking-wider uppercase mb-1" style={{ color:"hsl(128 40% 40%)" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="tabular-nums" style={{ color: p.color || p.fill }}>
          {p.name}: {formatBytes(p.value)}
        </p>
      ))}
    </div>
  );
}

const SectionHeader = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="flex items-center gap-2">
    <div className="w-1 h-4 rounded-sm" style={{ background:"hsl(128 100% 45%)", boxShadow:"0 0 6px rgba(0,230,65,0.5)" }} />
    <CardTitle className="text-[11px] font-mono tracking-widest uppercase opacity-80">{title}</CardTitle>
    {sub && (
      <span className="border text-[9px] px-1.5 py-0.5 font-mono tracking-widest"
        style={{ borderRadius:"2px", borderColor:"rgba(0,230,65,0.2)", background:"rgba(0,230,65,0.06)", color:"hsl(128 50% 45%)" }}>
        {sub}
      </span>
    )}
  </div>
);

const EmptyState = ({ msg }: { msg: string }) => (
  <div className="flex items-center justify-center py-16">
    <p className="text-[11px] font-mono tracking-widest uppercase opacity-30">// {msg}</p>
  </div>
);

export default function TrafficAnalysis() {
  const [, navigate] = useLocation();
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: topTalkers = [] } = useQuery<any[]>({ queryKey: ["/api/flows/top-talkers"], refetchInterval: 15_000 });
  const { data: byService  = [] } = useQuery<any[]>({ queryKey: ["/api/flows/by-service"],  refetchInterval: 15_000 });
  const { data: byDevice   = [] } = useQuery<any[]>({ queryKey: ["/api/flows/by-device"],   refetchInterval: 15_000 });
  const { data: timeline   = [] } = useQuery<any[]>({ queryKey: ["/api/flows/timeline"],    refetchInterval: 15_000 });

  const timelineData = timeline.map((t: any) => ({
    time: new Date(t.timestamp).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
    download: t.bytesIn, upload: t.bytesOut, connections: t.connections,
  }));

  const axisStyle = { fontSize: 9, fill: "hsl(128 35% 34%)", fontFamily: "'Share Tech Mono',monospace" };
  const axisLineStyle = { stroke: "rgba(0,230,65,0.15)" };

  return (
    <div className="h-full overflow-y-auto cyber-grid" style={{ background:"hsl(128 95% 2%)" }}>

      {/* ── NAV BAR ── */}
      <div className="sticky top-0 z-50 border-b border-border/60"
        style={{ background:"hsl(128 95% 2%)", boxShadow:"0 1px 16px rgba(0,230,65,0.1)" }}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm"
              className="h-7 px-2 font-mono text-[11px] tracking-widest uppercase border border-transparent hover:border-primary/30"
              style={{ color:"hsl(128 60% 48%)" }}
              onClick={() => navigate("/")}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Dashboard
            </Button>
            <div className="h-4 w-px bg-border/60" />
            <span className="text-[13px] font-mono font-bold tracking-widest uppercase"
              style={{ color:"hsl(128 100% 55%)", textShadow:"0 0 10px rgba(0,230,65,0.6)", fontFamily:"'Orbitron',monospace" }}>
              Traffic Analysis
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="border text-[9px] px-1.5 py-0.5 font-mono tracking-widest"
              style={{ borderRadius:"2px", borderColor:"rgba(0,230,65,0.2)", background:"rgba(0,230,65,0.06)", color:"hsl(128 50% 45%)" }}>
              last hour
            </span>
            <div className="h-4 w-px bg-border/60" />
            <span className="text-[11px] font-mono tabular-nums" style={{ color:"hsl(128 100% 55%)", textShadow:"0 0 8px rgba(0,230,65,0.5)" }}>
              {clock}
            </span>
          </div>
        </div>
        <div className="px-4 pb-1.5 flex items-center gap-4">
          <span className="text-[9px] font-mono tracking-widest uppercase opacity-40">
            // FLOW ANALYSIS :: REAL-TIME TRAFFIC INTELLIGENCE
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Row 1: Timeline + Service Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card className="border-card-border">
              <CardHeader className="pb-2 pt-3 px-4">
                <SectionHeader title="Traffic Over Time" />
              </CardHeader>
              <CardContent className="px-2 pb-3">
                {timelineData.length === 0 ? <EmptyState msg="Collecting flow data..." /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={timelineData} barCategoryGap="15%">
                      <XAxis dataKey="time" tick={axisStyle} axisLine={axisLineStyle} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => formatBytes(v)} width={58} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill:"rgba(0,230,65,0.05)" }} />
                      <Bar dataKey="download" name="Download" fill="hsl(150,80%,40%)" radius={[2,2,0,0]} />
                      <Bar dataKey="upload"   name="Upload"   fill="hsl(128,100%,45%)"  radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-card-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <SectionHeader title="By Service" sub={`${byService.length} types`} />
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {byService.length === 0 ? <EmptyState msg="No service data yet" /> : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={byService.slice(0, 8)} dataKey="totalBytes" nameKey="service"
                        cx="50%" cy="50%" innerRadius={38} outerRadius={65}
                        strokeWidth={1} stroke="hsl(128 90% 2%)">
                        {byService.slice(0, 8).map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />
                        ))}
                      </Pie>
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="border font-mono text-[11px] px-2 py-1.5"
                            style={{ background:"hsl(128 90% 2%)", borderColor:"rgba(0,230,65,0.25)", borderRadius:"2px" }}>
                            <span style={{ color:"hsl(128 80% 60%)" }}>{d.service}</span>: {formatBytes(d.totalBytes)}
                          </div>
                        );
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-2 mt-2">
                    {byService.slice(0, 8).map((s: any, i: number) => (
                      <div key={s.service} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[10px] font-mono truncate opacity-60">{s.service}</span>
                        <span className="ml-auto text-[10px] font-mono tabular-nums" style={{ color:"hsl(128 70% 52%)" }}>{formatBytes(s.totalBytes)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Top Talkers + Per-Device */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-card-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <SectionHeader title="Top Talkers" sub="by total bytes" />
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {topTalkers.length === 0 ? <EmptyState msg="No flow data yet" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={topTalkers.slice(0, 10).map((t: any) => ({
                      name: t.label || t.ip.slice(0, 18),
                      download: t.bytesIn, upload: t.bytesOut,
                    }))}
                    layout="vertical" barCategoryGap="20%">
                    <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => formatBytes(v)} />
                    <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 9 }} axisLine={false} tickLine={false} width={115} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill:"rgba(0,230,65,0.05)" }} />
                    <Bar dataKey="download" name="Download" fill="hsl(150,80%,40%)" radius={[0,2,2,0]} stackId="a" />
                    <Bar dataKey="upload"   name="Upload"   fill="hsl(128,100%,45%)"  radius={[0,2,2,0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <SectionHeader title="Per-Device Bandwidth" sub={`${byDevice.length} devices`} />
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ScrollArea className="h-[265px]">
                {byDevice.length === 0 ? <EmptyState msg="No device data yet" /> : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b" style={{ borderBottomColor:"rgba(0,230,65,0.12)" }}>
                        {["Device","↓ Down","↑ Up","Total","Conns"].map((h, i) => (
                          <th key={h} className={`py-2 font-mono text-[9px] tracking-widest uppercase ${i === 0 ? "text-left px-4" : "text-right px-3"}`}
                            style={{ color:"hsl(128 45% 36%)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {byDevice.slice(0, 30).map((d: any) => (
                        <tr key={d.ip} className="border-b transition-colors group"
                          style={{ borderBottomColor:"rgba(0,230,65,0.06)" }}>
                          <td className="px-4 py-2">
                            <div className="font-mono text-[11px]" style={{ color:"hsl(128 80% 60%)" }}>
                              {d.label || d.ip}
                            </div>
                            {d.label && <div className="text-[9px] font-mono opacity-40">{d.ip}</div>}
                            {d.org   && <div className="text-[9px] font-mono opacity-35">{d.org}</div>}
                          </td>
                          <td className="text-right px-3 py-2 font-mono text-[11px] tabular-nums" style={{ color:"hsl(150 80%, 48%)" }}>
                            {formatBytes(d.bytesIn)}
                          </td>
                          <td className="text-right px-3 py-2 font-mono text-[11px] tabular-nums" style={{ color:"hsl(128 100% 50%)" }}>
                            {formatBytes(d.bytesOut)}
                          </td>
                          <td className="text-right px-3 py-2 font-mono text-[11px] tabular-nums font-medium" style={{ color:"hsl(128 80% 60%)" }}>
                            {formatBytes(d.totalBytes)}
                          </td>
                          <td className="text-right px-4 py-2 font-mono text-[11px] opacity-50">
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
    </div>
  );
}
