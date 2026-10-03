"use client";

import React, { useState, useMemo } from "react";
import {
  IndianRupee,
  Calendar,
  Percent,
  TrendingDown,
  Building2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
} from "lucide-react";
import { formatCurrencyINR } from "@/lib/utils";
import { calculateEMI, EMICalculatorPayload } from "@/lib/agent/subagents/credit-emi-subagent";

interface EMICalculatorCanvasProps {
  initialData: EMICalculatorPayload;
}

export function EMICalculatorCanvas({ initialData }: EMICalculatorCanvasProps) {
  const [principal, setPrincipal] = useState<number>(initialData.principal || 500000);
  const [tenureYears, setTenureYears] = useState<number>(
    Math.round((initialData.tenureMonths || 36) / 12) || 3
  );
  const [interestRate, setInterestRate] = useState<number>(
    initialData.annualInterestRate || 10.5
  );

  const months = tenureYears * 12;

  // Real-time calculation as user drags sliders
  const { monthlyEMI, totalInterest, totalPayment, amortizationPreview } = useMemo(() => {
    return calculateEMI(principal, interestRate, months);
  }, [principal, interestRate, months]);

  const principalPercent = Math.round((principal / totalPayment) * 100);
  const interestPercent = 100 - principalPercent;

  return (
    <div className="space-y-6 text-foreground">
      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Monthly EMI
          </p>
          <div className="text-2xl font-bold text-primary flex items-center">
            {formatCurrencyINR(monthlyEMI)}
            <span className="text-xs text-muted-foreground font-normal ml-1">/mo</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            For {months} months ({tenureYears} yrs)
          </p>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total Interest
          </p>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatCurrencyINR(totalInterest)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {interestPercent}% of total outflow
          </p>
        </div>

        <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total Outflow
          </p>
          <div className="text-2xl font-bold">
            {formatCurrencyINR(totalPayment)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Principal + All Interest
          </p>
        </div>
      </div>

      {/* Interactive Controls / Sliders */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-5">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span>Interactive Scenario Simulator</span>
          <span className="text-xs font-normal text-muted-foreground">(Drag sliders to adjust in real-time)</span>
        </h4>

        {/* 1. Principal Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-primary" /> Loan Principal
            </span>
            <span className="font-semibold text-primary text-base">
              {formatCurrencyINR(principal)}
            </span>
          </div>
          <input
            type="range"
            min={50000}
            max={5000000}
            step={25000}
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>₹50,000</span>
            <span>₹25 Lakh</span>
            <span>₹50 Lakh</span>
          </div>
        </div>

        {/* 2. Tenure Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-500" /> Tenure Duration
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-base">
              {tenureYears} Years ({months} Months)
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={7}
            step={1}
            value={tenureYears}
            onChange={(e) => setTenureYears(Number(e.target.value))}
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>1 Year</span>
            <span>3 Years</span>
            <span>5 Years</span>
            <span>7 Years</span>
          </div>
        </div>

        {/* 3. Interest Rate Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-amber-500" /> Annual Interest Rate
            </span>
            <span className="font-semibold text-amber-600 dark:text-amber-400 text-base">
              {interestRate}% p.a.
            </span>
          </div>
          <input
            type="range"
            min={8}
            max={18}
            step={0.25}
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>8% (Govt / Mudra)</span>
            <span>12% (Standard Bank)</span>
            <span>18% (NBFC)</span>
          </div>
        </div>
      </div>

      {/* Live Bank Rate Benchmark Comparison (SerpApi Grounded) */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <span>Live Bank MSME & Mudra Lending Rates (Grounded via SerpApi)</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(initialData.bankComparisons || []).map((bank, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl border border-border/70 bg-card/60 hover:bg-card transition-colors space-y-1.5"
            >
              <div className="flex justify-between items-start">
                <span className="font-semibold text-xs text-foreground">{bank.bankName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {bank.interestRateMin}% - {bank.interestRateMax}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{bank.loanType}</p>
              <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Processing fee: {bank.processingFee || "Standard"}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Amortization Schedule Preview */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">First 6 Months Payment Schedule</h4>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs text-left">
            <thead className="bg-secondary/40 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="py-2.5 px-3">Month</th>
                <th className="py-2.5 px-3">Principal Paid</th>
                <th className="py-2.5 px-3">Interest Paid</th>
                <th className="py-2.5 px-3">Remaining Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {amortizationPreview.slice(0, 6).map((row) => (
                <tr key={row.month} className="hover:bg-secondary/20">
                  <td className="py-2 px-3 font-medium">Month {row.month}</td>
                  <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-medium">
                    {formatCurrencyINR(row.principalPaid)}
                  </td>
                  <td className="py-2 px-3 text-amber-600 dark:text-amber-400">
                    {formatCurrencyINR(row.interestPaid)}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {formatCurrencyINR(row.remainingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
