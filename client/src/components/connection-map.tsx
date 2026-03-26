import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";
import * as topojson from "topojson-client";
import worldData from "@/data/world-110m.json";
import type { KnownDevice } from "@shared/schema";

// --- Projection ---

const MAP_W = 960;
const MAP_H = 500;

/** Equirectangular projection: lon/lat → SVG x/y */
function project(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * MAP_W;
  const y = ((90 - lat) / 180) * MAP_H;
  return [x, y];
}

/**
 * Convert GeoJSON coordinates ring to SVG path.
 * Handles both Polygon and MultiPolygon geometry types.
 */
function geoToPath(geometry: any): string {
  const paths: string[] = [];

  function ringToPath(ring: number[][]) {
    return ring
      .map((coord, i) => {
        const [x, y] = project(coord[1], coord[0]);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join("") + "Z";
  }

  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      paths.push(ringToPath(ring));
    }
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        paths.push(ringToPath(ring));
      }
    }
  }

  return paths.join(" ");
}

// --- Colors ---

function threatColor(level: string | null): string {
  switch (level) {
    case "malicious": return "#ef4444";
    case "suspicious": return "#f59e0b";
    default: return "#22d3ee";
  }
}

function dotColor(device: KnownDevice): string {
  if (device.threatLevel === "malicious" || device.threatLevel === "suspicious") {
    return threatColor(device.threatLevel);
  }
  return device.trusted ? "#34d399" : "#94a3b8";
}

interface HomeLocation {
  lat: number;
  lon: number;
  city: string;
  country: string;
}

