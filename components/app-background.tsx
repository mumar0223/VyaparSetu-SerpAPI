"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AppBackgroundProps {
  className?: string;
}

export function AppBackground({ className }: AppBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 overflow-hidden pointer-events-none select-none z-0 bg-[#f0f0df]",
        className,
      )}
    >
      {/* ── Subtle SVG Geometric Pattern (Star/Burst lattice) ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg stroke='%230F172A' stroke-width='0.4' stroke-opacity='0.12'%3E%3Ccircle cx='30' cy='30' r='14'/%3E%3Ccircle cx='0' cy='30' r='14'/%3E%3Ccircle cx='60' cy='30' r='14'/%3E%3Ccircle cx='30' cy='0' r='14'/%3E%3Ccircle cx='30' cy='60' r='14'/%3E%3C/g%3E%3Ccircle cx='30' cy='30' r='1.5' fill='%230F172A' fill-opacity='0.07'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: "60px 60px",
          opacity: 1,
        }}
      />

      {/* ── Aurora Blurred Shapes ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#0EA5A4] rounded-full mix-blend-multiply opacity-[0.06] blur-[120px] animate-float-soft" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#06B6D4] rounded-full mix-blend-multiply opacity-[0.06] blur-[120px] animate-float-soft" style={{ animationDelay: "2s" }} />
      <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-[#F59E0B] rounded-full mix-blend-multiply opacity-[0.05] blur-[120px] animate-float-soft" style={{ animationDelay: "4s" }} />

      {/* ── Soft Vignette ── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#f0f0df_85%)] opacity-75 pointer-events-none" />
    </div>
  );
}

// Alias export for flexibility
export const HexagonalGridBackground = AppBackground;
