"use client";

import React from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  Crosshair,
  MapPin,
  Star,
  CheckCircle,
} from "lucide-react";
export interface SWOTAnalysisPayload {
  businessCategory: string;
  location: string;
  radiusKm: number;
  totalCompetitorsFound: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  competitorHighlights?: Array<{
    name: string;
    distance: string;
    threatLevel: "High" | "Medium" | "Low";
    rating?: number;
  }>;
  strategicActionPlan: string[];
}

interface SWOTCanvasProps {
  data: SWOTAnalysisPayload;
}

export function SWOTCanvas({ data }: SWOTCanvasProps) {
  return (
    <div className="space-y-6 text-foreground">
      {/* Overview Banner */}
      <div className="p-4 rounded-xl bg-secondary/30 border border-border flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
              Hyper-Local Radar
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500" /> {data.location} ({data.radiusKm}km radius)
            </span>
          </div>
          <h3 className="text-base font-bold">{data.businessCategory}</h3>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-primary">{data.totalCompetitorsFound}</span>
          <p className="text-[11px] text-muted-foreground">Competitors Scanned on Google Maps</p>
        </div>
      </div>

      {/* 4-Quadrant SWOT Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Strengths */}
        <div className="p-4.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>STRENGTHS (Internal Advantages)</span>
          </div>
          <ul className="space-y-2">
            {data.strengths.map((s, idx) => (
              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 2. Weaknesses */}
        <div className="p-4.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>WEAKNESSES (Internal Constraints)</span>
          </div>
          <ul className="space-y-2">
            {data.weaknesses.map((w, idx) => (
              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Opportunities */}
        <div className="p-4.5 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-3">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-semibold text-sm">
            <Lightbulb className="w-4 h-4" />
            <span>OPPORTUNITIES (Market Openings)</span>
          </div>
          <ul className="space-y-2">
            {data.opportunities.map((o, idx) => (
              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 4. Threats */}
        <div className="p-4.5 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-sm">
            <Crosshair className="w-4 h-4" />
            <span>THREATS (External Risks)</span>
          </div>
          <ul className="space-y-2">
            {data.threats.map((t, idx) => (
              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Top Competitor Highlights from Google Maps */}
      {data.competitorHighlights && data.competitorHighlights.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <span>Nearby Google Maps Competitors</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {data.competitorHighlights.map((comp, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-border/80 bg-card/70 space-y-1.5 text-xs"
              >
                <div className="flex justify-between items-start gap-1">
                  <span className="font-semibold text-foreground line-clamp-1">{comp.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                      comp.threatLevel === "High"
                        ? "bg-rose-500/10 text-rose-500"
                        : comp.threatLevel === "Medium"
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-emerald-500/10 text-emerald-500"
                    }`}
                  >
                    {comp.threatLevel}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{comp.distance}</span>
                  {comp.rating && (
                    <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      {comp.rating}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategic Action Plan Checklist */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4" />
          <span>Strategic Next Steps Recommended by Agent</span>
        </h4>
        <div className="space-y-1.5">
          {data.strategicActionPlan.map((action, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-foreground">
              <span className="font-bold text-primary">{idx + 1}.</span>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
