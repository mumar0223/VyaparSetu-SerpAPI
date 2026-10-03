"use client";

import { useState } from "react";
import {
  Target,
  Landmark,
  Coins,
  Store,
  CreditCard,
  CheckCircle2,
  Compass,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Flame,
  Globe,
  Building2,
  Layers,
  Activity,
  Factory,
  ShieldCheck,
  Truck,
  PackageCheck,
  Zap,
  Scale,
  Leaf,
  Cpu,
  Wrench,
  Maximize2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ToolCallItem } from "./types";
import { MarkdownMessage } from "./markdown-message";
import type { ArtifactPayload } from "./artifact-modal";

function resolveDynamicIcon(iconName?: string) {
  switch (iconName?.toLowerCase()) {
    case "factory":
      return Factory;
    case "shield":
      return ShieldCheck;
    case "truck":
      return Truck;
    case "package":
      return PackageCheck;
    case "zap":
      return Zap;
    case "scale":
      return Scale;
    case "leaf":
      return Leaf;
    case "cpu":
      return Cpu;
    case "wrench":
      return Wrench;
    case "coins":
      return Coins;
    default:
      return Layers;
  }
}

interface SwarmTabsCardProps {
  toolCalls?: ToolCallItem[];
  onOpenArtifact?: (artifact: ArtifactPayload) => void;
}

interface AwakenedDomain {
  id: string;
  type: "swot" | "schemes" | "mandi" | "competitors" | "credit" | "ondc" | "district" | "custom";
  title: string;
  icon: any;
  summary?: string;
  spokenSummary?: string;
  result: any;
}

