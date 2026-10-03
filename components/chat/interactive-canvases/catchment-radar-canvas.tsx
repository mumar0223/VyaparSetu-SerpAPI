"use client";

import React, { useState } from "react";
import { MapPin, Star, Compass, Filter, Phone, Globe } from "lucide-react";

interface CatchmentRadarCanvasProps {
  data: {
    category: string;
    location: string;
    radiusKm: number;
    totalFound: number;
    competitors: Array<{
      name: string;
      distance: string;
      landmark: string;
      speciality: string;
      priceRange: string;
      threatLevel: "High" | "Medium" | "Low";
      differentiator: string;
      rating?: number;
      reviews?: number;
    }>;
  };
}

export function CatchmentRadarCanvas({ data }: CatchmentRadarCanvasProps) {
  const [filterThreat, setFilterThreat] = useState<string>("All");

  const filtered = (data.competitors || []).filter((c) => {
    if (filterThreat === "All") return true;
    return c.threatLevel === filterThreat;
  });

  return (
    <div className="space-y-5 text-foreground">
      {/* Header Info */}
      <div className="flex flex-wrap justify-between items-center gap-3 p-4 rounded-xl bg-secondary/30 border border-border">
        <div>
          <h3 className="font-bold text-base flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary animate-spin-slow" />
            <span>{data.category} Radar</span>
          </h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-rose-500" />
            <span>Scanning within {data.radiusKm}km of {data.location}</span>
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs">
          <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
          {["All", "High", "Medium", "Low"].map((level) => (
            <button
              key={level}
              onClick={() => setFilterThreat(level)}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                filterThreat === level
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Competitor Cards List */}
      <div className="space-y-3">
        {filtered.map((shop, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-colors space-y-2 text-xs"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-sm text-foreground">{shop.name}</h4>
                <p className="text-muted-foreground text-[11px] line-clamp-1">{shop.landmark}</p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  shop.threatLevel === "High"
                    ? "bg-rose-500/10 text-rose-500"
                    : shop.threatLevel === "Medium"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-emerald-500/10 text-emerald-500"
                }`}
              >
                {shop.threatLevel} Threat
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span className="font-medium text-foreground">{shop.distance}</span>
              {shop.rating && (
                <span className="flex items-center gap-1 text-amber-500 font-semibold">
                  <Star className="w-3 h-3 fill-amber-500" />
                  {shop.rating} ({shop.reviews || 0} reviews)
                </span>
              )}
              <span className="text-muted-foreground/80">{shop.priceRange}</span>
            </div>

            <p className="text-[11px] text-muted-foreground italic bg-secondary/30 p-2 rounded-lg">
              "{shop.differentiator}"
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
