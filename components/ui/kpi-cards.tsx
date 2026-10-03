"use client";

import React from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiCardItem {
  label: string;
  value: string | number;
  change?: string;
  status?: "positive" | "negative" | "warning" | "neutral";
  subtext?: string;
  icon?: string;
}

export interface KpiCardsSpec {
  title?: string;
  cards: KpiCardItem[];
  summary?: string;
}

export function parseFlexibleCardsJson(raw: string): KpiCardsSpec | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  try {
    const res = JSON.parse(trimmed);
    if (Array.isArray(res)) return { cards: res };
    return res;
  } catch (_) {}

  let cleaned = trimmed
    .replace(/^```(?:cards|kpi|metrics|json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  try {
    const res = JSON.parse(cleaned);
    if (Array.isArray(res)) return { cards: res };
    return res;
  } catch (_) {}

  try {
    const quoteKeys = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
    const res = JSON.parse(quoteKeys);
    if (Array.isArray(res)) return { cards: res };
    return res;
  } catch (_) {}

  return null;
}

export function KpiCards({
  spec,
  rawJson,
  className,
}: {
  spec?: KpiCardsSpec;
  rawJson?: string;
  className?: string;
}) {
  const parsed = React.useMemo(() => {
    if (spec && typeof spec === "object") return spec;
    if (rawJson) return parseFlexibleCardsJson(rawJson);
    return null;
  }, [spec, rawJson]);

  if (!parsed || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
    return null;
  }

  const cards = parsed.cards;
  const colClass =
    cards.length === 1
      ? "grid-cols-1"
      : cards.length === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : cards.length === 3
          ? "grid-cols-1 sm:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("my-2.5 w-full not-prose animate-in fade-in duration-200", className)}>
      {parsed.title && (
        <div className="flex items-center gap-1.5 pb-2 text-xs font-semibold text-forest dark:text-mint">
          <Activity className="size-3.5 shrink-0" />
          <span>{parsed.title}</span>
        </div>
      )}

      <div className={cn("grid gap-2 sm:gap-2.5", colClass)}>
        {cards.map((c, i) => {
          const isPos = c.status === "positive";
          const isNeg = c.status === "negative";
          const isWarn = c.status === "warning";

          const bgClass = isPos
            ? "border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10"
            : isNeg
              ? "border-rose-500/25 bg-rose-500/5 dark:bg-rose-500/10"
              : isWarn
                ? "border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10"
                : "border-sage/30 dark:border-zinc-800 bg-sage/10 dark:bg-zinc-800/40";

          const textClass = isPos
            ? "text-emerald-700 dark:text-emerald-400"
            : isNeg
              ? "text-rose-700 dark:text-rose-400"
              : isWarn
                ? "text-amber-700 dark:text-amber-400"
                : "text-foreground";

          const strVal = String(c.value ?? "");
          const valueFontSize =
            strVal.length <= 12
              ? "text-base sm:text-lg font-bold"
              : strVal.length <= 25
                ? "text-[13px] sm:text-[14.5px] font-semibold leading-snug"
                : "text-[11.5px] sm:text-xs font-medium leading-relaxed line-clamp-3";

          return (
            <div
              key={i}
              className={cn(
                "p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between transition-all shadow-2xs hover:shadow-xs",
                bgClass
              )}
            >
              <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-muted-foreground">
                <span className="truncate">{c.label}</span>
                {c.change && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full shrink-0",
                      isPos
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        : isNeg
                          ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isPos ? (
                      <TrendingUp className="size-2.5" />
                    ) : isNeg ? (
                      <TrendingDown className="size-2.5" />
                    ) : null}
                    {c.change}
                  </span>
                )}
              </div>

              <div className="my-1 min-h-[26px] flex items-center">
                <span className={cn(valueFontSize, "tracking-tight break-words", textClass)}>
                  {c.value}
                </span>
              </div>

              {c.subtext && (
                <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">{c.subtext}</p>
              )}
            </div>
          );
        })}
      </div>

      {parsed.summary && (
        <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
          {parsed.summary}
        </div>
      )}
    </div>
  );
}