export function SwarmTabsCard({ toolCalls = [], onOpenArtifact }: SwarmTabsCardProps) {
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
        summary: res.summary,
        spokenSummary: res.spokenSummary,
        result: res.swot || res.data || res,
      });
    } else if (tc.toolName === "evaluateGovtSchemes") {
      const sec = args.businessSector || res.businessSector || "";
      awakenedDomains.push({
        id: tc.toolCallId || `schemes_${idx}`,
        type: "schemes",
        title: sec ? `🏛️ Schemes: ${sec.slice(0, 16)}` : "🏛️ Govt Schemes",
        icon: Landmark,
        summary: res.summary,
        spokenSummary: res.spokenSummary,
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
        summary: res.summary,
        spokenSummary: res.spokenSummary,
        result: res.mandi || res.commodities || res.data || res,
      });
    } else if (tc.toolName === "scanCatchmentRadar" || tc.toolName === "searchCompetitors") {
      const cat = args.category || res.category || "";
      awakenedDomains.push({
        id: tc.toolCallId || `competitors_${idx}`,
        type: "competitors",
        title: cat ? `🏪 Radar: ${cat.slice(0, 16)}` : "🏪 Competitor Radar",
        icon: Store,
        summary: res.summary,
        spokenSummary: res.spokenSummary,
        result: res.competitors || res.data || res,
      });
    } else if (tc.toolName === "evaluateCreditAndEMI") {
      const amt = args.amount ? `₹${Math.round(args.amount / 100000)}L` : "";
      awakenedDomains.push({
        id: tc.toolCallId || `credit_${idx}`,
        type: "credit",
        title: amt ? `💳 Loan: ${amt}` : "💳 Credit & Loan",
        icon: CreditCard,
        summary: res.summary,
        spokenSummary: res.spokenSummary,
        result: res.credit || res.data || res,
      });
    } else if (tc.toolName === "getOndcIntelligence") {
      const cat = args.category || res.category || "";
      awakenedDomains.push({
        id: tc.toolCallId || `ondc_${idx}`,
        type: "ondc",
        title: cat ? `🌐 ONDC: ${cat.slice(0, 14)}` : "🌐 ONDC Commerce",
        icon: Globe,
        summary: res.summary,
        spokenSummary: res.spokenSummary,
        result: res.ondc || res.data || res,
      });
    } else if (tc.toolName === "predictDistrictBusinesses") {
      const dist = args.district || res.district || "";
      awakenedDomains.push({
        id: tc.toolCallId || `district_${idx}`,
        type: "district",
        title: dist ? `🏙️ ${dist.slice(0, 14)}` : "🏙️ District Ventures",
        icon: Building2,
        summary: res.summary,
        spokenSummary: res.spokenSummary,
        result: res.districtData || res.data || res,
      });
    } else if (
      tc.toolName === "runCustomResearchAgent" ||
      tc.toolName?.startsWith("runCustom") ||
      res.isCustomSubAgent ||
      (res.isArtifact && res.tabTitle)
    ) {
      const tabTitle = res.tabTitle || args.tabTitle || res.category || "🔍 Research";
      awakenedDomains.push({
        id: tc.toolCallId || `custom_${idx}`,
        type: "custom",
        title: tabTitle.length > 22 ? tabTitle.slice(0, 20) + "…" : tabTitle,
        icon: resolveDynamicIcon(res.icon || args.icon),
        summary: res.summary,
        spokenSummary: res.spokenSummary,
        result: res.data || res,
      });
    }
  });

  // If no domain agents were awakened, don't render anything
  if (awakenedDomains.length === 0) return null;

  const isMultiDomain = awakenedDomains.length > 1;
  const [activeTabId, setActiveTabId] = useState<string>(awakenedDomains[0].id);

  const currentDomain =
    awakenedDomains.find((d) => d.id === activeTabId) || awakenedDomains[0];

  const contentToDisplay = currentDomain.result?.content || currentDomain.result?.markdown;

  return (
    <div className="w-full my-3 font-sans animate-in fade-in duration-200">
      {/* ── Minimal Sub-Agent Header (Blends natively with chat background) ── */}
      <div className="flex items-center justify-between gap-2 pb-2 text-xs text-muted-foreground border-b border-sage/20 dark:border-zinc-800/80">
        <div className="flex items-center gap-1.5">
          <Compass className="size-4 text-forest dark:text-mint" />
          <span className="font-semibold text-foreground">Sub-Agent Intelligence</span>
          <span>•</span>
          <span className="text-[11.5px]">
            {awakenedDomains.length}{" "}
            {awakenedDomains.length === 1 ? "Specialized Agent" : "Agents Active"}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>SerpApi Grounded</span>
          </div>

          {onOpenArtifact && (
            <button
              type="button"
              onClick={() =>
                onOpenArtifact({
                  artifactType: "swarm_dossier",
                  title: currentDomain.title || "Sub-Agent Intelligence Dossier",
                  summary: currentDomain.summary,
                  data: {
                    toolCalls,
                  },
                })
              }
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest dark:text-mint hover:underline transition-colors cursor-pointer"
              title="Open full interactive artifact dossier in modal"
            >
              <Maximize2 className="size-3" />
              <span>Stage Document</span>
            </button>
          )}

          <Link
            href="/enterprise"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest dark:text-mint hover:underline transition-colors"
            title="Open in Enterprise Hub"
          >
            <span>Enterprise Hub</span>
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* ── Dynamic Tab Bar: Sleek Pills Rendered Only When Count >= 2 ── */}
      {isMultiDomain && (
        <div className="flex items-center gap-1.5 pt-2 pb-1 overflow-x-auto no-scrollbar">
          {awakenedDomains.map((domain) => {
            const Icon = domain.icon;
            const isActive = domain.id === activeTabId;
            return (
              <button
                key={domain.id}
                onClick={() => {
                  setActiveTabId(domain.id);
                  setTimeout(() => {
                    window.dispatchEvent(new Event("resize"));
                  }, 50);
                  setTimeout(() => {
                    window.dispatchEvent(new Event("resize"));
                  }, 200);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all cursor-pointer whitespace-nowrap select-none",
                  isActive
                    ? "bg-forest dark:bg-mint text-white dark:text-zinc-950 font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground bg-sage/15 dark:bg-zinc-800/60 hover:bg-sage/25 dark:hover:bg-zinc-700/60"
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{domain.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Spoken / Executive Summary Pill (For Voice & Screen Clarity) ── */}
      {(currentDomain.summary || currentDomain.spokenSummary) && (
        <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-forest/5 dark:bg-mint/5 border border-forest/15 dark:border-mint/15 text-xs text-foreground/90 flex items-start gap-2">
          <Activity className="size-3.5 text-forest dark:text-mint shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {currentDomain.spokenSummary || currentDomain.summary}
          </p>
        </div>
      )}

      {/* ── Native Content Viewport: Renders Directly in Chat Without Artificial Borders ── */}
      <div className="pt-2 text-foreground">
        {contentToDisplay ? (
          <MarkdownMessage content={contentToDisplay} variant="assistant" />
        ) : (
          <>
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
            {currentDomain.type === "ondc" && (
              <OndcDomainContent data={currentDomain.result} />
            )}
            {currentDomain.type === "district" && (
              <DistrictDomainContent data={currentDomain.result} />
            )}
            {currentDomain.type === "custom" && (
              <div className="p-4 rounded-xl bg-cream/30 dark:bg-zinc-900 border border-sage/20 dark:border-zinc-800 text-xs text-foreground space-y-2">
                <p className="font-semibold text-forest dark:text-mint">{currentDomain.title}</p>
                <p>{currentDomain.summary || "Specialized domain research completed with SerpApi Google search grounding."}</p>
              </div>
            )}
          </>
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
  const commName = data?.commodity || "Commodity";
  const records = Array.isArray(data)
    ? data
    : data?.rates || data?.commodities || data?.records || [];

  const advisory = data?.aiAdvisory;

  return (
    <div className="space-y-3 text-xs">
      {records.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-sage/30 dark:border-border bg-card/40 dark:bg-card/20 shadow-2xs">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-cream/40 dark:bg-muted/40 font-bold text-forest dark:text-mint text-[11px] border-b border-sage/20 dark:border-border">
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
      {compList.slice(0, 4).map((c: any, idx: number) => (
        <div key={idx} className="py-2 space-y-0.5">
          <div className="flex justify-between items-center gap-2">
            <span className="font-bold text-foreground truncate max-w-[200px]">
              {c.name}
            </span>
            <span className="text-[10.5px] font-medium text-emerald-600 dark:text-mint">
              {c.distance}
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
            {c.rating && <span>★ {c.rating} ({c.reviews || 0} reviews)</span>}
            <span>•</span>
            <span className="truncate">{c.landmark || c.address || "Catchment"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CreditDomainContent({ data }: { data: any }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl border border-sage/20 dark:border-zinc-800 bg-cream/40 dark:bg-zinc-900/40">
          <p className="text-[10.5px] text-muted-foreground">Monthly EMI</p>
          <p className="text-base font-bold font-mono text-forest dark:text-mint">
            ₹{data?.monthlyEMI?.toLocaleString("en-IN") || "—"}
          </p>
        </div>
        <div className="p-2.5 rounded-xl border border-sage/20 dark:border-zinc-800 bg-cream/40 dark:bg-zinc-900/40">
          <p className="text-[10.5px] text-muted-foreground">Interest Rate</p>
          <p className="text-base font-bold font-mono text-foreground">
            {data?.interestRate || "9.5%"}
          </p>
        </div>
        <div className="p-2.5 rounded-xl border border-sage/20 dark:border-zinc-800 bg-cream/40 dark:bg-zinc-900/40">
          <p className="text-[10.5px] text-muted-foreground">Total Interest</p>
          <p className="text-base font-bold font-mono text-muted-foreground">
            ₹{data?.totalInterest?.toLocaleString("en-IN") || "—"}
          </p>
        </div>
        <div className="p-2.5 rounded-xl border border-sage/20 dark:border-zinc-800 bg-cream/40 dark:bg-zinc-900/40">
          <p className="text-[10.5px] text-muted-foreground">Total Repayment</p>
          <p className="text-base font-bold font-mono text-foreground">
            ₹{data?.totalPayment?.toLocaleString("en-IN") || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function OndcDomainContent({ data }: { data: any }) {
  const steps = data?.readinessSteps || [];

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-forest/5 dark:bg-mint/5 border border-forest/15 dark:border-mint/15">
        <Globe className="size-4 text-forest dark:text-mint shrink-0" />
        <p className="text-[11.5px] text-foreground/90 font-medium">
          ONDC Seller Network Registry: {data?.category || "Retail Commerce"}
        </p>
      </div>

      {steps.length > 0 && (
        <div className="space-y-1.5">
          <div className="font-semibold text-foreground text-[11.5px]">Onboarding Steps:</div>
          <div className="space-y-1 text-muted-foreground">
            {steps.map((st: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <span className="size-4 rounded-full bg-forest/10 dark:bg-mint/10 text-forest dark:text-mint flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{st}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DistrictDomainContent({ data }: { data: any }) {
  const sectors = data?.topSectors || [];
  const ventures = data?.suggestedVentures || [];

  return (
    <div className="space-y-3 text-xs">
      {data?.overview && (
        <p className="text-foreground/90 leading-relaxed">{data.overview}</p>
      )}

      {sectors.length > 0 && (
        <div>
          <div className="font-semibold text-foreground text-[11.5px] mb-1">Key Economic Drivers:</div>
          <div className="flex flex-wrap gap-1.5">
            {sectors.map((s: string, i: number) => (
              <span key={i} className="px-2 py-0.5 rounded-md bg-sage/15 dark:bg-zinc-800 text-[11px] text-foreground">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {ventures.length > 0 && (
        <div>
          <div className="font-semibold text-foreground text-[11.5px] mb-1">High-Potential Opportunities:</div>
          <div className="space-y-1">
            {ventures.map((v: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-card/40 border border-sage/15">
                <span className="font-bold text-foreground">{v.name || v.title || v}</span>
                {v.growthScore && (
                  <span className="text-emerald-600 dark:text-mint font-semibold font-mono text-[11px]">
                    {v.growthScore} Growth Score
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
