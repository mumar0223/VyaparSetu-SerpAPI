"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  Landmark,
  FileSpreadsheet,
  Coins,
  Store,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  MapPin,
  Bot,
  ArrowRight,
  BarChart3,
  Layers,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Target,
  RefreshCw,
  CreditCard,
  Calculator,
  Search,
  ArrowLeft,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Code2,
} from "lucide-react";
import { SerpApiPayloadModal, type SerpApiPayloadData } from "@/components/ui/serpapi-payload-modal";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  getEnterpriseIntelligence,
  getActiveBusinessProfile,
  getEnterpriseRecords,
  getEnterpriseRecord,
  type BusinessProfile,
  type EnterpriseIntelligence,
  type EnterpriseRecord,
} from "@/lib/db";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MarkdownMessage } from "@/components/chat/markdown-message";

interface EnterpriseHubViewProps {
  businessProfile?: BusinessProfile | null;
  onAskAi?: (prompt: string) => void;
  onOpenPersonaDialog?: () => void;
}

export type EnterpriseTab =
  | "overview"
  | "swot"
  | "schemes"
  | "mandi"
  | "competitors"
  | "credit"
  | "custom";

export const VALID_ENTERPRISE_TABS: EnterpriseTab[] = [
  "overview",
  "swot",
  "schemes",
  "mandi",
  "competitors",
  "credit",
  "custom",
];

export function getOrSynthesizeMarkdown(record: EnterpriseRecord): string {
  if (record.markdown && typeof record.markdown === "string" && record.markdown.trim().length > 0) {
    return record.markdown;
  }
  if (record.data?.content && typeof record.data.content === "string") {
    return record.data.content;
  }
  if (record.data?.markdown && typeof record.data.markdown === "string") {
    return record.data.markdown;
  }
  if (record.data?.dossier && typeof record.data.dossier === "string") {
    return record.data.dossier;
  }

  const { domain, data, title, summary } = record;

  if (domain === "competitors") {
    const list: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.competitors)
        ? data.competitors
        : [];
    if (list.length > 0) {
      const avgRating = (
        list.reduce((acc, c) => acc + (Number(c.rating) || 4.0), 0) / list.length
      ).toFixed(1);
      const highThreats = list.filter((c) => c.threatLevel === "High").length;
      return `### 🏪 ${title || "Google Maps Competitor Density Radar"}

${summary || "Local competitor ratings, prices, and positioning scanned across the catchment area."}

\`\`\`cards
${JSON.stringify(
  {
    title: "Catchment Radar Snapshot",
    cards: [
      { label: "Competitors Mapped", value: `${list.length} Outlets`, status: "neutral", subtext: "Within local catchment" },
      { label: "Avg Customer Rating", value: `${avgRating}★`, status: Number(avgRating) >= 4.2 ? "warning" : "positive", subtext: "Catchment satisfaction" },
      { label: "High-Threat Rivals", value: `${highThreats}`, status: highThreats > 0 ? "negative" : "positive", subtext: "4.3+★ rated rivals" },
    ],
  },
  null,
  2,
)}
\`\`\`

| Business Name | Distance | Rating | Price Tier | Market Threat | Key Differentiator |
| :--- | :--- | :--- | :--- | :--- | :--- |
${list.map((c) => `| **${c.name}** | ${c.distance || "Local"} | ★ ${c.rating || "4.0"} | ${c.priceRange || "$$"} | ${c.threatLevel === "High" ? "🔴 High" : c.threatLevel === "Medium" ? "🟡 Medium" : "🟢 Low"} | ${c.differentiator || "Retail competitor"} |`).join("\n")}

> **Strategic Positioning:**
> Leverage personalized customer service, faster order fulfillment, and targeted local promotions to outpace nearby rivals.`;
    }
  }

  if (domain === "swot") {
    const swot = data?.swot || data || {};
    const strengths: string[] = swot.strengths || [];
    const weaknesses: string[] = swot.weaknesses || [];
    const opportunities: string[] = swot.opportunities || [];
    const threats: string[] = swot.threats || [];
    const actionPlan: string[] = swot.actionPlan || [];
    return `### 🎯 ${title || "SWOT Strategic Radar"}

${summary || "Live strategic SWOT assessment assembled from market signals and competitive density."}

\`\`\`cards
${JSON.stringify(
  {
    title: "Strategic Overview",
    cards: [
      { label: "Identified Strengths", value: `${strengths.length}`, status: "positive", subtext: "Internal moats" },
      { label: "Growth Opportunities", value: `${opportunities.length}`, status: "positive", subtext: "Market upsides" },
      { label: "Monitored Threats", value: `${threats.length}`, status: threats.length > 2 ? "negative" : "neutral", subtext: "Risk vectors" },
    ],
  },
  null,
  2,
)}
\`\`\`

| Quadrant | Key Strategic Factors |
| :--- | :--- |
| **Strengths (ताकत)** | ${strengths.map((s) => `• ${s}`).join("<br/>") || "Market presence"} |
| **Weaknesses (कमजोरी)** | ${weaknesses.map((w) => `• ${w}`).join("<br/>") || "Capital constraints"} |
| **Opportunities (अवसर)** | ${opportunities.map((o) => `• ${o}`).join("<br/>") || "Digital adoption"} |
| **Threats (चुनौतियां)** | ${threats.map((t) => `• ${t}`).join("<br/>") || "Price competition"} |

${actionPlan.length > 0 ? `
> **Tactical Action Plan:**
${actionPlan.map((a) => `> • ${a}`).join("\n")}
` : ""}`;
  }

  if (domain === "schemes") {
    const list: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.schemes)
        ? data.schemes
        : [];
    if (list.length > 0) {
      return `### 🏛️ ${title || "Government Schemes & Capital Subsidies"}

${summary || "Central and State MSME subsidy programs matched to your business scale."}

| Scheme Name | Assistance / Subsidy | Interest Rate / Terms | Eligibility & Requirements |
| :--- | :--- | :--- | :--- |
${list.map((s) => `| **${s.title || s.name}** | ${s.amount || s.subsidy || s.maxAssistance || "Grant/Subsidy"} | ${s.interest || s.subsidyPercentage || "Subsidized"} | ${s.eligibility || "MSME registered enterprises"} |`).join("\n")}

> **Application Advisory:**
> File applications on official MSME single-window portals with your Udyam Certificate and project DPR ready.`;
    }
  }

  if (domain === "mandi") {
    const list: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.mandi)
        ? data.mandi
        : Array.isArray(data?.commodities)
          ? data.commodities
          : [];
    if (list.length > 0) {
      return `### 🌾 ${title || "APMC Mandi Spot Rates & Arbitrage"}

${summary || "Wholesale commodity arrivals and spot prices across regional yards."}

| Commodity / Variety | Mandi Yard | Modal Price | Daily Arrivals | 24h Trend |
| :--- | :--- | :--- | :--- | :--- |
${list.map((m) => `| **${m.name || m.commodity}** ${m.variety ? `(${m.variety})` : ""} | ${m.market || "APMC Yard"} | **${m.modalPrice}** ${m.unit ? `/${m.unit}` : ""} | ${m.arrivals || "Active"} | ${m.trend || "Steady"} |`).join("\n")}

> **Procurement & Arbitrage Guidance:**
> Monitor inter-mandi price spreads to optimize truckload procurement and bulk dispatch schedules.`;
    }
  }

  if (domain === "credit") {
    const credit = data?.credit || data || {};
    return `### 💳 ${title || "Credit Readiness & Debt Service Coverage"}

${summary || "Bureau score estimation and borrowing headroom."}

\`\`\`cards
${JSON.stringify(
  {
    title: "Commercial Credit Health",
    cards: [
      { label: "Bureau Score", value: `${credit.estimatedCibilScore || 775} / 900`, status: "positive", subtext: credit.healthGrade || "Prime tier" },
      { label: "DSCR Ratio", value: `${credit.dscr || "2.8x"}`, status: "positive", subtext: "Debt service capacity" },
      { label: "Recommended Headroom", value: `${credit.maxRecommendedLoan || "₹25,00,000"}`, status: "neutral", subtext: "Optimal leverage" },
    ],
  },
  null,
  2,
)}
\`\`\`

${credit.recommendations && credit.recommendations.length > 0 ? `
> **Credit Underwriting Advice:**
${credit.recommendations.map((r: string) => `> • ${r}`).join("\n")}
` : ""}`;
  }

  if (domain === "custom") {
    return `### 🔬 ${title || "Specialized Intelligence Dossier"}

${summary || "Autonomous sub-agent analysis."}

${typeof data === "string" ? data : JSON.stringify(data, null, 2)}`;
  }

  return `### 📄 ${title || "Enterprise Intelligence Dossier"}

${summary || "Grounded business research report."}`;
}

