import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatRate } from "@/lib/format";

interface Props {
  ipv4In: number;
  ipv4Out: number;
  ipv6In: number;
  ipv6Out: number;
  ipv4Conns: number;
  ipv6Conns: number;
}

const COLORS_BW = ["hsl(200, 80%, 55%)", "hsl(270, 55%, 62%)"];
const COLORS_CONN = ["hsl(155, 65%, 50%)", "hsl(35, 80%, 58%)"];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-popover-border rounded-md px-3 py-2 text-xs font-mono shadow-lg">
      <p style={{ color: payload[0].payload.fill }}>{payload[0].name}: {payload[0].value}</p>
    </div>
  );
};

export function ProtocolSplit({ ipv4In, ipv4Out, ipv6In, ipv6Out, ipv4Conns, ipv6Conns }: Props) {
  const totalIn = ipv4In + ipv6In;
  const totalOut = ipv4Out + ipv6Out;
  const ipv4Pct = totalIn > 0 ? Math.round(((ipv4In + ipv4Out) / (totalIn + totalOut)) * 100) : 50;

  const bwData = [
    { name: "IPv4", value: Math.round(ipv4In + ipv4Out), fill: COLORS_BW[0] },
    { name: "IPv6", value: Math.round(ipv6In + ipv6Out), fill: COLORS_BW[1] },
  ];

  const connData = [
    { name: "IPv4", value: ipv4Conns || 1, fill: COLORS_CONN[0] },
    { name: "IPv6", value: ipv6Conns || 1, fill: COLORS_CONN[1] },
  ];

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium">Protocol Split</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Bandwidth split */}
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Bandwidth</p>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie
                  data={bwData}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={42}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {bwData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-xs font-mono tabular-nums mt-1">
              <span style={{ color: COLORS_BW[0] }}>{ipv4Pct}% v4</span>
              {" / "}
              <span style={{ color: COLORS_BW[1] }}>{100 - ipv4Pct}% v6</span>
            </p>
          </div>

          {/* Connection split */}
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Connections</p>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie
                  data={connData}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={42}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {connData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-xs font-mono tabular-nums mt-1">
              <span style={{ color: COLORS_CONN[0] }}>{ipv4Conns} v4</span>
              {" / "}
              <span style={{ color: COLORS_CONN[1] }}>{ipv6Conns} v6</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
