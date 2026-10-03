"use client";

import React from "react";
import { TrendingUp, Truck, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import type { MandiArbitragePayload } from "@/lib/agent/subagents/mandi-subagent";
import { formatCurrencyINR } from "@/lib/utils";

interface MandiPriceCanvasProps {
  data: MandiArbitragePayload;
}

export function MandiPriceCanvas({ data }: MandiPriceCanvasProps) {
  return (
    <div className="space-y-6 text-foreground">
      {/* Header Info Banner */}
      <div className="p-4 rounded-xl bg-secondary/30 border border-border flex flex-wrap justify-between items-center gap-3">
        <div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            APMC Yard Grounding
          </span>
          <h3 className="text-base font-bold mt-1">
            {data.commodity} — {data.baseDistrict} Mandi
          </h3>
        </div>
        <p className="text-xs text-muted-foreground max-w-sm">{data.aiAdvisory}</p>
      </div>

      {/* Yard Rates Comparison Table */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">APMC Yard Live Modal Rates (per Quintal)</h4>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs text-left">
            <thead className="bg-secondary/40 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="py-2.5 px-3">Mandi Yard</th>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3">Min Rate</th>
                <th className="py-2.5 px-3">Max Rate</th>
                <th className="py-2.5 px-3">Modal Rate</th>
                <th className="py-2.5 px-3">Arrivals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.rates.map((rate, idx) => (
                <tr key={idx} className="hover:bg-secondary/20">
                  <td className="py-2.5 px-3 font-semibold">{rate.mandiName}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{rate.state}</td>
                  <td className="py-2.5 px-3">{formatCurrencyINR(rate.minPrice)}</td>
                  <td className="py-2.5 px-3">{formatCurrencyINR(rate.maxPrice)}</td>
                  <td className="py-2.5 px-3 font-bold text-primary">
                    {formatCurrencyINR(rate.modalPrice)}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">{rate.arrivalTons || "-"} Tons</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Arbitrage Opportunities Cards */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary" />
          <span>Inter-Mandi Arbitrage & Transport Spreads</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.arbitrageOpportunities.map((arb, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-border/80 bg-card space-y-2 text-xs"
            >
              <div className="flex justify-between items-start">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  {arb.sourceMandi.split(" ")[0]} <ArrowRight className="w-3 h-3 text-muted-foreground" /> {arb.targetMandi.split(" ")[0]}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    arb.viability === "Highly Viable"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : arb.viability === "Marginal"
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {arb.viability}
                </span>
              </div>

              <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50">
                <span>Price Spread:</span>
                <span className="font-medium text-foreground">+{formatCurrencyINR(arb.priceDifferencePerQuintal)}/Q</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Freight Est.:</span>
                <span>-{formatCurrencyINR(arb.estimatedTransportCost)}/Q</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-border/50">
                <span>Net Margin:</span>
                <span>+{formatCurrencyINR(arb.netProfitPerQuintal)}/Quintal</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