// ── Top Navigation Banner for Single Chat Dossier Detail View ──
function SelectedRecordBanner({
  record,
  onBack,
  onInspectPayload,
}: {
  record: EnterpriseRecord;
  onBack: () => void;
  onInspectPayload?: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/70 dark:bg-card/70 border border-sage/30 dark:border-border shadow-xs">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold text-forest dark:text-mint hover:underline cursor-pointer"
      >
        <ArrowLeft className="size-4" />
        <span>Back to all {record.domain.toUpperCase()} reports</span>
      </button>
      <div className="flex items-center gap-2.5 flex-wrap text-xs">
        {onInspectPayload && (
          <button
            type="button"
            onClick={onInspectPayload}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
            title="Inspect raw SerpApi payload"
          >
            <Code2 className="size-3 text-emerald-600 dark:text-emerald-400" />
            <span>Inspect SerpApi JSON</span>
          </button>
        )}
        <span className="text-muted-foreground hidden sm:inline">Source Conversation:</span>
        <span className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-[200px]">
          {record.chatTitle}
        </span>
        <Link
          href={`/c/${record.conversationId}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-mint/15 hover:bg-mint/25 text-forest dark:text-mint font-bold transition-colors"
        >
          <span>Open Thread</span>
          <ExternalLink className="size-3" />
        </Link>
      </div>
    </div>
  );
}

// ── Paginated Card Grid for Generated Intelligence Reports ──
function EnterpriseRecordCardList({
  records,
  activeTab,
  onSelectRecord,
  currentPage,
  onPageChange,
  emptyTitle,
  emptyDesc,
  emptyIcon: EmptyIcon,
  onRunScan,
}: {
  records: EnterpriseRecord[];
  activeTab: string;
  onSelectRecord: (rec: EnterpriseRecord) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  emptyTitle?: string;
  emptyDesc?: string;
  emptyIcon?: any;
  onRunScan?: () => void;
}) {
  const PAGE_SIZE = 6;
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pageIndex = Math.min(Math.max(1, currentPage), totalPages);
  const displayedRecords = records.slice(
    (pageIndex - 1) * PAGE_SIZE,
    pageIndex * PAGE_SIZE,
  );

  if (records.length === 0) {
    return (
      <div className="p-8 rounded-3xl bg-white/60 dark:bg-card/60 border border-sage/30 dark:border-border text-center space-y-3">
        {EmptyIcon && <EmptyIcon className="size-8 text-mint mx-auto" />}
        <h3 className="font-serif font-bold text-base text-forest dark:text-foreground">
          {emptyTitle || "No Records Found"}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          {emptyDesc || "No intelligence analysis has been run for this domain yet."}
        </p>
        {onRunScan && (
          <button
            type="button"
            onClick={onRunScan}
            className="px-4 py-2 rounded-xl bg-forest dark:bg-mint text-white dark:text-black text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Search className="size-3.5 text-mint dark:text-black" />
            <span>Run Live Scan via SerpApi</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedRecords.map((rec) => (
          <div
            key={rec.id}
            onClick={() => onSelectRecord(rec)}
            className="p-5 rounded-3xl bg-white/70 dark:bg-card/70 border border-sage/30 dark:border-border shadow-xs hover:shadow-md hover:border-mint/50 transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-forest dark:text-mint uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-mint/10 border border-mint/20">
                  {rec.domain.toUpperCase()}
                </span>
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <Calendar className="size-3 text-muted-foreground" />
                  {new Date(rec.timestamp).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <h4 className="font-serif font-bold text-sm text-forest dark:text-foreground group-hover:text-mint transition-colors line-clamp-1">
                {rec.chatTitle}
              </h4>

              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {rec.summary || "Generated intelligence dossier"}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-sage/15 dark:border-border text-xs">
              <span className="text-[11px] text-muted-foreground font-mono">
                {Array.isArray(rec.data)
                  ? `${rec.data.length} records analyzed`
                  : rec.domain === "swot"
                    ? "4-Quadrant SWOT"
                    : rec.domain === "credit"
                      ? "Score & Borrowing Capacity"
                      : "Grounded Insights"}
              </span>
              <span className="text-forest dark:text-mint font-bold inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                View Analysis <ArrowRight className="size-3" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4 select-none">
          <button
            type="button"
            disabled={pageIndex <= 1}
            onClick={() => onPageChange(pageIndex - 1)}
            className="px-3 py-1.5 rounded-xl border border-sage/30 dark:border-border bg-white dark:bg-card text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cream dark:hover:bg-muted transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="size-3.5" />
            <span>Previous</span>
          </button>
          <span className="text-xs font-medium text-muted-foreground font-mono">
            Page {pageIndex} of {totalPages}
          </span>
          <button
            type="button"
            disabled={pageIndex >= totalPages}
            onClick={() => onPageChange(pageIndex + 1)}
            className="px-3 py-1.5 rounded-xl border border-sage/30 dark:border-border bg-white dark:bg-card text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cream dark:hover:bg-muted transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function EnterpriseHubView({
  businessProfile: initialProfile,
  onAskAi,
  onOpenPersonaDialog,
}: EnterpriseHubViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as EnterpriseTab | null;
  const idParam = searchParams.get("id");

  const [profile, setProfile] = useState<BusinessProfile | null>(initialProfile || null);
  const [intelligence, setIntelligence] = useState<EnterpriseIntelligence | null>(null);
  const [activeTab, setActiveTab] = useState<EnterpriseTab>(
    tabParam && VALID_ENTERPRISE_TABS.includes(tabParam)
      ? tabParam
      : "overview",
  );
  const [records, setRecords] = useState<EnterpriseRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<EnterpriseRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPayloadModalOpen, setIsPayloadModalOpen] = useState(false);

  // Sync activeTab when tabParam in URL changes
  useEffect(() => {
    if (tabParam && VALID_ENTERPRISE_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
      setCurrentPage(1);
    }
  }, [tabParam]);

  // Fetch business profile and baseline intelligence
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!initialProfile) {
          const p = await getActiveBusinessProfile();
          setProfile(p);
        }
        const data = await getEnterpriseIntelligence();
        setIntelligence(data);
      } catch (err) {
        console.error("[EnterpriseHub] fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

    const handleIntelUpdate = (e: any) => {
      if (e.detail) setIntelligence(e.detail);
      else getEnterpriseIntelligence().then(setIntelligence);
    };

    window.addEventListener("vyaparsetu:intelligence-updated", handleIntelUpdate);
    return () => {
      window.removeEventListener("vyaparsetu:intelligence-updated", handleIntelUpdate);
    };
  }, [initialProfile]);

  // Fetch domain records and resolve selectedRecord by idParam
  useEffect(() => {
    let isMounted = true;
    const fetchDomainRecords = async () => {
      if (activeTab === "overview") {
        if (isMounted) {
          setRecords([]);
          setSelectedRecord(null);
        }
        return;
      }
      const list = await getEnterpriseRecords(activeTab);
      if (!isMounted) return;
      setRecords(list);

      if (idParam) {
        const found = list.find((r) => r.conversationId === idParam);
        if (found) {
          setSelectedRecord(found);
        } else {
          const rec = await getEnterpriseRecord(idParam, activeTab);
          if (isMounted) setSelectedRecord(rec || null);
        }
      } else {
        setSelectedRecord(null);
      }
    };

    fetchDomainRecords();
    return () => {
      isMounted = false;
    };
  }, [activeTab, idParam]);

  // Real-time update and deletion listener for records
  useEffect(() => {
    const handleRecordsUpdate = (e: any) => {
      const deletedId = e.detail?.deletedChatId;
      if (deletedId && idParam === deletedId) {
        const url = new URL(window.location.href);
        url.searchParams.delete("id");
        router.push(url.pathname + "?" + url.searchParams.toString());
      }
      if (activeTab !== "overview") {
        getEnterpriseRecords(activeTab).then(setRecords);
      }
    };

    window.addEventListener("vyaparsetu:records-updated", handleRecordsUpdate);
    return () => {
      window.removeEventListener("vyaparsetu:records-updated", handleRecordsUpdate);
    };
  }, [activeTab, idParam, router]);

  const shopName = profile?.businessName || "My MSME Enterprise";
  const sector = profile?.category || "Retail & Wholesale Trade";
  const location = profile?.district || profile?.city || "India";
  const turnover = profile?.monthlyTurnover || "₹5,00,000";

  const handleAsk = (prompt: string) => {
    if (onAskAi) {
      onAskAi(prompt);
    } else {
      router.push(`/?prompt=${encodeURIComponent(prompt)}`);
    }
  };

  const handleTabClick = (tab: EnterpriseTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSelectedRecord(null);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.delete("id");
    router.push(url.pathname + "?" + url.searchParams.toString());
  };

  const handleSelectRecord = (rec: EnterpriseRecord) => {
    setSelectedRecord(rec);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", rec.domain);
    url.searchParams.set("id", rec.conversationId);
    router.push(url.pathname + "?" + url.searchParams.toString());
  };

  const handleBackToList = () => {
    setSelectedRecord(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    router.push(url.pathname + "?" + url.searchParams.toString());
  };

  // Turn active turnover into numeric values for telemetry
  const turnoverNum = parseInt(turnover.replace(/[^0-9]/g, ""), 10) || 500000;
  const opExpenses = Math.round(turnoverNum * 0.62);

  const cashflowData = [
    { month: "Month 1", inflow: Math.round(turnoverNum * 0.85), outflow: Math.round(opExpenses * 0.88) },
    { month: "Month 2", inflow: Math.round(turnoverNum * 0.90), outflow: Math.round(opExpenses * 0.92) },
    { month: "Month 3", inflow: Math.round(turnoverNum * 0.95), outflow: Math.round(opExpenses * 0.95) },
    { month: "Month 4", inflow: turnoverNum, outflow: opExpenses },
    { month: "Month 5", inflow: Math.round(turnoverNum * 1.08), outflow: Math.round(opExpenses * 1.02) },
    { month: "Month 6", inflow: Math.round(turnoverNum * 1.15), outflow: Math.round(opExpenses * 1.05) },
  ];

  const expenseBreakdown = [
    { name: "Inventory & Goods", value: 55, color: "#1B4332" },
    { name: "Freight & Logistics", value: 18, color: "#4ADE80" },
    { name: "Rent & Utilities", value: 14, color: "#D98E2A" },
    { name: "Staff & Wages", value: 8, color: "#0F2B40" },
    { name: "Taxes & Compliance", value: 5, color: "#A8E3D1" },
  ];

  const awakened = intelligence?.awakenedDomains || [];
  const isDomainActive = (d: string) => awakened.includes(d) || records.some((r) => r.domain === d);

  // Dynamically resolve baseline credit data for fallback KPI metrics
  const creditData = intelligence?.credit || null;

  return (
    <div className="flex-1 w-full h-full overflow-y-auto font-sans p-4 sm:p-6 lg:p-8 pt-20 sm:pt-20 md:pt-24 lg:pt-24">
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        {/* ── Executive Header Banner ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-white/80 via-white/40 to-mint-pale/40 dark:from-card dark:via-card/60 dark:to-muted/30 border border-sage/40 dark:border-border backdrop-blur-xl shadow-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] uppercase font-bold px-2 py-0.5 rounded-full bg-mint/20 text-forest dark:text-mint border border-mint/30">
                Enterprise Command Center
              </span>
              <span className="text-xs text-muted-foreground">• Live Intelligence Swarm</span>
              {awakened.length > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  {awakened.length} Live Domains Grounded
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  Ready to Research
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-forest dark:text-foreground">
              {shopName}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
              <span className="flex items-center gap-1 text-foreground font-medium">
                <Store className="size-3.5 text-mint" />
                {sector}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 text-mint" />
                {location}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-forest dark:text-mint">
                Scale: {turnover}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenPersonaDialog && (
              <button
                onClick={onOpenPersonaDialog}
                className="px-3.5 py-2 rounded-2xl border border-sage/40 dark:border-border bg-white dark:bg-card hover:bg-cream dark:hover:bg-muted text-xs font-semibold text-forest dark:text-foreground transition-all shadow-xs cursor-pointer"
              >
                Configure Profile
              </button>
            )}
            <button
              onClick={() =>
                handleAsk(
                  `Conduct a complete 360-degree autonomous multi-agent enterprise audit for "${shopName}" (${sector}) located at ${location}. Wake up SWOT, Govt Schemes, Mandi Arbitrage, Competitor Radar, and Credit Health agents using real-time SerpApi grounding.`,
                )
              }
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-forest dark:bg-mint text-white dark:text-black text-xs font-bold shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <TrendingUp className="size-3.5 text-mint dark:text-black group-hover:rotate-12 transition-transform" />
              <span>⚡ Run 360° AI Swarm Analysis</span>
            </button>
          </div>
        </div>

        {/* ── Enterprise Tab Navigation Bar ── */}
        <div className="flex items-center gap-1.5 p-1.5 bg-cream/70 dark:bg-card/70 backdrop-blur-md rounded-2xl border border-sage/30 dark:border-border overflow-x-auto select-none">
          <button
            onClick={() => handleTabClick("overview")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
              activeTab === "overview"
                ? "bg-white dark:bg-muted text-forest dark:text-mint shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-muted/40",
            )}
          >
            <BarChart3 className="size-3.5" />
            <span>📊 Overview &amp; Telemetry</span>
          </button>

          <button
            onClick={() => handleTabClick("swot")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer relative",
              activeTab === "swot"
                ? "bg-white dark:bg-muted text-forest dark:text-mint shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-muted/40",
            )}
          >
            <Target className="size-3.5" />
            <span>🎯 SWOT Strategic Radar</span>
            {isDomainActive("swot") && (
              <span className="size-1.5 rounded-full bg-mint animate-pulse" />
            )}
          </button>

          <button
            onClick={() => handleTabClick("schemes")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
              activeTab === "schemes"
                ? "bg-white dark:bg-muted text-forest dark:text-mint shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-muted/40",
            )}
          >
            <Landmark className="size-3.5" />
            <span>🏛️ Govt Schemes &amp; Subsidies</span>
            {isDomainActive("schemes") && (
              <span className="size-1.5 rounded-full bg-mint animate-pulse" />
            )}
          </button>

          <button
            onClick={() => handleTabClick("mandi")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
              activeTab === "mandi"
                ? "bg-white dark:bg-muted text-forest dark:text-mint shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-muted/40",
            )}
          >
            <Coins className="size-3.5" />
            <span>🌾 Mandi &amp; Arbitrage</span>
            {isDomainActive("mandi") && (
              <span className="size-1.5 rounded-full bg-mint animate-pulse" />
            )}
          </button>

          <button
            onClick={() => handleTabClick("competitors")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
              activeTab === "competitors"
                ? "bg-white dark:bg-muted text-forest dark:text-mint shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-muted/40",
            )}
          >
            <Store className="size-3.5" />
            <span>🏪 Competitor Radar</span>
            {isDomainActive("competitors") && (
              <span className="size-1.5 rounded-full bg-mint animate-pulse" />
            )}
          </button>

          <button
            onClick={() => handleTabClick("credit")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
              activeTab === "credit"
                ? "bg-white dark:bg-muted text-forest dark:text-mint shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-muted/40",
            )}
          >
            <CreditCard className="size-3.5" />
            <span>💳 Credit &amp; Borrowing</span>
            {isDomainActive("credit") && (
              <span className="size-1.5 rounded-full bg-mint animate-pulse" />
            )}
          </button>

          <button
            onClick={() => handleTabClick("custom")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
              activeTab === "custom"
                ? "bg-white dark:bg-muted text-forest dark:text-mint shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-muted/40",
            )}
          >
            <Bot className="size-3.5" />
            <span>🔬 Specialized Research</span>
            {isDomainActive("custom") && (
              <span className="size-1.5 rounded-full bg-mint animate-pulse" />
            )}
          </button>
        </div>

        {/* ── TAB 1: EXECUTIVE OVERVIEW & FINANCIAL TELEMETRY ── */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl bg-white/70 dark:bg-card/70 border border-sage/30 dark:border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Monthly Inflow</span>
                  <Coins className="size-4 text-mint" />
                </div>
                <p className="text-2xl font-serif font-bold text-forest dark:text-foreground">
                  {turnover}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <TrendingUp className="size-3" />
                  <span>Verified scale baseline</span>
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white/70 dark:bg-card/70 border border-sage/30 dark:border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Operating Expenses</span>
                  <FileSpreadsheet className="size-4 text-orange" />
                </div>
                <p className="text-2xl font-serif font-bold text-forest dark:text-foreground">
                  ₹{opExpenses.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  62% expense-to-income ratio
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-white/70 dark:bg-card/70 border border-sage/30 dark:border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Working Capital Buffer</span>
                  <Layers className="size-4 text-forest dark:text-mint" />
                </div>
                <p className="text-2xl font-serif font-bold text-forest dark:text-foreground">
                  18 Days
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Safe inventory buffer zone
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-white/70 dark:bg-card/70 border border-sage/30 dark:border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Credit Health Score</span>
                  <ShieldCheck className="size-4 text-mint" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-serif font-bold text-forest dark:text-foreground">
                    {intelligence?.credit?.estimatedCibilScore || 775}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 900</span>
                </div>
                <p className="text-[11px] text-forest dark:text-mint font-semibold">
                  Eligible for Mudra &amp; CGTMSE
                </p>
              </div>
            </div>

            {/* Graphs: Cashflow + Expense Allocation */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-6 rounded-3xl bg-white/70 dark:bg-card/70 border border-sage/30 dark:border-border shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-serif font-bold text-forest dark:text-foreground">
                      Cash Flow Trajectory (Inflow vs Outflow)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Monthly revenue trend for bank loan appraisal
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-forest dark:text-mint">
                      <div className="size-2.5 rounded-full bg-forest dark:bg-mint" /> Inflow
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                      <div className="size-2.5 rounded-full bg-orange" /> Outflow
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashflowData} barGap={6}>
                      <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="#888888"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `₹${val / 1000}k`}
                      />
                      <Tooltip
                        formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, ""]}
                        contentStyle={{
                          borderRadius: "16px",
                          background: "rgba(255,255,255,0.95)",
                          border: "1px solid #A8E3D1",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="inflow" fill="#1B4332" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="outflow" fill="#D98E2A" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white/70 dark:bg-card/70 border border-sage/30 dark:border-border shadow-xs space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-serif font-bold text-forest dark:text-foreground">
                    Expense Breakdown
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Cost optimization opportunities
                  </p>
                </div>

                <div className="h-44 w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        innerRadius={45}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {expenseBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`${val}%`, "Share"]}
                        contentStyle={{ borderRadius: "12px", fontSize: "11.5px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs font-bold text-forest dark:text-foreground">55%</span>
                    <span className="text-[9px] text-muted-foreground">Inventory</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  {expenseBreakdown.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[170px]">
                        <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="font-bold text-foreground">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: SWOT STRATEGIC RADAR ── */}
        {activeTab === "swot" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {selectedRecord ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                <SelectedRecordBanner
                  record={selectedRecord}
                  onBack={handleBackToList}
                  onInspectPayload={() => setIsPayloadModalOpen(true)}
                />
                <div className="p-6 md:p-8 rounded-3xl bg-white/80 dark:bg-card/80 border border-sage/30 dark:border-border shadow-xs backdrop-blur-xs">
                  <MarkdownMessage content={getOrSynthesizeMarkdown(selectedRecord)} />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/60 dark:bg-card/60 border border-sage/30 dark:border-border">
                  <div className="flex items-center gap-2">
                    <Target className="size-5 text-mint" />
                    <div>
                      <h2 className="text-base font-serif font-bold text-forest dark:text-foreground">
                        Live SWOT Strategic Radar
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {records.length > 0
                          ? `${records.length} strategic analysis dossier${records.length > 1 ? "s" : ""} recorded across conversations`
                          : `Researched dynamically via SerpApi for ${sector} in ${location}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAsk(`Run an updated, deep SWOT strategic analysis with actionable growth moves for "${shopName}" (${sector}) in ${location} using SerpApi.`)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-forest dark:bg-mint text-white dark:text-black text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                  >
                    <Bot className="size-3.5" />
                    <span>Run New SWOT Scan</span>
                  </button>
                </div>

                <EnterpriseRecordCardList
                  records={records}
                  activeTab={activeTab}
                  onSelectRecord={handleSelectRecord}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  emptyTitle="No SWOT Analysis Run Yet"
                  emptyDesc="AI Saathi will scan real-time market signals via SerpApi to assemble your custom 4-quadrant Strengths, Weaknesses, Opportunities, and Threats matrix."
                  emptyIcon={Target}
                  onRunScan={() => handleAsk(`Run an updated, deep SWOT strategic analysis with actionable growth moves for "${shopName}" (${sector}) in ${location} using SerpApi.`)}
                />
              </>
            )}
          </div>
        )}

        {/* ── TAB 3: GOVT SCHEMES & SUBSIDIES ── */}
        {activeTab === "schemes" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {selectedRecord ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                <SelectedRecordBanner
                  record={selectedRecord}
                  onBack={handleBackToList}
                  onInspectPayload={() => setIsPayloadModalOpen(true)}
                />
                <div className="p-6 md:p-8 rounded-3xl bg-white/80 dark:bg-card/80 border border-sage/30 dark:border-border shadow-xs backdrop-blur-xs">
                  <MarkdownMessage content={getOrSynthesizeMarkdown(selectedRecord)} />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/60 dark:bg-card/60 border border-sage/30 dark:border-border">
                  <div>
                    <h2 className="text-base font-serif font-bold text-forest dark:text-foreground">
                      Government Schemes &amp; Capital Subsidies
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {records.length > 0
                        ? `${records.length} subsidy dossier${records.length > 1 ? "s" : ""} saved across conversations`
                        : `Researched live via SerpApi for ${sector} in ${location}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAsk(`Find all high-subsidy Central and State MSME schemes for my shop "${shopName}" in ${location} using SerpApi. Include eligibility criteria and step-by-step application process.`)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-forest dark:bg-mint text-white dark:text-black text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                  >
                    <Landmark className="size-3.5" />
                    <span>Scan Govt Schemes</span>
                  </button>
                </div>

                <EnterpriseRecordCardList
                  records={records}
                  activeTab={activeTab}
                  onSelectRecord={handleSelectRecord}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  emptyTitle="No Govt Schemes Researched Yet"
                  emptyDesc="Click below to let AI Saathi research real-time Central and State subsidy programs (PMMY Mudra, PMEGP, Stand-Up India, PM Vishwakarma) matching your business profile."
                  emptyIcon={Landmark}
                  onRunScan={() => handleAsk(`Find all high-subsidy Central and State MSME schemes for my shop "${shopName}" in ${location} using SerpApi. Include eligibility criteria and step-by-step application process.`)}
                />
              </>
            )}
          </div>
        )}

        {/* ── TAB 4: MANDI ARBITRAGE & LOCAL SUPPLY CHAIN ── */}
        {activeTab === "mandi" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {selectedRecord ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                <SelectedRecordBanner
                  record={selectedRecord}
                  onBack={handleBackToList}
                  onInspectPayload={() => setIsPayloadModalOpen(true)}
                />
                <div className="p-6 md:p-8 rounded-3xl bg-white/80 dark:bg-card/80 border border-sage/30 dark:border-border shadow-xs backdrop-blur-xs">
                  <MarkdownMessage content={getOrSynthesizeMarkdown(selectedRecord)} />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/60 dark:bg-card/60 border border-sage/30 dark:border-border">
                  <div>
                    <h2 className="text-base font-serif font-bold text-forest dark:text-foreground">
                      Regional APMC Mandi Spot Rates &amp; Arbitrage
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {records.length > 0
                        ? `${records.length} mandi price dossier${records.length > 1 ? "s" : ""} saved across conversations`
                        : `Live commodity prices and price spread analysis via SerpApi`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAsk(`Fetch live APMC Mandi spot rates and find profit arbitrage opportunities for crops and commodities around ${location} using SerpApi.`)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-forest dark:bg-mint text-white dark:text-black text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                  >
                    <Coins className="size-3.5" />
                    <span>Fetch Live Mandi Data</span>
                  </button>
                </div>

                <EnterpriseRecordCardList
                  records={records}
                  activeTab={activeTab}
                  onSelectRecord={handleSelectRecord}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  emptyTitle="No Mandi Spot Rates Queried Yet"
                  emptyDesc="Click below to scan official APMC wholesale yards and Agmarknet feeds for crop arrivals and modal prices around your location."
                  emptyIcon={Coins}
                  onRunScan={() => handleAsk(`Fetch live APMC Mandi spot rates and find profit arbitrage opportunities for crops and commodities around ${location} using SerpApi.`)}
                />
              </>
            )}
          </div>
        )}

        {/* ── TAB 5: COMPETITOR RADAR & MARKET DENSITY ── */}
        {activeTab === "competitors" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {selectedRecord ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                <SelectedRecordBanner
                  record={selectedRecord}
                  onBack={handleBackToList}
                  onInspectPayload={() => setIsPayloadModalOpen(true)}
                />
                <div className="p-6 md:p-8 rounded-3xl bg-white/80 dark:bg-card/80 border border-sage/30 dark:border-border shadow-xs backdrop-blur-xs">
                  <MarkdownMessage content={getOrSynthesizeMarkdown(selectedRecord)} />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/60 dark:bg-card/60 border border-sage/30 dark:border-border">
                  <div>
                    <h2 className="text-base font-serif font-bold text-forest dark:text-foreground">
                      Google Maps Competitor Radar
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {records.length > 0
                        ? `${records.length} competitor radar scan${records.length > 1 ? "s" : ""} saved across conversations`
                        : `Scanned live via SerpApi Google Maps around ${location}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAsk(`Perform a real-time SerpApi Google Maps competitor scan for ${sector} shops around ${location}. List competitors with ratings, reviews, distance, and unique competitive advantages.`)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-forest dark:bg-mint text-white dark:text-black text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                  >
                    <Store className="size-3.5" />
                    <span>Run Maps Competitor Scan</span>
                  </button>
                </div>

                <EnterpriseRecordCardList
                  records={records}
                  activeTab={activeTab}
                  onSelectRecord={handleSelectRecord}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  emptyTitle="No Competitor Scans Logged Yet"
                  emptyDesc="Click below to scan nearby businesses, customer ratings, price tiers, and competitive moats using SerpApi Google Maps grounding."
                  emptyIcon={Store}
                  onRunScan={() => handleAsk(`Perform a real-time SerpApi Google Maps competitor scan for ${sector} shops around ${location}. List competitors with ratings, reviews, distance, and unique competitive advantages.`)}
                />
              </>
            )}
          </div>
        )}

        {/* ── TAB 6: CREDIT & BORROWING HEADROOM ── */}
        {activeTab === "credit" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {selectedRecord ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                <SelectedRecordBanner
                  record={selectedRecord}
                  onBack={handleBackToList}
                  onInspectPayload={() => setIsPayloadModalOpen(true)}
                />
                <div className="p-6 md:p-8 rounded-3xl bg-white/80 dark:bg-card/80 border border-sage/30 dark:border-border shadow-xs backdrop-blur-xs">
                  <MarkdownMessage content={getOrSynthesizeMarkdown(selectedRecord)} />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/60 dark:bg-card/60 border border-sage/30 dark:border-border">
                  <div>
                    <h2 className="text-base font-serif font-bold text-forest dark:text-foreground">
                      Credit Readiness &amp; Loan Headroom
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {records.length > 0
                        ? `${records.length} credit evaluation dossier${records.length > 1 ? "s" : ""} recorded across conversations`
                        : `Grounds your cash flow scale (${turnover}) and debt coverage`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/credit"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-sage/40 dark:border-border bg-white dark:bg-card hover:bg-cream dark:hover:bg-muted text-forest dark:text-foreground text-xs font-semibold shadow-xs"
                    >
                      <CreditCard className="size-3.5 text-mint" />
                      <span>Full Credit Dossier</span>
                    </Link>
                    <Link
                      href="/emi"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-forest dark:bg-mint text-white dark:text-black text-xs font-bold shadow-xs hover:shadow-md"
                    >
                      <Calculator className="size-3.5 text-mint dark:text-black" />
                      <span>Interactive EMI Simulator</span>
                    </Link>
                  </div>
                </div>

                {records.length > 0 ? (
                  <EnterpriseRecordCardList
                    records={records}
                    activeTab={activeTab}
                    onSelectRecord={handleSelectRecord}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 rounded-3xl bg-white/70 dark:bg-card/70 border border-sage/30 dark:border-border shadow-xs space-y-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                        Bureau Score Estimate
                      </span>
                      <div className="text-3xl font-serif font-bold text-forest dark:text-mint">
                        {creditData?.estimatedCibilScore || 775} / 900
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Prime tier status unlocks 1.5% - 2.0% interest rate rebate on MSME loans.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl bg-white/70 dark:bg-card/70 border border-sage/30 dark:border-border shadow-xs space-y-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                        Debt-Service Coverage Ratio (DSCR)
                      </span>
                      <div className="text-3xl font-serif font-bold text-forest dark:text-mint">
                        {creditData?.dscr || "2.8x"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Net disposable monthly surplus comfortably supports up to ₹45,000 monthly debt EMI.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl bg-white/70 dark:bg-card/70 border border-sage/30 dark:border-border shadow-xs space-y-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                        Recommended Loan Headroom
                      </span>
                      <div className="text-3xl font-serif font-bold text-forest dark:text-mint">
                        {creditData?.maxRecommendedLoan || "₹25,00,000"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Optimal leverage capacity without over-straining shop cash balances.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB 7: SPECIALIZED AUTONOMOUS SUB-AGENTS ── */}
        {activeTab === "custom" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {selectedRecord ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                <SelectedRecordBanner
                  record={selectedRecord}
                  onBack={handleBackToList}
                  onInspectPayload={() => setIsPayloadModalOpen(true)}
                />
                <div className="p-6 md:p-8 rounded-3xl bg-white/80 dark:bg-card/80 border border-sage/30 dark:border-border shadow-xs backdrop-blur-xs">
                  <MarkdownMessage content={getOrSynthesizeMarkdown(selectedRecord)} />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/60 dark:bg-card/60 border border-sage/30 dark:border-border">
                  <div>
                    <h2 className="text-base font-serif font-bold text-forest dark:text-foreground">
                      Specialized Autonomous Sub-Agents
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {records.length > 0
                        ? `${records.length} specialized domain dossier${records.length > 1 ? "s" : ""} saved across conversations`
                        : "Dynamic sub-agents spawned for specialized deep research"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAsk(`Run an autonomous specialized research sub-agent for ${sector} in ${location} with deep market metrics, supply chain economics, and feasibility analysis.`)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-forest dark:bg-mint text-white dark:text-black text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                  >
                    <Bot className="size-3.5" />
                    <span>Spawn Specialized Agent</span>
                  </button>
                </div>

                <EnterpriseRecordCardList
                  records={records}
                  activeTab={activeTab}
                  onSelectRecord={handleSelectRecord}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  emptyTitle="No Specialized Reports Yet"
                  emptyDesc="Specialized sub-agents spawned in chat or voice will archive their complete research dossiers here."
                  emptyIcon={Bot}
                  onRunScan={() => handleAsk(`Run an autonomous specialized research sub-agent for ${sector} in ${location} with deep market metrics, supply chain economics, and feasibility analysis.`)}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* ── SerpApi Payload Inspection Modal ── */}
      <SerpApiPayloadModal
        isOpen={isPayloadModalOpen}
        onClose={() => setIsPayloadModalOpen(false)}
        data={
          selectedRecord
            ? {
                engine:
                  selectedRecord.domain === "competitors"
                    ? "google_maps"
                    : selectedRecord.domain === "swot"
                    ? "google_maps"
                    : "google",
                query:
                  selectedRecord.title ||
                  `${selectedRecord.domain.toUpperCase()} Audit for ${shopName} in ${location}`,
                location: location,
                resultsCount:
                  selectedRecord.data?.competitors?.length ||
                  selectedRecord.data?.schemes?.length ||
                  selectedRecord.data?.rates?.length ||
                  selectedRecord.data?.cards?.length ||
                  4,
                items:
                  selectedRecord.data?.competitors ||
                  selectedRecord.data?.schemes ||
                  selectedRecord.data?.rates ||
                  selectedRecord.data?.cards ||
                  [],
                rawResponse: selectedRecord.data,
                timestamp: selectedRecord.timestamp
                  ? typeof selectedRecord.timestamp === "number"
                    ? new Date(selectedRecord.timestamp).toISOString()
                    : String(selectedRecord.timestamp)
                  : undefined,
              }
            : null
        }
      />
    </div>
  );
}
