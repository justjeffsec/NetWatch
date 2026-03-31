import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldBan,
  Monitor, Pencil, Check, X, Search, Globe, MapPin,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { KnownDevice } from "@shared/schema";

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  const offset = 127397;
  return String.fromCodePoint(...code.toUpperCase().split("").map((c) => c.charCodeAt(0) + offset));
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const threatStyle = (level: string | null) => {
  switch (level) {
    case "malicious":  return { borderColor: "rgba(255,60,60,0.4)",  background: "rgba(255,40,40,0.1)",  color: "#ff7070" };
    case "suspicious": return { borderColor: "rgba(255,154,0,0.4)",  background: "rgba(255,154,0,0.1)", color: "hsl(38 100% 60%)" };
    case "safe":       return { borderColor: "rgba(0,210,120,0.3)",  background: "rgba(0,210,120,0.07)", color: "#4ade80" };
    default:           return { borderColor: "rgba(255,154,0,0.15)", background: "transparent",          color: "hsl(38 35% 45%)" };
  }
};

export function DevicesPanel() {
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { data: devices = [] } = useQuery<KnownDevice[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 10_000,
  });

  const trustMutation = useMutation({
    mutationFn: async ({ id, trusted }: { id: number; trusted: boolean }) => {
      await apiRequest("PATCH", `/api/devices/${id}/trust`, { trusted });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/devices"] }),
  });

  const labelMutation = useMutation({
    mutationFn: async ({ id, label }: { id: number; label: string }) => {
      await apiRequest("PATCH", `/api/devices/${id}/label`, { label });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/devices"] }); setEditingId(null); },
  });

  const filtered = devices.filter((d) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      d.ipAddress.toLowerCase().includes(q) ||
      (d.label && d.label.toLowerCase().includes(q)) ||
      (d.country && d.country.toLowerCase().includes(q)) ||
      (d.countryName && d.countryName.toLowerCase().includes(q)) ||
      (d.city && d.city.toLowerCase().includes(q)) ||
      (d.org && d.org.toLowerCase().includes(q))
    );
  });

  const trustedCount   = devices.filter((d) => d.trusted).length;
  const untrustedCount = devices.length - trustedCount;
  const maliciousCount = devices.filter((d) => d.threatLevel === "malicious").length;

  const startEdit = (device: KnownDevice) => { setEditingId(device.id); setEditLabel(device.label || ""); };
  const saveLabel = (id: number) => labelMutation.mutate({ id, label: editLabel });

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-1 h-4 rounded-sm"
              style={{ background: maliciousCount > 0 ? "#ff4040" : "hsl(270 65% 60%)", boxShadow: maliciousCount > 0 ? "0 0 6px rgba(255,40,40,0.7)" : "0 0 6px rgba(150,80,230,0.5)" }} />
            <CardTitle className="text-[11px] font-mono tracking-widest uppercase opacity-80">Known Devices</CardTitle>

            <span className="border text-[9px] px-1.5 py-0.5 font-mono tracking-widest"
              style={{ borderRadius:"2px", borderColor:"rgba(0,210,120,0.3)", background:"rgba(0,210,120,0.07)", color:"#4ade80" }}>
              {trustedCount} trusted
            </span>
            {untrustedCount > 0 && (
              <span className="border text-[9px] px-1.5 py-0.5 font-mono tracking-widest"
                style={{ borderRadius:"2px", borderColor:"rgba(255,154,0,0.3)", background:"rgba(255,154,0,0.08)", color:"hsl(38 100% 60%)" }}>
                {untrustedCount} new
              </span>
            )}
            {maliciousCount > 0 && (
              <span className="border text-[9px] px-1.5 py-0.5 font-mono tracking-widest animate-red-pulse"
                style={{ borderRadius:"2px", borderColor:"rgba(255,40,40,0.4)", background:"rgba(255,40,40,0.12)", color:"#ff6060" }}>
                {maliciousCount} threats
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono opacity-40">{devices.length} total</span>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-2 pt-1">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: "hsl(38 40% 40%)" }} />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter devices..."
            className="h-7 pl-7 text-[11px] font-mono"
          />
        </div>
      </CardContent>

      <CardContent className="px-0 pb-0 pt-0">
        <ScrollArea className="h-[270px]">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10" style={{ color: "hsl(38 30% 38%)" }}>
              <Monitor className="w-7 h-7 mb-2 opacity-30" />
              <p className="text-[11px] font-mono tracking-widest uppercase">
                {devices.length === 0 ? "// No devices detected" : "// No matches"}
              </p>
            </div>
          ) : (
            <div>
              {filtered.map((device) => (
                <div key={device.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-b group transition-all"
                  style={{
                    borderBottomColor: "rgba(255,154,0,0.07)",
                    borderLeft: device.threatLevel === "malicious"
                      ? "2px solid rgba(255,60,60,0.5)"
                      : device.trusted
                        ? "2px solid rgba(0,210,120,0.3)"
                        : "2px solid transparent",
                    background: device.threatLevel === "malicious" ? "rgba(255,30,30,0.04)" : "transparent",
                  }}>

                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {device.threatLevel === "malicious"
                      ? <ShieldBan className="w-4 h-4" style={{ color: "#ff4040", filter: "drop-shadow(0 0 4px rgba(255,40,40,0.8))" }} />
                      : device.threatLevel === "suspicious"
                        ? <ShieldAlert className="w-4 h-4" style={{ color: "hsl(38 100% 55%)", filter: "drop-shadow(0 0 3px rgba(255,154,0,0.7))" }} />
                        : device.trusted
                          ? <ShieldCheck className="w-4 h-4" style={{ color: "#4ade80" }} />
                          : <ShieldAlert className="w-4 h-4" style={{ color: "hsl(38 50% 45%)" }} />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {editingId === device.id ? (
                      <div className="flex items-center gap-1">
                        <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Device label..." className="h-6 text-[11px] flex-1"
                          onKeyDown={(e) => { if (e.key === "Enter") saveLabel(device.id); if (e.key === "Escape") setEditingId(null); }}
                          autoFocus />
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => saveLabel(device.id)}>
                          <Check className="w-3 h-3" style={{ color: "#4ade80" }} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setEditingId(null)}>
                          <X className="w-3 h-3" style={{ color: "hsl(38 40% 45%)" }} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono" style={{ color: "hsl(38 80% 65%)" }}>
                            {device.ipAddress}
                          </span>
                          {device.label && (
                            <span className="border text-[9px] px-1 py-0 font-mono"
                              style={{ borderRadius:"2px", borderColor:"rgba(0,210,220,0.3)", background:"rgba(0,210,220,0.07)", color:"hsl(185 80% 55%)" }}>
                              {device.label}
                            </span>
                          )}
                          {device.country && (
                            <span className="text-[10px]" title={device.countryName || device.country}>
                              {countryFlag(device.country)}
                            </span>
                          )}
                          {device.threatLevel && device.threatLevel !== "safe" && (
                            <span className="border text-[9px] px-1 py-0 font-mono tracking-widest"
                              style={{ ...threatStyle(device.threatLevel), borderRadius:"2px" }}>
                              {device.threatLevel.toUpperCase()}
                            </span>
                          )}
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => startEdit(device)}>
                            <Pencil className="w-2.5 h-2.5" style={{ color: "hsl(38 40% 45%)" }} />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {(device.city || device.countryName) && (
                            <span className="flex items-center gap-0.5 text-[9px] font-mono opacity-50">
                              <MapPin className="w-2.5 h-2.5" />
                              {[device.city, device.countryName].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {device.org && (
                            <span className="flex items-center gap-0.5 text-[9px] font-mono opacity-50">
                              <Globe className="w-2.5 h-2.5" />
                              {device.org}
                            </span>
                          )}
                          {!device.city && !device.org && (
                            <span className="text-[9px] font-mono opacity-40">
                              last: {timeAgo(device.lastSeen)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Trust toggle */}
                  <Button variant="ghost" size="sm"
                    className="h-6 text-[10px] px-2 font-mono tracking-widest uppercase flex-shrink-0"
                    style={{ color: device.trusted ? "#4ade80" : "hsl(38 35% 45%)" }}
                    onClick={() => trustMutation.mutate({ id: device.id, trusted: !device.trusted })}
                    disabled={trustMutation.isPending}>
                    {device.trusted
                      ? <><Shield className="w-3 h-3 mr-1" />Trust</>
                      : <><ShieldCheck className="w-3 h-3 mr-1" />Trust</>
                    }
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
