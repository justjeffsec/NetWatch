import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { formatTimestamp } from "@/lib/format";
import type { Connection } from "@shared/schema";

interface Props {
  connections: Connection[];
}

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

  const statusColor = (s: string) => {
    switch (s) {
      case "ESTABLISHED": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
      case "TIME_WAIT": return "bg-amber-500/15 text-amber-400 border-amber-500/20";
      case "CLOSE_WAIT": return "bg-red-500/15 text-red-400 border-red-500/20";
      case "LISTEN": return "bg-sky-500/15 text-sky-400 border-sky-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-medium">Connections</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter by IP or process..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-48 text-xs font-mono"
              data-testid="input-connection-search"
            />
            <Select value={familyFilter} onValueChange={setFamilyFilter}>
              <SelectTrigger className="h-7 w-24 text-xs" data-testid="select-family-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ipv4">IPv4</SelectItem>
                <SelectItem value="ipv6">IPv6</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 w-32 text-xs" data-testid="select-status-filter">
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
        <ScrollArea className="h-[320px]">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-16 pl-4">Proto</TableHead>
                <TableHead className="w-14">Type</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Remote</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28">Process</TableHead>
                <TableHead className="w-20 pr-4">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((c) => (
                <TableRow key={c.id} className="text-xs font-mono group">
                  <TableCell className="pl-4 uppercase">{c.protocol}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${c.family === 'ipv6' ? 'border-violet-500/30 text-violet-400' : 'border-sky-500/30 text-sky-400'}`}>
                      {c.family === 'ipv6' ? 'v6' : 'v4'}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{c.localAddr}:{c.localPort}</TableCell>
                  <TableCell className="tabular-nums">{c.remoteAddr}:{c.remotePort}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor(c.status)}`}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.process || "—"}</TableCell>
                  <TableCell className="text-muted-foreground pr-4 tabular-nums">{formatTimestamp(c.timestamp)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No connections match filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <div className="px-4 py-2 border-t text-xs text-muted-foreground font-mono tabular-nums">
          {filtered.length} connection{filtered.length !== 1 ? 's' : ''} shown
        </div>
      </CardContent>
    </Card>
  );
}
