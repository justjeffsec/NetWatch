import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { formatTimestamp } from "@/lib/format";
import type { Connection } from "@shared/schema";

interface Props { connections: Connection[]; }

export function ConnectionsTable({ connections }: Props) {
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return connections.filter((c) => {
      if (familyFilter !== "all" && c.family !== familyFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.remoteAddr.toLowerCase().includes(q) ||
          c.localAddr.toLowerCase().includes(q) ||
          (c.process || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [connections, search, familyFilter, statusFilter]);

  const statusStyle = (s: string) => {
    switch (s) {
      case "ESTABLISHED": return { borderColor: "rgba(0,210,220,0.35)", background: "rgba(0,210,220,0.08)", color: "hsl(185 85% 55%)" };
      case "TIME_WAIT":   return { borderColor: "rgba(255,154,0,0.35)", background: "rgba(255,154,0,0.08)", color: "hsl(38 100% 60%)" };
      case "CLOSE_WAIT":  return { borderColor: "rgba(255,60,60,0.35)",  background: "rgba(255,60,60,0.08)",  color: "#ff7070" };
      case "LISTEN":      return { borderColor: "rgba(150,80,230,0.35)", background: "rgba(150,80,230,0.08)", color: "#c090ff" };
      default:            return { borderColor: "rgba(255,154,0,0.15)", background: "transparent",            color: "hsl(38 35% 45%)" };
    }
  };

  const familyStyle = (f: string) => f === "ipv6"
    ? { borderColor: "rgba(150,80,230,0.3)", background: "rgba(150,80,230,0.07)", color: "#c090ff" }
    : { borderColor: "rgba(0,210,220,0.3)",  background: "rgba(0,210,220,0.07)",  color: "hsl(185 80% 55%)" };

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-sm" style={{ background: "hsl(185 85% 40%)", boxShadow: "0 0 6px rgba(0,210,220,0.5)" }} />
            <CardTitle className="text-[11px] font-mono tracking-widest uppercase opacity-80">
              Connections
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter by IP or process..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-44 text-[11px] font-mono"
              data-testid="input-connection-search"
            />
            <Select value={familyFilter} onValueChange={setFamilyFilter}>
              <SelectTrigger className="h-7 w-20 text-[11px] font-mono" data-testid="select-family-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ipv4">IPv4</SelectItem>
                <SelectItem value="ipv6">IPv6</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 w-32 text-[11px] font-mono" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ESTABLISHED">Established</SelectItem>
                <SelectItem value="TIME_WAIT">Time Wait</SelectItem>
                <SelectItem value="CLOSE_WAIT">Close Wait</SelectItem>
                <SelectItem value="LISTEN">Listen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ScrollArea className="h-[300px]">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottomColor: "rgba(255,154,0,0.12)" }}>
                <TableHead className="w-14 pl-4">Proto</TableHead>
                <TableHead className="w-12">Type</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Remote</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-28">Process</TableHead>
                <TableHead className="w-20 pr-4">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((c) => (
                <TableRow key={c.id}
                  className="font-mono group transition-colors"
                  style={{ borderBottomColor: "rgba(255,154,0,0.06)" }}>
                  <TableCell className="pl-4 text-[11px] uppercase tracking-wider"
                    style={{ color: "hsl(38 70% 55%)" }}>{c.protocol}</TableCell>
                  <TableCell>
                    <span className="border text-[9px] px-1 py-0.5 font-mono tracking-widest"
                      style={{ ...familyStyle(c.family), borderRadius: "2px" }}>
                      {c.family === "ipv6" ? "v6" : "v4"}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px] tabular-nums" style={{ color: "hsl(38 50% 50%)" }}>
                    {c.localAddr}:{c.localPort}
                  </TableCell>
                  <TableCell className="text-[11px] tabular-nums" style={{ color: "hsl(38 75% 65%)" }}>
                    {c.remoteAddr}:{c.remotePort}
                  </TableCell>
                  <TableCell>
                    <span className="border text-[9px] px-1.5 py-0.5 font-mono tracking-widest"
                      style={{ ...statusStyle(c.status), borderRadius: "2px" }}>
                      {c.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px]" style={{ color: "hsl(38 40% 45%)" }}>
                    {c.process || "—"}
                  </TableCell>
                  <TableCell className="text-[11px] pr-4 tabular-nums" style={{ color: "hsl(38 30% 40%)" }}>
                    {formatTimestamp(c.timestamp)}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 font-mono text-[11px] tracking-widest uppercase"
                    style={{ color: "hsl(38 30% 35%)" }}>
                    // No connections match filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <div className="px-4 py-2 border-t flex items-center justify-between"
          style={{ borderTopColor: "rgba(255,154,0,0.1)" }}>
          <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: "hsl(38 35% 40%)" }}>
            {filtered.length} connection{filtered.length !== 1 ? "s" : ""} monitored
          </span>
          <div className="flex gap-1">
            {["ESTABLISHED","LISTEN","TIME_WAIT"].map(s => {
              const count = filtered.filter(c => c.status === s).length;
              if (!count) return null;
              return (
                <span key={s} className="border text-[9px] px-1.5 py-0.5 font-mono"
                  style={{ ...statusStyle(s), borderRadius: "2px" }}>
                  {count} {s.replace("_"," ")}
                </span>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
