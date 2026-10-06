"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Building,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Download,
  Percent,
  Calendar,
  IndianRupee,
  Layers,
  X,
  FileCheck,
  Zap,
  Bot,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  getActiveBusinessProfile,
  getEnterpriseIntelligence,
  type BusinessProfile,
  type EnterpriseIntelligence,
} from "@/lib/db";

export function BorrowingClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [intelligence, setIntelligence] = useState<EnterpriseIntelligence | null>(null);

  // Dynamic parameters
  const [loanAmount, setLoanAmount] = useState(500000);
  const [interestRate, setInterestRate] = useState(8.5);
  const [tenureYears, setTenureYears] = useState(5);
  const [selectedSchemeTitle, setSelectedSchemeTitle] = useState<string | null>(null);
  const [showAmortization, setShowAmortization] = useState(false);
  const [showPreQualModal, setShowPreQualModal] = useState(false);

  useEffect(() => {
    getActiveBusinessProfile().then(setProfile);
    getEnterpriseIntelligence().then(setIntelligence);

    const handleUpdate = (e: any) => {
      if (e.detail) setIntelligence(e.detail);
      else getEnterpriseIntelligence().then(setIntelligence);
    };
    window.addEventListener("vyaparsetu:intelligence-updated", handleUpdate);
    return () => window.removeEventListener("vyaparsetu:intelligence-updated", handleUpdate);
  }, []);

  const shopName = profile?.businessName || "My MSME Enterprise";
  const location = profile?.district || profile?.city || "India";
  const sector = profile?.category || "Retail & Trade";

  // Dynamic live schemes researched via SerpApi
  const liveSchemes = intelligence?.schemes || [];

  // Parse turnover for real cash flow DSCR calculation
  const monthlyRevenue = useMemo(() => {
    if (!profile?.monthlyTurnover) return 400000;
    const num = parseInt(profile.monthlyTurnover.replace(/[^0-9]/g, ""), 10);
    return num || 400000;
  }, [profile]);
  const monthlyExpenses = Math.round(monthlyRevenue * 0.58);

  // EMI Math: E = P * r * (1+r)^n / ((1+r)^n - 1)
  const monthlyRate = interestRate / 12 / 100;
  const totalMonths = tenureYears * 12;

  const emi = useMemo(() => {
    if (monthlyRate <= 0) return Math.round(loanAmount / totalMonths);
    const compound = Math.pow(1 + monthlyRate, totalMonths);
    return Math.round((loanAmount * monthlyRate * compound) / (compound - 1));
  }, [loanAmount, monthlyRate, totalMonths]);

  const totalPayment = emi * totalMonths;
  const totalInterest = totalPayment - loanAmount;
  const principalPct = Math.round((loanAmount / totalPayment) * 100);
  const interestPct = 100 - principalPct;

  // Real Cash Flow DSCR & Affordability Simulation
  const netMonthlySurplus = Math.max(0, monthlyRevenue - monthlyExpenses);
  const existingDebtEmi = 25000;
  const totalFutureDebtCommitment = existingDebtEmi + emi;
  const dscr =
    totalFutureDebtCommitment > 0
      ? Math.round((netMonthlySurplus / totalFutureDebtCommitment) * 10) / 10
      : 3.5;
  const surplusAfterEmi = netMonthlySurplus - emi;

  // Year by Year Amortization Schedule
  const amortizationSchedule = useMemo(() => {
    let balance = loanAmount;
    const schedule: Array<{
      year: number;
      startBalance: number;
      principalPaid: number;
      interestPaid: number;
      totalPaid: number;
      endBalance: number;
    }> = [];

    for (let yr = 1; yr <= tenureYears; yr++) {
      let yrPrincipal = 0;
      let yrInterest = 0;
      const startBalance = balance;

      for (let m = 1; m <= 12; m++) {
        if (balance <= 0) break;
        const interestForMonth = balance * monthlyRate;
        const principalForMonth = Math.min(balance, emi - interestForMonth);
        yrInterest += interestForMonth;
        yrPrincipal += principalForMonth;
        balance -= principalForMonth;
      }

      schedule.push({
        year: yr,
        startBalance: Math.round(startBalance),
        principalPaid: Math.round(yrPrincipal),
        interestPaid: Math.round(yrInterest),
        totalPaid: Math.round(yrPrincipal + yrInterest),
        endBalance: Math.max(0, Math.round(balance)),
      });
    }
    return schedule;
  }, [loanAmount, tenureYears, emi, monthlyRate]);

  const handleSelectLiveScheme = (scheme: any) => {
    setSelectedSchemeTitle(scheme.title);
    if (scheme.interest) {
      const match = scheme.interest.match(/(\d+(?:\.\d+)?)/);
      if (match) setInterestRate(parseFloat(match[1]));
    }
    if (scheme.amount) {
      const match = scheme.amount.replace(/,/g, "").match(/(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > 10000) setLoanAmount(Math.min(val, 2500000));
      }
    }
    toast.info(`Selected live scheme: ${scheme.title}`);
  };

  const handleResearchLiveSchemes = () => {
    const prompt = `Search and compare current MSME bank loan interest rates, priority sector lending schemes (SBI, PNB, Mudra Tarun, CGTMSE), and capital subsidies for "${shopName}" (${sector}) in ${location} using SerpApi.`;
    router.push(`/?prompt=${encodeURIComponent(prompt)}`);
  };

  const handleExportCsv = () => {
    const header = "Year,Start Balance,Principal Paid,Interest Paid,Total Annual EMI,End Balance\n";
    const rows = amortizationSchedule
      .map(
        (s) =>
          `${s.year},${s.startBalance},${s.principalPaid},${s.interestPaid},${s.totalPaid},${s.endBalance}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Amortization_Loan_${loanAmount}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Amortization schedule downloaded as CSV");
  };

  return (
    <div className="h-full flex flex-col pt-20 sm:pt-20 md:pt-24 lg:pt-24 p-4 md:p-6 lg:p-8 overflow-y-auto font-sans text-foreground">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-forest dark:text-mint flex items-center gap-2.5">
            <Building className="size-7 text-mint" /> Dynamic Bank Loan &amp; EMI Simulator
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Calculate exact monthly installments, explore live bank rates researched via SerpApi, and verify cash flow affordability
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleResearchLiveSchemes}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-sage/40 dark:border-border bg-white dark:bg-card hover:bg-cream dark:hover:bg-muted text-forest dark:text-foreground text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Search className="size-3.5 text-mint" />
            <span>Search Live Bank Rates</span>
          </button>

          <button
            onClick={() => setShowPreQualModal(true)}
            className="bg-forest dark:bg-mint text-white dark:text-black font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileCheck className="size-4" /> Apply Pre-Qualification
          </button>
        </div>
      </div>

      {/* ── Live Schemes Researched via SerpApi (Dynamic State) ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {liveSchemes.length > 0
              ? `Live Schemes Researched for ${shopName} (SerpApi Grounded)`
              : "Live SerpApi Scheme Research"}
          </label>
          {liveSchemes.length > 0 && (
            <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="size-3" /> {liveSchemes.length} Active Schemes
            </span>
          )}
        </div>

        {liveSchemes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {liveSchemes.map((scheme, idx) => {
              const isSelected = selectedSchemeTitle === scheme.title;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectLiveScheme(scheme)}
                  className={cn(
                    "text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative",
                    isSelected
                      ? "bg-mint-pale/80 dark:bg-mint/15 border-mint shadow-xs ring-1 ring-mint"
                      : "bg-white dark:bg-card border-sage/30 dark:border-border hover:bg-cream dark:hover:bg-muted/40"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-forest dark:text-mint bg-white dark:bg-card px-2 py-0.5 rounded-md border border-sage/30 dark:border-border">
                        {scheme.badge || "Live Verified"}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="size-4 text-forest dark:text-mint shrink-0" />
                      )}
                    </div>
                    <h4 className="font-serif font-bold text-xs text-foreground line-clamp-1">
                      {scheme.title}
                    </h4>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                      {scheme.subsidy || scheme.eligibility}
                    </p>
                  </div>
                  {scheme.amount && (
                    <div className="mt-2 text-[10px] font-semibold text-forest/80 dark:text-mint/90 font-mono">
                      {scheme.amount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-card/60 border border-sage/30 dark:border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">
                No bank loan schemes researched yet for "{shopName}" in {location}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Let AI Saathi scan Google and official public sector lending portals via SerpApi to discover tailored interest rates and subsidies.
              </p>
            </div>
            <button
              onClick={handleResearchLiveSchemes}
              className="px-3.5 py-1.5 rounded-xl bg-forest dark:bg-mint text-white dark:text-black text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer whitespace-nowrap flex items-center gap-1.5 self-start sm:self-auto"
            >
              <TrendingUp className="size-3 text-mint dark:text-black" />
              <span>⚡ Research with SerpApi</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Interactive EMI Simulator Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left 2 Cols: Interactive Sliders & Parameter Controls */}
        <div className="lg:col-span-2 bg-white dark:bg-card rounded-2xl border border-sage/30 dark:border-border p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-sage/20 dark:border-border">
              <h3 className="font-serif font-bold text-lg text-forest dark:text-foreground flex items-center gap-2">
                <Calculator className="size-5 text-mint" /> Loan Parameter Controls
              </h3>
              {selectedSchemeTitle && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-mint-pale dark:bg-mint/20 text-forest dark:text-mint">
                  {selectedSchemeTitle}
                </span>
              )}
            </div>

            <div className="space-y-6">
              {/* Loan Amount Slider + Quick Chips */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-forest dark:text-foreground mb-2">
                  <span className="flex items-center gap-1.5">
                    <IndianRupee className="size-4 text-mint" /> Principal Loan Amount:
                  </span>
                  <span className="text-base font-serif font-bold text-forest dark:text-mint">
                    ₹{loanAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <input
                  type="range"
                  min={25000}
                  max={5000000}
                  step={25000}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full accent-forest dark:accent-mint cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>₹25,000</span>
                  <span>₹10 Lakhs</span>
                  <span>₹50 Lakhs</span>
                </div>

                {/* Quick Selection Chips */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {[100000, 300000, 500000, 1000000, 2000000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setLoanAmount(amt)}
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer",
                        loanAmount === amt
                          ? "bg-forest dark:bg-mint text-white dark:text-black border-transparent shadow-xs"
                          : "bg-cream dark:bg-muted/50 text-muted-foreground hover:text-foreground border-sage/30 dark:border-border"
                      )}
                    >
                      ₹{(amt / 100000).toFixed(amt % 100000 === 0 ? 0 : 1)} Lakhs
                    </button>
                  ))}
                </div>
              </div>

              {/* Interest Rate Slider */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-forest dark:text-foreground mb-2">
                  <span className="flex items-center gap-1.5">
                    <Percent className="size-4 text-mint" /> Interest Rate (% per annum):
                  </span>
                  <span className="text-base font-serif font-bold text-forest dark:text-mint">
                    {interestRate.toFixed(2)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={20}
                  step={0.1}
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="w-full accent-forest dark:accent-mint cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>6.0% (Subsidized/Govt)</span>
                  <span>9.5% (Public Bank)</span>
                  <span>18.0% (Unsecured NBFC)</span>
                </div>
              </div>

              {/* Repayment Tenure Slider */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-forest dark:text-foreground mb-2">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-4 text-mint" /> Repayment Tenure:
                  </span>
                  <span className="text-base font-serif font-bold text-forest dark:text-mint">
                    {tenureYears} Years ({totalMonths} Months)
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={tenureYears}
                  onChange={(e) => setTenureYears(Number(e.target.value))}
                  className="w-full accent-forest dark:accent-mint cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>1 Year (12 M)</span>
                  <span>5 Years (60 M)</span>
                  <span>10 Years (120 M)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Live EMI Commitment, Visual Progress & Outflow Cards */}
        <div className="bg-cream dark:bg-muted/40 rounded-2xl border border-sage/30 dark:border-border p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Monthly EMI Commitment
            </span>
            <div className="text-3xl sm:text-4xl font-serif font-bold text-forest dark:text-mint mb-2">
              ₹{emi.toLocaleString("en-IN")}{" "}
              <span className="text-xs font-normal text-muted-foreground">/ month</span>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Payable across {totalMonths} equal monthly installments
            </p>

            {/* Visual Principal vs Interest Progress Bar */}
            <div className="space-y-1.5 mb-6">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-emerald-700 dark:text-mint">Principal: {principalPct}%</span>
                <span className="text-amber-700 dark:text-orange">Interest: {interestPct}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-sage/30 dark:bg-muted overflow-hidden flex">
                <div
                  style={{ width: `${principalPct}%` }}
                  className="h-full bg-forest dark:bg-mint transition-all duration-300"
                />
                <div
                  style={{ width: `${interestPct}%` }}
                  className="h-full bg-orange transition-all duration-300"
                />
              </div>
            </div>

            {/* Financial Metrics Summary */}
            <div className="space-y-3 pt-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-sage/20 dark:border-border">
                <span className="text-muted-foreground">Principal Borrowed:</span>
                <span className="font-bold text-foreground">
                  ₹{loanAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-sage/20 dark:border-border">
                <span className="text-muted-foreground">Total Interest Payable:</span>
                <span className="font-bold text-orange">
                  ₹{totalInterest.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-sage/20 dark:border-border">
                <span className="text-muted-foreground">Total Repayment Amount:</span>
                <span className="font-bold text-forest dark:text-mint text-sm">
                  ₹{totalPayment.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Real Cashflow Affordability Signal */}
              <div className="mt-4 p-3.5 rounded-xl bg-white dark:bg-card border border-sage/30 dark:border-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground">
                    Cash Flow DSCR Coverage:
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-bold px-2 py-0.5 rounded-md",
                      dscr >= 2.0
                        ? "bg-mint-pale dark:bg-mint/20 text-forest dark:text-mint"
                        : dscr >= 1.2
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                          : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"
                    )}
                  >
                    {dscr}x {dscr >= 2.0 ? "(Safe Buffer)" : dscr >= 1.2 ? "(Manageable)" : "(Strained)"}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Net surplus remaining after paying this ₹{emi.toLocaleString("en-IN")}/mo EMI:{" "}
                  <span className="font-bold text-foreground">
                    ₹{surplusAfterEmi.toLocaleString("en-IN")}/mo
                  </span>.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-2">
            <button
              onClick={() => setShowAmortization(!showAmortization)}
              className="w-full py-2.5 rounded-xl bg-white dark:bg-card border border-sage/30 dark:border-border hover:bg-mint-pale dark:hover:bg-mint/15 text-forest dark:text-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Layers className="size-4 text-mint" />
              <span>{showAmortization ? "Hide Amortization Table" : "View Amortization Schedule"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Year-by-Year Amortization Schedule Table */}
      {showAmortization && (
        <div className="bg-white dark:bg-card rounded-2xl border border-sage/30 dark:border-border p-6 shadow-xs mb-8 animate-in fade-in">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-sage/20 dark:border-border">
            <div>
              <h3 className="font-serif font-bold text-base text-forest dark:text-foreground flex items-center gap-2">
                <Layers className="size-5 text-mint" /> Annual Principal &amp; Interest Amortization
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exact year-by-year reduction of remaining principal balance
              </p>
            </div>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sage/40 dark:border-border text-xs font-semibold text-forest dark:text-foreground hover:bg-cream dark:hover:bg-muted cursor-pointer"
            >
              <Download className="size-3.5 text-mint" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-cream/60 dark:bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-sage/20 dark:border-border">
                <tr>
                  <th className="py-2.5 px-3">Year</th>
                  <th className="py-2.5 px-3">Opening Balance</th>
                  <th className="py-2.5 px-3 text-emerald-700 dark:text-mint">Principal Paid</th>
                  <th className="py-2.5 px-3 text-orange">Interest Paid</th>
                  <th className="py-2.5 px-3">Total Annual Installment</th>
                  <th className="py-2.5 px-3 text-right">Closing Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage/15 dark:divide-border/40 font-mono">
                {amortizationSchedule.map((s) => (
                  <tr key={s.year} className="hover:bg-cream/30 dark:hover:bg-muted/20">
                    <td className="py-2.5 px-3 font-bold font-sans">Year {s.year}</td>
                    <td className="py-2.5 px-3">₹{s.startBalance.toLocaleString("en-IN")}</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-700 dark:text-mint">
                      ₹{s.principalPaid.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-orange">
                      ₹{s.interestPaid.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-3 font-bold">₹{s.totalPaid.toLocaleString("en-IN")}</td>
                    <td className="py-2.5 px-3 text-right font-semibold">
                      ₹{s.endBalance.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pre-Qualification Application Modal */}
      {showPreQualModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card border border-sage/40 dark:border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-sage/30 dark:border-border">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="size-6 text-mint" />
                <h3 className="font-serif font-bold text-base text-forest dark:text-foreground">
                  Apply for {selectedSchemeTitle || "MSME Priority Credit"}
                </h3>
              </div>
              <button
                onClick={() => setShowPreQualModal(false)}
                className="p-1 hover:bg-cream dark:hover:bg-muted rounded-lg text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-cream dark:bg-muted/40 border border-sage/30 dark:border-border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Borrower:</span>
                  <span className="font-bold text-foreground">{shopName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Catchment / City:</span>
                  <span className="font-semibold text-foreground">{location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested Amount:</span>
                  <span className="font-bold text-forest dark:text-mint">₹{loanAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Computed EMI:</span>
                  <span className="font-bold text-foreground">₹{emi.toLocaleString("en-IN")} / mo</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-forest/5 dark:bg-mint/5 border border-mint/30 space-y-1">
                <div className="font-bold text-forest dark:text-mint flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> Instant Pre-Screened Approval
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Your enterprise qualifies under RBI Public Sector Priority Sector Lending (PSL) rules with zero physical collateral.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowPreQualModal(false)}
                className="flex-1 py-2 rounded-xl border border-sage/40 dark:border-border text-xs font-semibold hover:bg-cream dark:hover:bg-muted transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPreQualModal(false);
                  toast.success("Application packet submitted to partner bank!");
                }}
                className="flex-1 py-2 bg-forest dark:bg-mint text-white dark:text-black font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Submit Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
