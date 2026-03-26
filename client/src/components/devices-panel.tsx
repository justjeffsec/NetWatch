import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Monitor,
  Pencil,
  Check,
  X,
  Search,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { KnownDevice } from "@shared/schema";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function DevicesPanel() {
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { data: devices = [], refetch } = useQuery<KnownDevice[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 10_000,
  });

  const trustMutation = useMutation({
    mutationFn: async ({ id, trusted }: { id: number; trusted: boolean }) => {
      await apiRequest("PATCH", `/api/devices/${id}/trust`, { trusted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
    },
  });

  const labelMutation = useMutation({
    mutationFn: async ({ id, label }: { id: number; label: string }) => {
      await apiRequest("PATCH", `/api/devices/${id}/label`, { label });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setEditingId(null);
    },
  });

  const filtered = devices.filter((d) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      d.ipAddress.toLowerCase().includes(q) ||
      (d.label && d.label.toLowerCase().includes(q))
    );
  });

  const trustedCount = devices.filter((d) => d.trusted).length;
  const untrustedCount = devices.length - trustedCount;

  const startEdit = (device: KnownDevice) => {
    setEditingId(device.id);
    setEditLabel(device.label || "");
  };

  const saveLabel = (id: number) => {
    labelMutation.mutate({ id, label: editLabel });
  };

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Known Devices</CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            >
              {trustedCount} trusted
            </Badge>
            {untrustedCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20"
              >
                {untrustedCount} new
              </Badge>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            {devices.length} total
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-2 pt-1">
        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by IP or label..."
            className="h-7 pl-7 text-xs bg-muted/30 border-border/50"
          />
        </div>
      </CardContent>
      <CardContent className="px-0 pb-0 pt-0">
        <ScrollArea className="h-[300px]">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Monitor className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">
                {devices.length === 0
                  ? "No devices detected yet"
                  : "No matching devices"}
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {filtered.map((device) => (
                <div
                  key={device.id}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-muted/30 transition-colors group ${
                    device.trusted
                      ? "bg-emerald-500/[0.02]"
                      : ""
                  }`}
                >
                  {/* Trust icon */}
                  <div className="flex-shrink-0">
                    {device.trusted ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-400/70" />
                    )}
                  </div>

                  {/* Device info */}
                  <div className="flex-1 min-w-0">
                    {editingId === device.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Device label..."
                          className="h-6 text-xs bg-muted/50 border-border/50 flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveLabel(device.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => saveLabel(device.id)}
                        >
                          <Check className="w-3 h-3 text-emerald-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono truncate">
                            {device.ipAddress}
                          </span>
                          {device.label && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 bg-sky-500/10 text-sky-400 border-sky-500/15"
                            >
                              {device.label}
                            </Badge>
                          )}
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => startEdit(device)}
                          >
                            <Pencil className="w-2.5 h-2.5 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-muted-foreground/60 font-mono">
                            first: {timeAgo(device.firstSeen)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 font-mono">
                            last: {timeAgo(device.lastSeen)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Trust toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-6 text-[10px] px-2 ${
                      device.trusted
                        ? "text-emerald-400 hover:text-red-400"
                        : "text-muted-foreground hover:text-emerald-400"
                    }`}
                    onClick={() =>
                      trustMutation.mutate({
                        id: device.id,
                        trusted: !device.trusted,
                      })
                    }
                    disabled={trustMutation.isPending}
                  >
                    {device.trusted ? (
                      <>
                        <Shield className="w-3 h-3 mr-1" />
                        Trusted
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Trust
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