export function ConnectionMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredDevice, setHoveredDevice] = useState<KnownDevice | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { data: devices = [] } = useQuery<KnownDevice[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 15_000,
  });

  const { data: homeData } = useQuery<HomeLocation>({
    queryKey: ["/api/home-location"],
    staleTime: 300_000, // cache for 5 min
  });

  const homeLat = homeData?.lat ?? 39.8;
  const homeLon = homeData?.lon ?? -98.5;
  const homeLabel = homeData?.city || "Home";

  // Convert TopoJSON → GeoJSON country features (memoized)
  const countries = useMemo(() => {
    try {
      const topo = worldData as any;
      const geo = topojson.feature(topo, topo.objects.countries) as any;
      return geo.features || [];
    } catch {
      return [];
    }
  }, []);

  // Only show devices that have geo data
  const geoDevices = devices.filter((d) => d.lat != null && d.lon != null && d.lat !== 0 && d.lon !== 0);
  const [homeX, homeY] = project(homeLat, homeLon);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const countryCount = new Set(geoDevices.map((d) => d.country).filter(Boolean)).size;
  const maliciousCount = geoDevices.filter((d) => d.threatLevel === "malicious").length;

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Connection Map</CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-sky-500/10 text-sky-400 border-sky-500/15"
            >
              {geoDevices.length} located
            </Badge>
            {countryCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-slate-500/10 text-slate-400 border-slate-500/15"
              >
                {countryCount} countries
              </Badge>
            )}
            {maliciousCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-400 border-red-500/20 animate-pulse"
              >
                {maliciousCount} threats
              </Badge>
            )}
          </div>
          <Globe className="w-4 h-4 text-muted-foreground/50" />
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <div className="relative rounded-lg overflow-hidden bg-[hsl(215,30%,8%)] border border-border/30">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            className="w-full h-auto"
            onMouseMove={handleMouseMove}
            style={{ minHeight: 200 }}
          >
            {/* Ocean background */}
            <rect width={MAP_W} height={MAP_H} fill="hsl(215,30%,8%)" />

            {/* Graticule (grid lines) */}
            {Array.from({ length: 7 }, (_, i) => (i - 3) * 30).map((lat) => {
              const y = ((90 - lat) / 180) * MAP_H;
              return (
                <line
                  key={`lat${lat}`}
                  x1={0} y1={y} x2={MAP_W} y2={y}
                  stroke="hsl(215,15%,13%)" strokeWidth="0.3"
                />
              );
            })}
            {Array.from({ length: 13 }, (_, i) => (i - 6) * 30).map((lon) => {
              const x = ((lon + 180) / 360) * MAP_W;
              return (
                <line
                  key={`lon${lon}`}
                  x1={x} y1={0} x2={x} y2={MAP_H}
                  stroke="hsl(215,15%,13%)" strokeWidth="0.3"
                />
              );
            })}

            {/* Country outlines */}
            {countries.map((feature: any, i: number) => {
              const d = geoToPath(feature.geometry);
              if (!d) return null;
              return (
                <path
                  key={i}
                  d={d}
                  fill="hsl(215,18%,15%)"
                  stroke="hsl(215,15%,25%)"
                  strokeWidth="0.4"
                />
              );
            })}

            {/* Connection lines from home to each device */}
            {geoDevices.map((device) => {
              const [dx, dy] = project(device.lat!, device.lon!);
              const color = dotColor(device);

              // Curved line (quadratic bezier for visual appeal)
              const mx = (homeX + dx) / 2;
              const my = Math.min(homeY, dy) - 30; // arc upward

              return (
                <path
                  key={`line-${device.id}`}
                  d={`M${homeX},${homeY} Q${mx},${my} ${dx},${dy}`}
                  fill="none"
                  stroke={color}
                  strokeWidth="0.7"
                  strokeOpacity="0.3"
                  strokeDasharray={device.trusted ? "none" : "4,3"}
                />
              );
            })}

            {/* Home marker */}
            <circle cx={homeX} cy={homeY} r="4.5" fill="#22d3ee" fillOpacity="0.9" />
            <circle cx={homeX} cy={homeY} r="8" fill="none" stroke="#22d3ee" strokeWidth="0.8" strokeOpacity="0.4">
              <animate attributeName="r" values="8;14;8" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
            </circle>
            {/* Home label */}
            <text
              x={homeX} y={homeY - 10}
              textAnchor="middle"
              fill="#22d3ee"
              fontSize="8"
              fontFamily="monospace"
              opacity="0.7"
            >
              {homeLabel}
            </text>

            {/* Device dots */}
            {geoDevices.map((device) => {
              const [dx, dy] = project(device.lat!, device.lon!);
              const color = dotColor(device);
              return (
                <g key={`dot-${device.id}`}>
                  <circle
                    cx={dx} cy={dy} r="3.5"
                    fill={color} fillOpacity="0.85"
                    stroke={color} strokeWidth="0.5" strokeOpacity="0.3"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDevice(device)}
                    onMouseLeave={() => setHoveredDevice(null)}
                  />
                  {device.threatLevel === "malicious" && (
                    <circle cx={dx} cy={dy} r="7" fill="none" stroke="#ef4444" strokeWidth="0.8" strokeOpacity="0.5">
                      <animate attributeName="r" values="7;12;7" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hoveredDevice && (
            <div
              className="absolute pointer-events-none z-10 bg-card/95 backdrop-blur border border-border rounded-md px-2.5 py-1.5 shadow-lg max-w-[220px]"
              style={{
                left: Math.min(mousePos.x + 12, 280),
                top: Math.max(mousePos.y - 50, 4),
              }}
            >
              <div className="text-[11px] font-mono font-medium">{hoveredDevice.ipAddress}</div>
              {hoveredDevice.label && (
                <div className="text-[10px] text-sky-400">{hoveredDevice.label}</div>
              )}
              <div className="text-[10px] text-muted-foreground">
                {[hoveredDevice.city, hoveredDevice.countryName].filter(Boolean).join(", ")}
              </div>
              {hoveredDevice.org && (
                <div className="text-[10px] text-muted-foreground/70 truncate">{hoveredDevice.org}</div>
              )}
              {hoveredDevice.threatLevel && hoveredDevice.threatLevel !== "safe" && (
                <div className={`text-[10px] font-medium mt-0.5 ${
                  hoveredDevice.threatLevel === "malicious" ? "text-red-400" : "text-amber-400"
                }`}>
                  {hoveredDevice.threatLevel}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex items-center gap-3 text-[9px] text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Home
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Trusted
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" /> Unknown
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Threat
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
