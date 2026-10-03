"use client";

import { useState } from "react";
import {
  Target,
  Landmark,
  Coins,
  Store,
  CreditCard,
  CheckCircle2,
  ExternalLink,
  Bot,
  Compass,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Flame,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ToolCallItem } from "./types";
import { MarkdownMessage } from "./markdown-message";
import type { ArtifactPayload } from "./artifact-modal";

interface SwarmTabsCardProps {
  toolCalls: ToolCallItem[];
  onOpenArtifact?: (artifact: ArtifactPayload) => void;
}

interface AwakenedDomain {
  id: string;
  type: "swot" | "schemes" | "mandi" | "competitors" | "credit";
  title: string;
  icon: any;
  result: any;
}

export function SwarmTabsCard({ toolCalls, onOpenArtifact }: SwarmTabsCardProps) {
  const awakenedDomains: AwakenedDomain[] = [];

  toolCalls.forEach((tc, idx) => {
    if (!tc.result) return;
    const res = tc.result as any;
    const args = (tc.args || {}) as any;

    if (tc.toolName === "runSWOTScan") {
      const cat = args.category || res.businessCategory || "";
      awakenedDomains.push({
        id: tc.toolCallId || `swot_${idx}`,
        type: "swot",
        title: cat ? `🎯 SWOT: ${cat.slice(0, 16)}` : "🎯 SWOT Analysis",
        icon: Target,
        result: res.swot || res.data || res,
      });
    } else if (tc.toolName === "evaluateGovtSchemes") {
      const sec = args.businessSector || res.businessSector || "";
      awakenedDomains.push({
        id: tc.toolCallId || `schemes_${idx}`,
        type: "schemes",
        title: sec ? `🏛️ Schemes: ${sec.slice(0, 16)}` : "🏛️ Govt Schemes",
        icon: Landmark,
        result: res.schemes || res.data || res,
      });
    } else if (tc.toolName === "getMandiArbitrage") {
      const comm = args.commodity || res.commodity || res.data?.commodity || "";
      const cleanComm = comm ? comm.split(/[(/ ]/)[0] : "";
      awakenedDomains.push({
        id: tc.toolCallId || `mandi_${idx}_${cleanComm || idx}`,
        type: "mandi",
        title: cleanComm ? `🌾 Mandi: ${cleanComm}` : "🌾 Mandi Arbitrage",
        icon: Coins,
        result: res.mandi || res.commodities || res.data || res,
      });
    } else if (tc.toolName === "scanCatchmentRadar") {
      const cat = args.category || res.category || "";
      awakenedDomains.push({
        id: tc.toolCallId || `competitors_${idx}`,
        type: "competitors",
        title: cat ? `🏪 Radar: ${cat.slice(0, 16)}` : "🏪 Competitor Radar",
        icon: Store,
        result: res.competitors || res.data || res,
      });
    } else if (tc.toolName === "evaluateCreditAndEMI") {
      const amt = args.amount ? `₹${Math.round(args.amount / 100000)}L` : "";
      awakenedDomains.push({
        id: tc.toolCallId || `credit_${idx}`,
        type: "credit",
        title: amt ? `💳 Loan: ${amt}` : "💳 Credit & Loan",
        icon: CreditCard,
        result: res.credit || res.data || res,
      });
    }
  });

  // If no domain agents were awakened, don't render anything
  if (awakenedDomains.length === 0) return null;

  const isMultiDomain = awakenedDomains.length > 1;
  const [activeTabId, setActiveTabId] = useState<string>(awakenedDomains[0].id);

  const currentDomain =
    awakenedDomains.find((d) => d.id === activeTabId) || awakenedDomains[0];

  return (
    <div className="w-full my-3 font-sans animate-in fade-in duration-200">
      {/* ── Header: Minimal inline status line (no borders, no gradients) ── */}
      <div className="flex items-center justify-between gap-2 py-1 text-xs text-muted-foreground border-b border-muted/20">
        <div className="flex items-center gap-1.5">
          <Compass className="size-3.5 text-forest dark:text-mint" />
          <span className="font-semibold text-foreground/80">AI Saathi Intelligence</span>
          <span>•</span>
          <span>
            {awakenedDomains.length}{" "}
            {awakenedDomains.length === 1 ? "Specialized Agent" : "Specialized Agents"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {currentDomain.result?.content && onOpenArtifact && (
            <button
              type="button"
              onClick={() =>
                onOpenArtifact({
                  artifactType: "document",
                  title: currentDomain.title,
                  summary: currentDomain.result?.summary,
                  data: currentDomain.result,
                })
              }
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-forest dark:hover:text-mint transition-colors cursor-pointer"
              title="Open full detailed artifact in modal"
            >
              <span>Expand Artifact</span>
              <ArrowUpRight className="size-3" />
            </button>
          )}

          <Link
            href="/enterprise"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-forest dark:hover:text-mint transition-colors"
            title="Open in Enterprise Hub"
          >
            <span>Saved to Enterprise Hub</span>
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* ── Dynamic Tab Bar: Clean minimal text tabs (ONLY when 2 or more agents awakened) ── */}
      {isMultiDomain && (
        <div className="flex items-center gap-4 pt-2 pb-1 overflow-x-auto border-b border-muted/20">
          {awakenedDomains.map((domain) => {
            const Icon = domain.icon;
            const isActive = domain.id === activeTabId;
            return (
              <button
                key={domain.id}
                onClick={() => setActiveTabId(domain.id)}
                className={cn(
                  "flex items-center gap-1.5 pb-1 text-xs transition-colors cursor-pointer whitespace-nowrap",
                  isActive
                    ? "text-forest dark:text-mint font-bold border-b-2 border-forest dark:border-mint -mb-[1px]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span>{domain.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content Viewport: Clean, borderless, matching chat markdown ── */}
      <div className="py-2.5">
        {currentDomain.type === "swot" && (
          <SwotDomainContent data={currentDomain.result} />
        )}
        {currentDomain.type === "schemes" && (
          <SchemesDomainContent data={currentDomain.result} />
        )}
        {currentDomain.type === "mandi" && (
          <MandiDomainContent data={currentDomain.result} />
        )}
        {currentDomain.type === "competitors" && (
          <CompetitorsDomainContent data={currentDomain.result} />
        )}
        {currentDomain.type === "credit" && (
          <CreditDomainContent data={currentDomain.result} />
        )}
      </div>
    </div>
  );
}

function SwotDomainContent({ data }: { data: any }) {
  const strengths = data?.strengths || [];
  const weaknesses = data?.weaknesses || [];
  const opportunities = data?.opportunities || [];
  const threats = data?.threats || [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1 text-xs">
      <div className="border-l-2 border-emerald-500 pl-3 py-1 space-y-1">
        <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5" /> Strengths (ताकत)
        </div>
        <ul className="space-y-1 text-foreground/85">
          {strengths.slice(0, 3).map((s: string, i: number) => (
            <li key={i}>• {s}</li>
          ))}
        </ul>
      </div>

      <div className="border-l-2 border-amber-500 pl-3 py-1 space-y-1">
        <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="size-3.5" /> Weaknesses (कमजोरी)
        </div>
        <ul className="space-y-1 text-foreground/85">
          {weaknesses.slice(0, 3).map((w: string, i: number) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      </div>

      <div className="border-l-2 border-sky-500 pl-3 py-1 space-y-1">
        <div className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
          <TrendingUp className="size-3.5" /> Opportunities (अवसर)
        </div>
        <ul className="space-y-1 text-foreground/85">
          {opportunities.slice(0, 3).map((o: string, i: number) => (
            <li key={i}>• {o}</li>
          ))}
        </ul>
      </div>

      <div className="border-l-2 border-rose-500 pl-3 py-1 space-y-1">
        <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
          <Flame className="size-3.5" /> Threats (चुनौतियां)
        </div>
        <ul className="space-y-1 text-foreground/85">
          {threats.slice(0, 3).map((t: string, i: number) => (
            <li key={i}>• {t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SchemesDomainContent({ data }: { data: any }) {
  const schemesList = Array.isArray(data) ? data : data?.schemes || [];

  return (
    <div className="divide-y divide-muted/20 text-xs">
      {schemesList.slice(0, 4).map((s: any, idx: number) => (
        <div key={idx} className="py-2.5 space-y-1">
          <div className="flex justify-between items-center gap-2">
            <h4 className="font-bold text-foreground">
              {s.title || s.name}
            </h4>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {s.badge || "Subsidized"}
            </span>
          </div>
          <div className="font-mono text-emerald-700 dark:text-mint font-semibold">
            {s.subsidy || s.amount || "Govt Capital Grant"}
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            {s.eligibility || s.features || "Eligible for registered micro-enterprises."}
          </p>
        </div>
      ))}
    </div>
  );
}

function MandiDomainContent({ data }: { data: any }) {
  if (data?.content) {
    return (
      <div className="py-1">
        <MarkdownMessage content={data.content} variant="assistant" />
      </div>
    );
  }

  const commName = data?.commodity || "Commodity";
  const records = Array.isArray(data)
    ? data
    : data?.rates || data?.commodities || data?.records || [];

  const advisory = data?.aiAdvisory;

  return (
    <div className="space-y-3 text-xs">
      {records.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-sage/30 dark:border-border bg-white dark:bg-card shadow-2xs">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-cream/50 dark:bg-muted/40 font-serif font-bold text-forest dark:text-mint text-[11px] border-b border-sage/20 dark:border-border">
              <tr>
                <th className="py-2.5 px-3">Commodity</th>
                <th className="py-2.5 px-3">Market Yard</th>
                <th className="py-2.5 px-3">Modal Rate</th>
                <th className="py-2.5 px-3">Daily Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage/15 dark:divide-border/40 font-mono">
              {records.slice(0, 5).map((c: any, idx: number) => {
                const modal = typeof c.modalPrice === "number"
                  ? `₹${c.modalPrice.toLocaleString("en-IN")}/qtl`
                  : c.modalPrice || c.price || "Active Trading";
                const range = (c.minPrice && c.maxPrice)
                  ? `₹${c.minPrice} - ₹${c.maxPrice}`
                  : c.priceRange || "Spot Trading";
                return (
                  <tr key={idx} className="hover:bg-cream/20 dark:hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3 font-bold font-sans text-foreground">
                      {c.commodity || c.name || commName}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground font-sans">
                      {c.mandiName || c.market || c.mandi || "APMC Yard"}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-forest dark:text-mint">
                      {modal}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                      {range}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-2 text-muted-foreground">
          Market records active for {commName}.
        </div>
      )}

      {advisory && (
        <blockquote className="border-l-2 border-mint pl-3.5 italic text-sm text-foreground/90 bg-mint-pale/20 dark:bg-mint/5 py-1.5 rounded-r-lg mt-3">
          <span className="font-semibold text-forest dark:text-mint not-italic font-sans">Arbitrage Advisory:</span> {advisory}
        </blockquote>
      )}
    </div>
  );
}

function CompetitorsDomainContent({ data }: { data: any }) {
  const compList = Array.isArray(data) ? data : data?.competitors || [];

  return (
    <div className="divide-y divide-muted/20 text-xs">
      {compList.slice(0, 3).map((c: any, idx: number) => (
        <div key={idx} className="py-2 space-y-0.5">
          <div className="flex justify-between items-center gap-2">
            <span className="font-bold text-foreground truncate max-w-[200px]">
              {c.name}
            </span>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              ★ {c.rating || "4.2"}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span>{c.distance || "Within 1.5 km"}</span>
            <span>•</span>
            <span className="text-foreground/80">{c.differentiator || "Local trade competitor."}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CreditDomainContent({ data }: { data: any }) {
  return (
    <div className="flex flex-wrap items-center gap-6 py-2 text-xs">
      <div>
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Estimated CIBIL</span>
        <span className="text-base font-bold text-forest dark:text-mint">
          {data?.estimatedCibilScore || 785} / 900
        </span>
      </div>
      <div className="h-6 w-px bg-muted/30" />
      <div>
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">DSCR Ratio</span>
        <span className="text-base font-bold text-forest dark:text-mint">
          {data?.dscr || "2.8x"}
        </span>
      </div>
      <div className="h-6 w-px bg-muted/30" />
      <div>
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Max Recommended Loan</span>
        <span className="text-base font-bold text-forest dark:text-mint">
          {data?.maxRecommendedLoan || "₹25,00,000"}
        </span>
      </div>
    </div>
  );
}
