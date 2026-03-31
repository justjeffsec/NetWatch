import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatRate } from "@/lib/format";

interface Props {
  ipv4In: number; ipv4Out: number;
  ipv6In: number; ipv6Out: number;
  ipv4Conns: number; ipv6Conns: number;
}

const C_AMBER = "hsl(38, 100%, 52%)";
const C_TEAL  = "hsl(185, 85%, 42%)";

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border font-mono text-[11px] px-3 py-1.5"
      style={{ background: "hsl(26 90% 4%)", borderColor: "rgba(255,154,0,0.25)", borderRadius: "2px" }}>
      <p style={{ color: payload[0].payload.fill }}>{payload[0].name}: {payload[0].value}</p>
    </div>
  );
};

export function ProtocolSplit({ ipv4In, ipv4Out, ipv6In, ipv6Out, ipv4Conns, ipv6Conns }: Props) {
  const totalIn  = ipv4In + ipv6In;
  const totalOut = ipv4Out + ipv6Out;
  const ipv4Pct  = totalIn > 0 ? Math.round(((ipv4In + ipv4Out) / (totalIn + totalOut)) * 100) : 50;

  const bwData = [
    { name: "IPv4", value: Math.round(ipv4In + ipv4Out), fill: C_AMBER },
    { name: "IPv6", value: Math.round(ipv6In + ipv6Out), fill: C_TEAL },
  ];
  const connData = [
    { name: "IPv4", value: ipv4Conns || 1, fill: C_AMBER },
    { name: "IPv6", value: ipv6Conns || 1, fill: C_TEAL },
  ];

  const DonutChart = ({ data }: { data: typeof bwData }) => (
    <ResponsiveContainer width="100%" height={90}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={26} outerRadius={40} dataKey="value" strokeWidth={0}>
          {data.map((entry, i) => <Cell key={i} fill={entry.fill} opacity={0.85} />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-sm" style={{ background: C_AMBER, boxShadow: "0 0 6px rgba(255,154,0,0.5)" }} />
          <CardTitle className="text-[11px] font-mono tracking-widest uppercase opacity-80">Protocol Split</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Bandwidth */}
          <div className="text-center">
            <p className="text-[9px] font-mono tracking-widest uppercase mb-1 opacity-50">Bandwidth</p>
            <DonutChart data={bwData} />
            <div className="flex justify-center gap-3 mt-1">
              <span className="text-[10px] font-mono tabular-nums" style={{ color: C_AMBER }}>{ipv4Pct}% v4</span>
              <span className="text-[10px] font-mono tabular-nums opacity-40">/</span>
              <span className="text-[10px] font-mono tabular-nums" style={{ color: C_TEAL }}>{100 - ipv4Pct}% v6</span>
            </div>
          </div>
          {/* Connections */}
          <div className="text-center">
            <p className="text-[9px] font-mono tracking-widest uppercase mb-1 opacity-50">Connections</p>
            <DonutChart data={connData} />
            <div className="flex justify-center gap-3 mt-1">
              <span className="text-[10px] font-mono tabular-nums" style={{ color: C_AMBER }}>{ipv4Conns} v4</span>
              <span className="text-[10px] font-mono tabular-nums opacity-40">/</span>
              <span className="text-[10px] font-mono tabular-nums" style={{ color: C_TEAL }}>{ipv6Conns} v6</span>
            </div>
          </div>
        </div>

        {/* Rate summary */}
        <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2"
          style={{ borderTopColor: "rgba(255,154,0,0.1)" }}>
          <div>
            <p className="text-[9px] font-mono opacity-40 tracking-widest uppercase">↓ In</p>
            <p className="text-[11px] font-mono tabular-nums" style={{ color: C_TEAL }}>{formatRate(ipv4In + ipv6In)}</p>
          </div>
          <div>
            <p className="text-[9px] font-mono opacity-40 tracking-widest uppercase">↑ Out</p>
            <p className="text-[11px] font-mono tabular-nums" style={{ color: C_AMBER }}>{formatRate(ipv4Out + ipv6Out)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
