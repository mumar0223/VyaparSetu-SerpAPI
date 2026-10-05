"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Compass,
  Crosshair,
  Store,
  Layers,
  MapPin,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SerpApiPayloadModal } from "@/components/ui/serpapi-payload-modal";

export interface MapMarker {
  lat: number;
  lng: number;
  title: string;
  description?: string;
  type?: "hub" | "competitor" | "mandi" | "point";
  threatLevel?: "High" | "Medium" | "Low";
  rating?: number;
  reviews?: number;
  distance?: string;
  address?: string;
  landmark?: string;
  speciality?: string;
  priceRange?: string;
  differentiator?: string;
}

export interface MapSpec {
  title?: string;
  center?: [number, number];
  zoom?: number;
  radiusKm?: number;
  markers?: MapMarker[];
  summary?: string;
}

export function parseFlexibleMapJson(raw: string): MapSpec | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  // Strip markdown fences
  let cleaned = trimmed
    .replace(/^```(?:map|json|leaflet)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // Strip comments & trailing commas
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // Try fixing unquoted keys
  try {
    const quoteKeys = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
    return JSON.parse(quoteKeys);
  } catch (_) {}

  return null;
}

// ─────────────────────────────────────────────────────────────
// TILE CONFIGURATIONS (Google Maps Tiles via Leaflet - 100% Watermark Free)
// ─────────────────────────────────────────────────────────────
const TILE_CONFIGS: Record<
  string,
  { url: string; label: string; subdomains?: string[] }
> = {
  google: {
    url: "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    label: "G-MAP",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
  },
  satellite: {
    url: "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    label: "SAT",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    label: "DARK",
    subdomains: ["a", "b", "c", "d"],
  },
};

export function InteractiveMap({
  spec,
  rawJson,
  height = "380px",
  className,
}: {
  spec?: MapSpec;
  rawJson?: string;
  height?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const circleGroupRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const outerCircleRef = useRef<any>(null);
  const hasFittedInitialBoundsRef = useRef(false);

  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [activeTile, setActiveTile] = useState<string>("google");
  const [currentZoom, setCurrentZoom] = useState<number>(13);
  const [hoveredPlaceName, setHoveredPlaceName] = useState<string | null>(null);
  const [isPayloadModalOpen, setIsPayloadModalOpen] = useState<boolean>(false);

  const parsedSpec = React.useMemo(() => {
    if (spec && typeof spec === "object") return spec;
    if (rawJson) return parseFlexibleMapJson(rawJson);
    return null;
  }, [spec, rawJson]);

  // Center coordinates calculation
  const computedCenter: [number, number] = React.useMemo(() => {
    if (parsedSpec?.center && Array.isArray(parsedSpec.center) && parsedSpec.center.length === 2) {
      return parsedSpec.center;
    }
    const markers = parsedSpec?.markers || [];
    const valid = markers.filter(
      (m) =>
        typeof m.lat === "number" &&
        !isNaN(m.lat) &&
        typeof m.lng === "number" &&
        !isNaN(m.lng)
    );
    if (valid.length > 0) {
      const hub = valid.find((m) => m.type === "hub");
      if (hub) return [hub.lat, hub.lng];
      const avgLat = valid.reduce((a, b) => a + b.lat, 0) / valid.length;
      const avgLng = valid.reduce((a, b) => a + b.lng, 0) / valid.length;
      return [avgLat, avgLng];
    }
    return [12.9716, 77.5946];
  }, [parsedSpec]);

  const radiusKm = parsedSpec?.radiusKm || 3;

  // ── Unified Layer Renderer ──
  const renderMapLayers = useCallback(
    (L: any, map: any, shouldFitBounds: boolean = false) => {
      if (!map || !containerRef.current || !parsedSpec) return;

      if (!circleGroupRef.current) {
        circleGroupRef.current = L.layerGroup().addTo(map);
      }
      if (!markersGroupRef.current) {
        markersGroupRef.current = L.layerGroup().addTo(map);
      }

      const circleGroup = circleGroupRef.current;
      const markersGroup = markersGroupRef.current;

      circleGroup.clearLayers();
      markersGroup.clearLayers();

      // ── Render Concentric Catchment Rings ──
      const radiusMeters = radiusKm * 1000;
      const outerCircle = L.circle(computedCenter, {
        radius: radiusMeters,
        color: "#059669",
        weight: 2,
        dashArray: "6, 6",
        fillColor: "#10b981",
        fillOpacity: activeTile === "satellite" ? 0.22 : 0.1,
      }).addTo(circleGroup);
      outerCircleRef.current = outerCircle;

      L.circle(computedCenter, {
        radius: radiusMeters * 0.5,
        color: "#059669",
        weight: 1.2,
        dashArray: "3, 4",
        fill: false,
        opacity: 0.45,
      }).addTo(circleGroup);

      // ── Center Target Crosshair Pin ──
      const centerIcon = L.divIcon({
        className: "atheris-center-icon",
        html: `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
            <div style="position: absolute; inset: -4px; border-radius: 9999px; background: rgba(5, 150, 105, 0.4); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 28px; height: 28px; border-radius: 9999px; background: #059669; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.45); border: 2.5px solid white;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="2" x2="12" y2="6"/>
                <line x1="12" y1="18" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="6" y2="12"/>
                <line x1="18" y1="12" x2="22" y2="12"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const centerMarker = L.marker(computedCenter, {
        icon: centerIcon,
        zIndexOffset: 1200,
      }).addTo(markersGroup);

      centerMarker.bindTooltip(
        `<strong>🎯 Target Enterprise Hub</strong><br/>` +
          `<span style="color:#10b981;font-weight:700;">${parsedSpec.title || "Catchment Anchor"}</span><br/>` +
          `<span style="font-size:10px;color:#aaa;">Catchment: ${radiusKm}km radius</span>`,
        { className: "atheris-station-tooltip", direction: "top", offset: [0, -20] }
      );

      // ── Competitor Markers Layer ──
      const markers = parsedSpec.markers || [];

      markers.forEach((m) => {
        if (
          typeof m.lat !== "number" ||
          typeof m.lng !== "number" ||
          isNaN(m.lat) ||
          isNaN(m.lng)
        ) {
          return;
        }

        if (
          Math.abs(m.lat - computedCenter[0]) < 0.0001 &&
          Math.abs(m.lng - computedCenter[1]) < 0.0001 &&
          m.type === "hub"
        ) {
          return;
        }

        const isHighThreat = m.threatLevel === "High";
        const isMedThreat = m.threatLevel === "Medium";
        const isMandi = m.type === "mandi";

        const threatColor = isMandi
          ? "#f59e0b"
          : isHighThreat
            ? "#ef4444"
            : isMedThreat
              ? "#f59e0b"
              : "#10b981";

        const threatBg = isMandi
          ? "linear-gradient(135deg, #d97706, #b45309)"
          : isHighThreat
            ? "linear-gradient(135deg, #ef4444, #dc2626)"
            : isMedThreat
              ? "linear-gradient(135deg, #f59e0b, #d97706)"
              : "linear-gradient(135deg, #10b981, #059669)";

        const bubbleContent = m.rating
          ? `${m.rating.toFixed(1)}★`
          : isMandi
            ? "🌾 MANDI"
            : isHighThreat
              ? "HIGH"
              : isMedThreat
                ? "MED"
                : "LOW";

        const cleanName = m.title.length > 22 ? `${m.title.slice(0, 20)}…` : m.title;

        const compIcon = L.divIcon({
          className: "atheris-div-icon",
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translate(-50%, -50%); cursor: pointer;">
              <div style="
                background: ${threatBg};
                color: white;
                font-size: 10px;
                font-weight: 800;
                padding: 2px 7px;
                border-radius: 9999px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.35);
                border: 1.5px solid white;
                white-space: nowrap;
                letter-spacing: 0.02em;
                display: flex;
                align-items: center;
                gap: 2px;
              ">
                ${bubbleContent}
              </div>
              <div style="
                margin-top: 3px;
                background: rgba(14, 16, 23, 0.92);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 4px;
                padding: 1px 5px;
                color: #f3f4f6;
                font-size: 9px;
                font-weight: 700;
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                pointer-events: none;
              ">${cleanName}</div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([m.lat, m.lng], {
          icon: compIcon,
          zIndexOffset: isHighThreat ? 950 : 850,
        }).addTo(markersGroup);

        const ratingText = m.rating
          ? `<span style="color:#fbbf24;font-weight:700;">${m.rating}★</span> (${m.reviews || 0} reviews) · `
          : "";

        marker.bindTooltip(
          `<div style="min-width: 170px; max-width: 240px; font-family: inherit;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:4px;">
              <strong style="color:#fff; font-size:12px; line-height:1.2;">${m.title}</strong>
              ${
                m.threatLevel
                  ? `<span style="font-size:8px; font-weight:800; text-transform:uppercase; color:white; background:${threatColor}; padding:1px 5px; border-radius:3px;">
                      ${m.threatLevel}
                    </span>`
                  : ""
              }
            </div>
            <div style="font-size:10px; color:#9ca3af; margin-bottom:4px;">
              📍 ${m.distance || "In catchment"} ${m.landmark ? `• ${m.landmark}` : ""}
            </div>
            ${
              m.address
                ? `<div style="font-size:9.5px; color:#cbd5e1; margin-bottom:3px; line-clamp:2;">${m.address}</div>`
                : ""
            }
            <div style="font-size:10px; color:#d1d5db; margin-bottom:2px;">
              ${ratingText}<span style="color:#10b981; font-weight:600;">${m.speciality || m.description || "Local Establishment"}</span>
            </div>
            ${
              m.priceRange
                ? `<div style="font-size:9px; color:#9ca3af;">Price: ${m.priceRange}</div>`
                : ""
            }
            ${
              m.differentiator
                ? `<div style="font-size:9px; color:#6ee7b7; font-style:italic; margin-top:4px; border-top:1px solid rgba(255,255,255,0.1); padding-top:3px;">
                    ${m.differentiator}
                   </div>`
                : ""
            }
          </div>`,
          { className: "atheris-station-tooltip", direction: "top", offset: [0, -18] }
        );

        marker.on("mouseover", () => setHoveredPlaceName(m.title));
        marker.on("mouseout", () => setHoveredPlaceName(null));
      });

      // Fit bounds to encompass both the catchment circle and plotted markers
      if (shouldFitBounds) {
        try {
          if (outerCircle && markersGroup && markersGroup.getLayers().length > 0) {
            const groupBounds = L.featureGroup([outerCircle, markersGroup]).getBounds();
            if (groupBounds.isValid()) {
              map.fitBounds(groupBounds, {
                padding: [30, 30],
                maxZoom: 15,
                animate: false,
              });
              hasFittedInitialBoundsRef.current = true;
            }
          } else if (outerCircle) {
            map.fitBounds(outerCircle.getBounds(), {
              padding: [25, 25],
              maxZoom: 15,
              animate: false,
            });
            hasFittedInitialBoundsRef.current = true;
          }
        } catch (_) {}
      }

      map.invalidateSize({ debounceMoveend: true });
    },
    [parsedSpec, computedCenter, radiusKm, activeTile]
  );

  // ── Switch Tile Layer ──
  const switchTiles = useCallback((key: string) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    import("leaflet").then((L) => {
      const cfg = TILE_CONFIGS[key] || TILE_CONFIGS.google;
      const newLayer = L.tileLayer(cfg.url, {
        maxZoom: 20,
        subdomains: cfg.subdomains || ["mt0", "mt1", "mt2", "mt3"],
      }).addTo(map);

      tileLayerRef.current = newLayer;
      setActiveTile(key);
    });
  }, []);

  // ── Re-center Handler ──
  const handleRecenter = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (outerCircleRef.current && markersGroupRef.current) {
      import("leaflet").then((L) => {
        try {
          const groupBounds = L.featureGroup([
            outerCircleRef.current,
            markersGroupRef.current,
          ]).getBounds();
          if (groupBounds.isValid()) {
            map.fitBounds(groupBounds, {
              padding: [30, 30],
              maxZoom: 15,
              animate: true,
            });
            return;
          }
        } catch (_) {}
        try {
          map.fitBounds(outerCircleRef.current.getBounds(), {
            padding: [25, 25],
            maxZoom: 15,
            animate: true,
          });
          return;
        } catch (_) {}
        map.setView(computedCenter, parsedSpec?.zoom || 14, { animate: true });
      });
    } else {
      map.setView(computedCenter, parsedSpec?.zoom || 14, { animate: true });
    }
  }, [computedCenter, parsedSpec?.zoom]);

  // ── 1. Initialize Leaflet Map ONCE on Mount & Immediately Draw All Layers ──
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    let isCancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const timers: NodeJS.Timeout[] = [];

    import("leaflet").then((L) => {
      if (isCancelled || !containerRef.current) return;

      if (mapInstanceRef.current) {
        return; // Already initialized!
      }

      try {
        const map = L.map(containerRef.current, {
          center: computedCenter,
          zoom: parsedSpec?.zoom || (radiusKm <= 3 ? 15 : radiusKm <= 6 ? 14 : 13),
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: true,
        });

        mapInstanceRef.current = map;

        // Custom clean zoom control at bottom-right
        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Ground scale bar at bottom-left
        L.control
          .scale({
            imperial: false,
            metric: true,
            position: "bottomleft",
            maxWidth: 100,
          })
          .addTo(map);

        // Default Google Maps vector tile layer
        const cfg = TILE_CONFIGS[activeTile] || TILE_CONFIGS.google;
        const tileLayer = L.tileLayer(cfg.url, {
          maxZoom: 20,
          subdomains: cfg.subdomains || ["mt0", "mt1", "mt2", "mt3"],
        }).addTo(map);
        tileLayerRef.current = tileLayer;

        // Dedicated layer groups
        circleGroupRef.current = L.layerGroup().addTo(map);
        markersGroupRef.current = L.layerGroup().addTo(map);

        map.on("zoomend", () => {
          setCurrentZoom(map.getZoom());
        });

        // 💥 IMMEDIATELY RENDER ALL LAYERS & FIT BOUNDS ON INITIAL LOAD!
        renderMapLayers(L, map, true);
        setIsMapReady(true);

        // ── ResizeObserver to constantly refresh map tiles when container resizes or unhides ──
        if (typeof ResizeObserver !== "undefined" && containerRef.current) {
          resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
              if (entry.contentRect.width > 80 && entry.contentRect.height > 80) {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.invalidateSize({ debounceMoveend: true });
                  if (!hasFittedInitialBoundsRef.current && outerCircleRef.current) {
                    try {
                      mapInstanceRef.current.fitBounds(outerCircleRef.current.getBounds(), {
                        padding: [25, 25],
                        maxZoom: 15,
                        animate: false,
                      });
                      hasFittedInitialBoundsRef.current = true;
                    } catch (_) {}
                  }
                }
              }
            }
          });
          resizeObserver.observe(containerRef.current);
        }

        // Staggered size calculations for modal/tab animation transitions
        [50, 150, 300, 600, 1000].forEach((delay) => {
          const t = setTimeout(() => {
            if (mapInstanceRef.current && containerRef.current) {
              const w = containerRef.current.clientWidth;
              const h = containerRef.current.clientHeight;
              if (w > 80 && h > 80) {
                mapInstanceRef.current.invalidateSize({ debounceMoveend: true });
                if (!hasFittedInitialBoundsRef.current && outerCircleRef.current) {
                  try {
                    mapInstanceRef.current.fitBounds(outerCircleRef.current.getBounds(), {
                      padding: [25, 25],
                      maxZoom: 15,
                      animate: false,
                    });
                    hasFittedInitialBoundsRef.current = true;
                  } catch (_) {}
                }
              }
            }
          }, delay);
          timers.push(t);
        });
      } catch (err: any) {
        console.warn("[InteractiveMap] initialization error:", err?.message);
      }
    });

    const handleWindowResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ debounceMoveend: true });
      }
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      isCancelled = true;
      window.removeEventListener("resize", handleWindowResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      timers.forEach((t) => clearTimeout(t));
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setIsMapReady(false);
    };
  }, []);

  // ── 2. Update Circles & Markers when data changes AFTER initial mount ──
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || !parsedSpec) return;

    import("leaflet").then((L) => {
      renderMapLayers(L, mapInstanceRef.current, false);
    });
  }, [isMapReady, parsedSpec, activeTile, renderMapLayers]);

  if (!parsedSpec) {
    return (
      <div className="my-3 w-full rounded-2xl border border-sage/20 dark:border-zinc-800 bg-muted/20 p-4 text-xs text-muted-foreground">
        Map parameters could not be parsed.
      </div>
    );
  }

  const markersCount = parsedSpec.markers?.length || 0;

  return (
    <div
      className={cn(
        "relative my-3 w-full rounded-2xl overflow-hidden border border-sage/40 dark:border-border shadow-md bg-[#0c0e14] not-prose",
        className
      )}
      style={{ height }}
    >
      {/* ── Leaflet DOM Container ── */}
      <div ref={containerRef} className="w-full h-full z-0" />

      {/* ── Atheris Center Crosshair HUD Overlay ── */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none opacity-40 hover:opacity-80 transition-opacity"
        style={{ filter: "drop-shadow(0 0 6px rgba(16, 185, 129, 0.4))" }}
      >
        <svg width="40" height="40" viewBox="0 0 60 60" fill="none">
          <line x1="30" y1="0" x2="30" y2="18" stroke="#10b981" strokeWidth="1.5" />
          <line x1="30" y1="42" x2="30" y2="60" stroke="#10b981" strokeWidth="1.5" />
          <line x1="0" y1="30" x2="18" y2="30" stroke="#10b981" strokeWidth="1.5" />
          <line x1="42" y1="30" x2="60" y2="30" stroke="#10b981" strokeWidth="1.5" />
          <circle cx="30" cy="30" r="3" stroke="#10b981" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      {/* ── Floating Top-Left: Catchment Status Badge ── */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        <div className="bg-black/80 dark:bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 dark:border-border/80 shadow-md flex items-center gap-2 pointer-events-none">
          <div className="size-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="text-[11px] font-bold text-white dark:text-emerald-400 font-mono tracking-tight">
            {radiusKm}km Catchment • {parsedSpec.title || "Market Radar"}
          </div>
        </div>

        {markersCount > 0 && (
          <div className="bg-black/75 dark:bg-card/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 dark:border-border/60 shadow-xs flex items-center gap-1.5 self-start">
            <Store className="size-3 text-amber-400 shrink-0" />
            <span className="text-[10px] font-bold text-zinc-200">
              {markersCount} Verified Locations Plotted
            </span>
          </div>
        )}

        {hoveredPlaceName && (
          <div className="bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-xs animate-in fade-in duration-150 self-start pointer-events-none">
            {hoveredPlaceName}
          </div>
        )}
      </div>

      {/* ── Floating Top-Right: Re-Center & Inspect SerpApi Payload Buttons ── */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button
          onClick={() => setIsPayloadModalOpen(true)}
          title="Inspect SerpApi JSON Payload"
          className="px-2 py-1.5 bg-black/80 dark:bg-card/90 backdrop-blur-md hover:bg-black/95 border border-emerald-500/40 rounded-xl text-emerald-400 font-bold text-[10px] shadow-sm transition-all flex items-center gap-1.5 cursor-pointer font-mono"
        >
          <Code2 className="size-3 text-emerald-400" />
          <span className="hidden sm:inline">INSPECT</span>
          <span>SERPAPI</span>
        </button>

        <button
          onClick={handleRecenter}
          title="Re-center Catchment Area"
          className="px-2.5 py-1.5 bg-black/75 dark:bg-card/85 backdrop-blur-md hover:bg-black/90 border border-white/15 dark:border-border/80 rounded-xl text-white font-bold text-[10px] shadow-sm transition-all flex items-center gap-1.5 cursor-pointer font-mono"
        >
          <Crosshair className="size-3 text-emerald-400" />
          <span className="hidden sm:inline">RE-CENTER</span>
        </button>
      </div>

      {/* ── Floating Bottom-Left: Atheris Tile Switcher (G-MAP / SAT / DARK) ── */}
      <div className="absolute bottom-9 left-2.5 z-10 flex items-center gap-1 bg-black/80 dark:bg-card/90 backdrop-blur-md p-1 rounded-lg border border-white/10 dark:border-border/80 shadow-md">
        {Object.entries(TILE_CONFIGS).map(([key, cfg]) => {
          const isActive = activeTile === key;
          return (
            <button
              key={key}
              onClick={() => switchTiles(key)}
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${
                isActive
                  ? "bg-emerald-500/25 border border-emerald-400/80 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                  : "text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* ── Floating Bottom-Left: Coordinates HUD Badge ── */}
      <div className="absolute bottom-2 left-28 z-10 pointer-events-none hidden sm:flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[9px] font-mono text-zinc-400">
        <span className="text-emerald-400">LAT:</span> {computedCenter[0].toFixed(4)}
        <span className="text-emerald-400 ml-1">LON:</span> {computedCenter[1].toFixed(4)}
      </div>

      {/* ── Global Atheris Leaflet Styles ── */}
      <style jsx global>{`
        .leaflet-container {
          background-color: #0c0e14 !important;
        }
        .atheris-div-icon,
        .atheris-center-icon {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-tooltip.atheris-station-tooltip {
          background: rgba(14, 16, 23, 0.96) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(16, 185, 129, 0.35) !important;
          border-radius: 8px !important;
          color: #f3f4f6 !important;
          padding: 8px 10px !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
          font-family: inherit !important;
          line-height: 1.4 !important;
        }
        .leaflet-tooltip.atheris-station-tooltip::before {
          border-top-color: rgba(14, 16, 23, 0.96) !important;
        }
        .leaflet-control-zoom {
          margin-right: 12px !important;
          margin-bottom: 12px !important;
          border: none !important;
        }
        .leaflet-control-zoom a {
          background: rgba(14, 16, 23, 0.9) !important;
          color: #10b981 !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(16, 185, 129, 0.25) !important;
          color: #fff !important;
        }
        .leaflet-control-scale {
          margin-left: 10px !important;
          margin-bottom: 8px !important;
        }
        .leaflet-control-scale-line {
          background: rgba(12, 14, 20, 0.88) !important;
          backdrop-filter: blur(8px) !important;
          border: 1px solid rgba(16, 185, 129, 0.4) !important;
          border-top: none !important;
          color: #34d399 !important;
          font-size: 9px !important;
          font-family: monospace !important;
          font-weight: 700 !important;
          padding: 1px 6px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5) !important;
        }
      `}</style>
      {/* ── SerpApi JSON Inspection Modal ── */}
      <SerpApiPayloadModal
        isOpen={isPayloadModalOpen}
        onClose={() => setIsPayloadModalOpen(false)}
        data={{
          engine: "google_maps",
          query: parsedSpec.title || "Nearby Commercial Competitors",
          location: (parsedSpec.markers && parsedSpec.markers[0]?.address) || "Local Catchment",
          coordinates: parsedSpec.center
            ? `@${parsedSpec.center[0].toFixed(5)},${parsedSpec.center[1].toFixed(5)},14z`
            : undefined,
          radiusKm: parsedSpec.radiusKm || radiusKm,
          resultsCount: markersCount,
          items: (parsedSpec.markers || []).map((m) => ({
            title: m.title,
            rating: m.rating,
            reviews: m.reviews,
            threatLevel: m.threatLevel,
            distance: m.distance,
            address: m.address || m.landmark,
            gps_coordinates: { latitude: m.lat, longitude: m.lng },
            type: m.type,
          })),
        }}
      />
    </div>
  );
}
