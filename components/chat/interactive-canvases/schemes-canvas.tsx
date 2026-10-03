"use client";

import React from "react";
import { Landmark, ExternalLink, CheckSquare, ShieldCheck } from "lucide-react";
import type { SchemesEvaluationPayload } from "@/lib/agent/subagents/schemes-subagent";

interface SchemesCanvasProps {
  data: SchemesEvaluationPayload;
}

export function SchemesCanvas({ data }: SchemesCanvasProps) {
  return (
    <div className="space-y-6 text-foreground">
      {/* Top Pick Recommendation Banner */}
      <div className="p-4.5 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Top Recommendation for {data.businessSector}</span>
        </div>
        <h3 className="text-base font-bold text-foreground">
          {data.topRecommendation.schemeName}
        </h3>
        <p className="text-xs text-muted-foreground">{data.topRecommendation.reason}</p>
        <div className="inline-block px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs mt-1">
          {data.topRecommendation.potentialSavingsOrSubsidy}
        </div>
      </div>

      {/* Schemes Grid */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold">Matched Government Subsidies & Credit Facilities</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.schemes.map((scheme) => (
            <div
              key={scheme.id}
              className="p-4.5 rounded-2xl border border-border/80 bg-card space-y-3 text-xs"
            >
              <div className="flex justify-between items-start gap-2">
                <h5 className="font-bold text-sm text-foreground">{scheme.name}</h5>
                <a
                  href={scheme.officialPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded-md text-muted-foreground hover:text-primary transition-colors shrink-0"
                  title="Official Portal"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Assistance Cap:</span>
                  <span className="font-semibold text-foreground">{scheme.maxAssistance}</span>
                </div>
                {scheme.subsidyPercentage && (
                  <div className="flex justify-between">
                    <span>Subsidy:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {scheme.subsidyPercentage}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Collateral:</span>
                  <span className="font-medium text-foreground">
                    {scheme.collateralRequired ? "Required" : "Collateral-Free"}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground bg-secondary/30 p-2 rounded-lg">
                {scheme.keyBenefit}
              </p>

              {/* Application Checklist */}
              <div className="pt-2 border-t border-border/50 space-y-1.5">
                <span className="font-semibold text-[11px] text-foreground flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5 text-primary" /> Application Readiness Checklist:
                </span>
                <ul className="space-y-1 pl-1">
                  {scheme.checklist.map((item, idx) => (
                    <li key={idx} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
