import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, MapPin } from "lucide-react";
import type { KnownDevice } from "@shared/schema";

/**
 * Equirectangular projection: convert lat/lon to SVG x/y
 * Map is 800x400, centered at 0,0
 */
function project(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * 800;
  const y = ((90 - lat) / 180) * 400;
  return [x, y];
}

/** Simplified world map outline paths (major continents) */
const WORLD_PATHS = [
  // North America
  "M 60,80 L 80,60 120,55 160,65 175,90 180,120 170,140 155,150 140,155 120,160 100,165 80,170 55,165 40,150 30,130 35,110 45,90 Z",
  // South America
  "M 120,195 L 140,185 160,190 170,210 175,240 170,270 160,300 145,320 130,330 120,320 110,295 105,270 108,240 112,215 Z",
  // Europe
  "M 350,55 L 370,50 400,55 420,60 430,70 425,90 410,100 390,105 370,100 355,90 345,75 Z",
  // Africa
  "M 350,130 L 380,120 410,125 430,140 440,170 435,200 425,240 415,270 400,280 380,285 360,275 345,255 340,230 338,200 340,170 345,145 Z",
  // Asia
  "M 430,40 L 470,35 520,30 570,35 620,40 660,50 680,70 690,90 685,110 670,130 650,140 620,145 580,140 550,130 520,120 490,110 460,100 440,90 435,70 Z",
  // Southeast Asia / Indonesia
  "M 580,160 L 610,155 640,160 660,170 670,180 660,190 630,195 600,190 585,180 Z",
  // Australia
  "M 620,250 L 660,240 700,245 720,260 725,280 715,300 690,310 660,305 640,290 625,270 Z",
];

/** Home location marker (center of US for default) */
const HOME_LAT = 39.8;
const HOME_LON = -98.5;

function threatColor(level: string | null): string {
  switch (level) {
    case "malicious": return "#ef4444";
    case "suspicious": return "#f59e0b";
    default: return "#22d3ee";
  }
}

function trustColor(trusted: number): string {
  return trusted ? "#34d399" : "#94a3b8";
}

export function ConnectionMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredDevice, setHoveredDevice] = useState<KnownDevice | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { data: devices = [] } = useQuery<KnownDevice[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 15_000,
  });

  // Only show devices that have geo data
  const geoDevices = devices.filter((d) => d.lat && d.lon);
  const [homeX, homeY] = project(HOME_LAT, HOME_LON);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const countryCount = new Set(geoDevices.map(d => d.country).filter(Boolean)).size;
  const maliciousCount = geoDevices.filter(d => d.threatLevel === "malicious").length;

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
            viewBox="0 0 800 400"
            className="w-full h-auto"
            onMouseMove={handleMouseMove}
          >
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={`h${i}`}
                x1="0" y1={i * 100}
                x2="800" y2={i * 100}
                stroke="hsl(215,20%,15%)" strokeWidth="0.5"
              />
            ))}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <line
                key={`v${i}`}
                x1={i * 100} y1="0"
                x2={i * 100} y2="400"
                stroke="hsl(215,20%,15%)" strokeWidth="0.5"
              />
            ))}

            {/* Continent outlines */}
            {WORLD_PATHS.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="hsl(215,20%,14%)"
                stroke="hsl(215,20%,22%)"
                strokeWidth="0.8"
              />
            ))}

            {/* Connection lines from home to each device */}
            {geoDevices.map((device) => {
              const [dx, dy] = project(device.lat!, device.lon!);
              const color = device.threatLevel === "malicious" || device.threatLevel === "suspicious"
                ? threatColor(device.threatLevel)
                : trustColor(device.trusted ?? 0);
              return (
                <line
                  key={`line-${device.id}`}
                  x1={homeX} y1={homeY}
                  x2={dx} y2={dy}
                  stroke={color}
                  strokeWidth="0.6"
                  strokeOpacity="0.35"
                  strokeDasharray={device.trusted ? "none" : "3,2"}
                />
              );
            })}

            {/* Home marker */}
            <circle cx={homeX} cy={homeY} r="4" fill="#22d3ee" fillOpacity="0.9" />
            <circle cx={homeX} cy={homeY} r="7" fill="none" stroke="#22d3ee" strokeWidth="0.8" strokeOpacity="0.4">
              <animate attributeName="r" values="7;12;7" dur="2s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
            </circle>

            {/* Device dots */}
            {geoDevices.map((device) => {
              const [dx, dy] = project(device.lat!, device.lon!);
              const color = device.threatLevel === "malicious" || device.threatLevel === "suspicious"
                ? threatColor(device.threatLevel)
                : trustColor(device.trusted ?? 0);
              return (
                <g key={`dot-${device.id}`}>
                  <circle
                    cx={dx} cy={dy} r="3"
                    fill={color} fillOpacity="0.85"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDevice(device)}
                    onMouseLeave={() => setHoveredDevice(null)}
                  />
                  {device.threatLevel === "malicious" && (
                    <circle cx={dx} cy={dy} r="6" fill="none" stroke="#ef4444" strokeWidth="0.6" strokeOpacity="0.5">
                      <animate attributeName="r" values="6;10;6" dur="1.5s" repeatCount="indefinite" />
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
              className="absolute pointer-events-none z-10 bg-card/95 backdrop-blur border border-border rounded-md px-2.5 py-1.5 shadow-lg"
              style={{
                left: Math.min(mousePos.x + 10, 300),
                top: mousePos.y - 40,
              }}
            >
              <div className="text-xs font-mono font-medium">{hoveredDevice.ipAddress}</div>
              {hoveredDevice.label && (
                <div className="text-[10px] text-sky-400">{hoveredDevice.label}</div>
              )}
              <div className="text-[10px] text-muted-foreground">
                {[hoveredDevice.city, hoveredDevice.countryName].filter(Boolean).join(", ")}
              </div>
              {hoveredDevice.org && (
                <div className="text-[10px] text-muted-foreground/70">{hoveredDevice.org}</div>
              )}
              {hoveredDevice.threatLevel && hoveredDevice.threatLevel !== "safe" && (
                <div className={`text-[10px] font-medium ${
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
