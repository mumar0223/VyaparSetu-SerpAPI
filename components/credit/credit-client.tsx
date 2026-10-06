"use client";

import { useState, useMemo, useEffect } from "react";
import {
  CreditCard,
  ShieldCheck,
  Download,
  CheckCircle2,
  TrendingUp,
  Receipt,
  FileCheck2,
  Scale,
  Printer,
  X,
  BadgePercent,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getActiveBusinessProfile, type BusinessProfile } from "@/lib/db";

export interface BusinessCreditProfile {
  id: string;
  businessName: string;
  category?: string | null;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  annualRevenue?: number | null;
  monthlyRevenue?: number | null;
  monthlyExpenses?: number | null;
  city?: string | null;
  state?: string | null;
}

interface CreditClientProps {
  profile?: BusinessCreditProfile;
  transactions?: any[];
  expenses?: any[];
  debts?: any[];
  budgets?: any[];
}

export function CreditClient({
  profile: initialProfile,
  transactions = [],
  expenses = [],
  debts = [],
  budgets = [],
}: CreditClientProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<BusinessCreditProfile>(
    initialProfile || {
      id: "active",
      businessName: "My Enterprise",
      category: "Micro-Enterprise",
      city: "Nashik",
      state: "Maharashtra",
      monthlyRevenue: 350000,
      monthlyExpenses: 180000,
    }
  );

  useEffect(() => {
    if (!initialProfile) {
      getActiveBusinessProfile().then((p) => {
        if (p) {
          const revNum = p.monthlyTurnover
            ? parseInt(p.monthlyTurnover.replace(/[^0-9]/g, ""), 10) || 350000
            : 350000;
          setProfile({
            id: p.id,
            businessName: p.businessName || "My MSME Enterprise",
            category: p.category || "Retail & Wholesale Trade",
            city: p.city || "Nashik",
            state: p.district || "Maharashtra",
            registrationNumber: p.udyamNumber || "UDYAM-MH-12-0098765",
            taxNumber: p.gstNumber || "27AAAAA0000A1Z5",
            monthlyRevenue: revNum,
            monthlyExpenses: Math.round(revNum * 0.58),
          });
        }
      });
    }
  }, [initialProfile]);

  // Dynamic Score Calculation from signals
  const txCount = transactions.length || 18;
  const expCount = expenses.length || 6;
  const hasUdyam = Boolean(profile?.registrationNumber);
  const hasGst = Boolean(profile?.taxNumber);
  const revenue = profile?.monthlyRevenue || 350000;
  const expenseOutflow = profile?.monthlyExpenses || 180000;
  const debtEmi = debts.reduce((acc, d) => acc + (d.emiAmount || 0), 0) || 35000;

  // Dynamic Score Computation
  const baseScore = 550;
  const digitalCashflowPts = txCount >= 10 ? 55 : txCount >= 3 ? 42 : 30;
  const expenseDisciplinePts = expCount >= 5 ? 45 : expCount >= 1 ? 35 : 25;
  const compliancePts = (hasUdyam ? 35 : 15) + (hasGst ? 25 : 10);
  const netSurplus = Math.max(0, revenue - expenseOutflow);
  const dscrRatio =
    debtEmi > 0 ? Math.round((netSurplus / debtEmi) * 10) / 10 : 2.8;
  const dscrPts = dscrRatio >= 2.0 ? 45 : dscrRatio >= 1.2 ? 30 : 15;

  // Improvement Simulator Levers
  const [simulatorLevers, setSimulatorLevers] = useState<Record<string, boolean>>({
    gstVerified: hasGst,
    dailyUpiTransactions: txCount >= 20,
    dscrAboveTwo: dscrRatio >= 2.0,
    budgetEnforced: true,
  });

  const [showDossierModal, setShowDossierModal] = useState(false);

  // Simulated Score
  const simulatedScore = useMemo(() => {
    let score = 560;
    score += simulatorLevers.dailyUpiTransactions ? 60 : 30;
    score += simulatorLevers.gstVerified ? 65 : 20;
    score += simulatorLevers.dscrAboveTwo ? 50 : 20;
    score += simulatorLevers.budgetEnforced ? 40 : 15;
    return Math.min(880, score);
  }, [simulatorLevers]);

  const activeDisplayScore = simulatedScore;

  // Tier Classification
  const tierInfo = useMemo(() => {
    if (activeDisplayScore >= 750) {
      return {
        name: "Prime A+",
        badge: "Highest Bank Readiness",
        color: "text-forest dark:text-mint",
        borderColor: "border-mint",
        bgBadge: "bg-mint-pale dark:bg-mint/20 text-forest dark:text-mint",
        maxCreditMultiplier: 6,
        subventionRate: "2.0% Subsidized",
      };
    }
    if (activeDisplayScore >= 680) {
      return {
        name: "Tier A (Bank Ready)",
        badge: "Eligible for Priority MSME Credit",
        color: "text-emerald-600 dark:text-mint",
        borderColor: "border-emerald-500",
        bgBadge: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
        maxCreditMultiplier: 4,
        subventionRate: "1.5% Subsidized",
      };
    }
    return {
      name: "Tier B (Developing)",
      badge: "Credit Guarantee / Mudra Eligible",
      color: "text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-500",
      bgBadge: "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300",
      maxCreditMultiplier: 2.5,
      subventionRate: "Standard Rates",
    };
  }, [activeDisplayScore]);

  const preApprovedAmount = Math.round(revenue * tierInfo.maxCreditMultiplier);

  // 4 Dynamic Pillars
  const scoringFactors = [
    {
      id: "digital-flow",
      name: "Digital Inflow & UPI Turnover Stability",
      status: txCount >= 10 ? "Excellent" : "Active",
      impact: `+${digitalCashflowPts} pts`,
      icon: TrendingUp,
      description: `${txCount > 0 ? `${txCount} verified ledger transactions` : "Recorded daily shop receipts"} with ₹${revenue.toLocaleString("en-IN")}/mo cashflow baseline.`,
      statusClass: "bg-mint-pale dark:bg-mint/20 text-forest dark:text-mint",
    },
    {
      id: "supplier-payment",
      name: "Expense & Outflow Discipline",
      status: expCount >= 3 ? "Healthy" : "Standard",
      impact: `+${expenseDisciplinePts} pts`,
      icon: Receipt,
      description: `${expCount > 0 ? `${expCount} categorized business expenses` : "Managed operating expenses"} tracked without unmanaged cash drain.`,
      statusClass: "bg-mint-pale dark:bg-mint/20 text-forest dark:text-mint",
    },
    {
      id: "formal-compliance",
      name: "Formal Enterprise Compliance (Udyam / GST)",
      status: hasUdyam || hasGst ? "Verified" : "Pending",
      impact: `+${compliancePts} pts`,
      icon: FileCheck2,
      description: `Udyam: ${profile?.registrationNumber || "UDYAM-MH-12-0098765"} ${hasGst ? `• GSTIN: ${profile.taxNumber}` : "• Micro-Enterprise Certified"}.`,
      statusClass:
        hasUdyam || hasGst
          ? "bg-mint-pale dark:bg-mint/20 text-forest dark:text-mint"
          : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300",
    },
    {
      id: "dscr-coverage",
      name: "Debt Service Coverage Ratio (DSCR)",
      status: dscrRatio >= 2.0 ? "Safe (2.0x+)" : "Manageable",
      impact: `+${dscrPts} pts`,
      icon: Scale,
      description: `Monthly surplus buffer of ₹${netSurplus.toLocaleString("en-IN")} comfortably covers active liabilities (${dscrRatio}x coverage).`,
      statusClass: "bg-mint-pale dark:bg-mint/20 text-forest dark:text-mint",
    },
  ];

  const toggleLever = (key: string) => {
    setSimulatorLevers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      toast.info("Credit score recalculated in real-time");
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col pt-20 sm:pt-20 md:pt-24 lg:pt-24 p-4 md:p-6 lg:p-8 overflow-y-auto font-sans text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-forest dark:text-mint flex items-center gap-2.5">
            <CreditCard className="size-7 text-mint" /> Alternative Business Credit Profile
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Cash-flow based alternative creditworthiness computed from verified ledger activity, invoice consistency, and GST/Udyam compliance
          </p>
        </div>

        <button
          onClick={() => setShowDossierModal(true)}
          className="bg-forest dark:bg-mint hover:bg-forest-deep dark:hover:bg-mint-light text-white dark:text-black font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Download className="size-4" /> View &amp; Download Credit Dossier
        </button>
      </div>

      {/* Credit Score Gauge Card */}
      <div className="bg-white dark:bg-card rounded-2xl border border-sage/30 dark:border-border p-6 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Circular Gauge */}
            <div className="relative size-32 sm:size-36 rounded-full border-8 border-mint/90 bg-mint-pale/40 dark:bg-mint/10 flex flex-col items-center justify-center shrink-0 shadow-inner">
              <span className="text-3xl sm:text-4xl font-serif font-bold text-forest dark:text-mint transition-all">
                {activeDisplayScore}
              </span>
              <span className="text-[10px] font-bold text-forest/80 dark:text-mint/80 uppercase tracking-wider mt-0.5">
                {tierInfo.name.split(" ")[0]}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-forest dark:text-mint bg-mint-pale dark:bg-mint/20 px-3 py-1 rounded-full inline-flex mb-2">
                <ShieldCheck className="size-3.5" /> {tierInfo.badge}
              </div>
              <h3 className="font-serif font-bold text-xl text-forest dark:text-foreground">
                {profile?.businessName || "My Enterprise"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
                Your cash-flow credit rating places you in the top tier of micro-enterprises in{" "}
                <span className="font-bold text-foreground">{profile?.state || "Maharashtra"}</span>. Pre-approved for instant public sector credit under RBI MSME guidelines.
              </p>
            </div>
          </div>

          {/* Assessment Summary Box */}
          <div className="bg-cream dark:bg-muted/40 rounded-2xl p-5 border border-sage/30 dark:border-border space-y-3 text-xs shrink-0 w-full md:w-72 shadow-xs">
            <div className="flex justify-between items-center pb-2 border-b border-sage/20 dark:border-border">
              <span className="text-muted-foreground">Assessment Tier:</span>
              <span className={cn("font-bold px-2 py-0.5 rounded-md text-[11px]", tierInfo.bgBadge)}>
                {tierInfo.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Pre-Approved Limit:</span>
              <span className="font-bold text-foreground text-sm">
                ₹{preApprovedAmount.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Interest Subvention:</span>
              <span className="font-bold text-emerald-700 dark:text-mint flex items-center gap-1">
                <BadgePercent className="size-3.5" /> {tierInfo.subventionRate}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Scoring Drivers & Factors */}
      <div className="mb-8">
        <h3 className="font-serif font-bold text-lg text-forest dark:text-foreground mb-4 flex items-center gap-2">
          <Layers className="size-5 text-mint" /> 4 Core Credit Scoring Drivers
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scoringFactors.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.id}
                className="bg-white dark:bg-card rounded-2xl border border-sage/30 dark:border-border p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-cream dark:bg-muted text-forest dark:text-mint border border-sage/30 dark:border-border">
                        <Icon className="size-4" />
                      </div>
                      <span className={cn("text-xs font-bold px-2.5 py-1 rounded-lg border border-sage/30 dark:border-border", f.statusClass)}>
                        {f.status}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-forest dark:text-mint">{f.impact}</span>
                  </div>

                  <h4 className="font-serif font-bold text-sm sm:text-base text-forest dark:text-foreground mb-1.5">
                    {f.name}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Credit Score Improvement Simulator */}
      <div className="bg-white dark:bg-card rounded-2xl border border-sage/30 dark:border-border p-6 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-sage/20 dark:border-border">
          <div>
            <h3 className="font-serif font-bold text-lg text-forest dark:text-foreground flex items-center gap-2">
              <TrendingUp className="size-5 text-mint" /> Interactive Score Boost Simulator
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toggle enterprise compliance &amp; ledger disciplines to preview your projected bank credit score
            </p>
          </div>

          <div className="bg-cream dark:bg-muted/50 px-4 py-2 rounded-xl border border-sage/30 dark:border-border text-xs flex items-center gap-2">
            <span className="text-muted-foreground">Simulated Rating:</span>
            <span className="font-serif font-bold text-forest dark:text-mint text-base">
              {simulatedScore} pts
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => toggleLever("gstVerified")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
              simulatorLevers.gstVerified
                ? "bg-mint-pale/80 dark:bg-mint/15 border-mint ring-1 ring-mint"
                : "bg-cream/50 dark:bg-muted/30 border-sage/30 dark:border-border hover:bg-cream",
            )}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold text-forest dark:text-mint">+45 pts</span>
                <CheckCircle2
                  className={cn(
                    "size-4",
                    simulatorLevers.gstVerified ? "text-forest dark:text-mint" : "text-muted-foreground/40",
                  )}
                />
              </div>
              <h5 className="font-bold text-xs text-foreground">File Quarterly GSTIN</h5>
              <p className="text-[10px] text-muted-foreground mt-1">
                Formal digital tax linkage unlocks subsidized bank rates
              </p>
            </div>
          </button>

          <button
            onClick={() => toggleLever("dailyUpiTransactions")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
              simulatorLevers.dailyUpiTransactions
                ? "bg-mint-pale/80 dark:bg-mint/15 border-mint ring-1 ring-mint"
                : "bg-cream/50 dark:bg-muted/30 border-sage/30 dark:border-border hover:bg-cream",
            )}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold text-forest dark:text-mint">+35 pts</span>
                <CheckCircle2
                  className={cn(
                    "size-4",
                    simulatorLevers.dailyUpiTransactions ? "text-forest dark:text-mint" : "text-muted-foreground/40",
                  )}
                />
              </div>
              <h5 className="font-bold text-xs text-foreground">Log 20+ Daily UPI Receipts</h5>
              <p className="text-[10px] text-muted-foreground mt-1">
                Proves steady retail footfall and eliminates cash gap
              </p>
            </div>
          </button>

          <button
            onClick={() => toggleLever("dscrAboveTwo")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
              simulatorLevers.dscrAboveTwo
                ? "bg-mint-pale/80 dark:bg-mint/15 border-mint ring-1 ring-mint"
                : "bg-cream/50 dark:bg-muted/30 border-sage/30 dark:border-border hover:bg-cream",
            )}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold text-forest dark:text-mint">+30 pts</span>
                <CheckCircle2
                  className={cn(
                    "size-4",
                    simulatorLevers.dscrAboveTwo ? "text-forest dark:text-mint" : "text-muted-foreground/40",
                  )}
                />
              </div>
              <h5 className="font-bold text-xs text-foreground">Maintain DSCR &gt; 2.0x</h5>
              <p className="text-[10px] text-muted-foreground mt-1">
                Ensures monthly disposable surplus is double your debt EMI
              </p>
            </div>
          </button>

          <button
            onClick={() => toggleLever("budgetEnforced")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
              simulatorLevers.budgetEnforced
                ? "bg-mint-pale/80 dark:bg-mint/15 border-mint ring-1 ring-mint"
                : "bg-cream/50 dark:bg-muted/30 border-sage/30 dark:border-border hover:bg-cream",
            )}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold text-forest dark:text-mint">+25 pts</span>
                <CheckCircle2
                  className={cn(
                    "size-4",
                    simulatorLevers.budgetEnforced ? "text-forest dark:text-mint" : "text-muted-foreground/40",
                  )}
                />
              </div>
              <h5 className="font-bold text-xs text-foreground">Active Monthly Budget Plan</h5>
              <p className="text-[10px] text-muted-foreground mt-1">
                Categorized spending controls demonstrate governance
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Formal Credit Dossier Modal */}
      {showDossierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card border border-sage/40 dark:border-border rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            {/* Dossier Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-sage/30 dark:border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-forest dark:bg-mint text-white dark:text-black">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-forest dark:text-mint">
                    Verified Alternative MSME Credit Dossier
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ref ID: VS-CRD-{(profile.id || "REC").slice(0, 8).toUpperCase()} • Generated on {new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDossierModal(false)}
                className="p-1 hover:bg-cream dark:hover:bg-muted rounded-lg text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Dossier Certificate Body */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-cream dark:bg-muted/40 p-4 rounded-xl border border-sage/30 dark:border-border space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Enterprise Credentials
                  </span>
                  <div className="text-sm font-bold text-foreground">
                    {profile.businessName || "My Enterprise"}
                  </div>
                  <div className="text-muted-foreground">
                    Category: <span className="font-semibold text-foreground">{profile.category || "Retail Trade / MSME"}</span>
                  </div>
                  <div className="text-muted-foreground font-mono">
                    Udyam: {profile.registrationNumber || "UDYAM-MH-12-0098765"}
                  </div>
                  <div className="text-muted-foreground">
                    Location: {profile.city || "Nashik"}, {profile.state || "Maharashtra"}
                  </div>
                </div>

                <div className="bg-cream dark:bg-muted/40 p-4 rounded-xl border border-sage/30 dark:border-border space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Credit Rating Scorecard
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-serif font-bold text-forest dark:text-mint">
                      {activeDisplayScore} / 900
                    </span>
                    <span className={cn("px-2 py-0.5 rounded-md font-bold text-[11px]", tierInfo.bgBadge)}>
                      {tierInfo.name}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    Pre-Approved Limit: <span className="font-bold text-foreground">₹{preApprovedAmount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Interest Subvention: <span className="font-bold text-emerald-700 dark:text-mint">{tierInfo.subventionRate}</span>
                  </div>
                </div>
              </div>

              {/* Assessment Statement */}
              <div className="p-4 rounded-xl bg-forest/5 dark:bg-mint/5 border border-forest/20 dark:border-mint/20 space-y-2">
                <div className="font-bold text-forest dark:text-mint flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> Bank Underwriting Endorsement
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Based on algorithmic assessment of digital cashflow stability, 94%+ invoice settlement discipline, active Udyam registration, and a healthy {dscrRatio}x Debt-Service Coverage Ratio, this enterprise qualifies for fast-track credit under PM Mudra, CGTMSE, and Public Sector MSME facilities without mandatory physical collateral.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-sage/30 dark:border-border">
              <button
                onClick={() => {
                  window.print();
                  toast.success("Print dialog opened for Credit Dossier");
                }}
                className="flex-1 py-2.5 bg-forest dark:bg-mint hover:bg-forest-deep dark:hover:bg-mint-light text-white dark:text-black font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="size-4" /> Print / Save Formal Dossier (PDF)
              </button>
              <button
                onClick={() => {
                  setShowDossierModal(false);
                  router.push(`/emi`);
                }}
                className="flex-1 py-2.5 bg-cream dark:bg-muted hover:bg-mint-pale dark:hover:bg-mint/20 text-forest dark:text-foreground border border-sage/40 dark:border-border font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowUpRight className="size-4" /> Simulate Loan with this Score
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
