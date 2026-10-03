"use client";

import React, { useState, useMemo } from "react";
import {
  Calculator,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  Info,
  TrendingUp,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalculatorInputSpec {
  id: string;
  label: string;
  type: "slider" | "number" | "select";
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number | string;
  unit?: string;
  options?: Array<{ label: string; value: number | string }>;
  helpText?: string;
}

export interface CalculatorOutputSpec {
  id?: string;
  label: string;
  formula: string;
  format?: "currency" | "percentage" | "number" | "days";
  unit?: string;
  highlight?: boolean;
  status?: "positive" | "warning" | "neutral" | "negative";
  subtext?: string;
}

export interface CalculatorSpec {
  title: string;
  description?: string;
  badge?: string;
  inputs: CalculatorInputSpec[];
  outputs: CalculatorOutputSpec[];
}

/**
 * Evaluates a mathematical expression safely without `eval()`.
 * Supports +, -, *, /, ^ (power), parentheses, variables, and helper functions:
 * emi(p, r_percent, n_months), min(a, b), max(a, b), round(a).
 */
export function evaluateSafeFormula(
  formula: string,
  vars: Record<string, number>
): number {
  if (!formula || typeof formula !== "string") return 0;

  let sanitized = formula.trim();

  // 1. Pre-process helper functions
  // emi(p, r, n) -> p * (r/1200) * (1 + r/1200)^n / ((1 + r/1200)^n - 1)
  const emiRegex = /emi\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi;
  sanitized = sanitized.replace(emiRegex, (_, pExpr, rExpr, nExpr) => {
    const p = evaluateSafeFormula(pExpr, vars);
    const r = evaluateSafeFormula(rExpr, vars);
    const n = evaluateSafeFormula(nExpr, vars);
    if (p <= 0 || n <= 0) return "0";
    if (r <= 0) return String(Math.round(p / n));
    const monthlyRate = r / 1200;
    const factor = Math.pow(1 + monthlyRate, n);
    const emi = (p * monthlyRate * factor) / (factor - 1);
    return isFinite(emi) ? String(emi) : "0";
  });

  // total_interest(p, r, n) -> emi * n - p
  const interestRegex = /total_interest\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi;
  sanitized = sanitized.replace(interestRegex, (_, pExpr, rExpr, nExpr) => {
    const p = evaluateSafeFormula(pExpr, vars);
    const r = evaluateSafeFormula(rExpr, vars);
    const n = evaluateSafeFormula(nExpr, vars);
    if (p <= 0 || n <= 0) return "0";
    if (r <= 0) return "0";
    const monthlyRate = r / 1200;
    const factor = Math.pow(1 + monthlyRate, n);
    const emi = (p * monthlyRate * factor) / (factor - 1);
    const totalInt = emi * n - p;
    return isFinite(totalInt) ? String(Math.max(0, totalInt)) : "0";
  });

  // min(a, b) & max(a, b)
  sanitized = sanitized.replace(/min\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, (_, a, b) => {
    return String(Math.min(evaluateSafeFormula(a, vars), evaluateSafeFormula(b, vars)));
  });
  sanitized = sanitized.replace(/max\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, (_, a, b) => {
    return String(Math.max(evaluateSafeFormula(a, vars), evaluateSafeFormula(b, vars)));
  });
  sanitized = sanitized.replace(/round\s*\(\s*([^)]+)\s*\)/gi, (_, a) => {
    return String(Math.round(evaluateSafeFormula(a, vars)));
  });

  // 2. Tokenize expression
  // Replace variable identifiers with their numeric value
  // Sort keys by length descending so longer variable names match first
  const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const k of sortedKeys) {
    const regex = new RegExp(`\\b${k}\\b`, "g");
    sanitized = sanitized.replace(regex, String(vars[k]));
  }

  // 3. Safe recursive descent arithmetic parser
  let pos = 0;

  function peek(): string {
    while (pos < sanitized.length && sanitized[pos] === " ") pos++;
    return pos < sanitized.length ? sanitized[pos] : "";
  }

  function getChar(): string {
    while (pos < sanitized.length && sanitized[pos] === " ") pos++;
    return pos < sanitized.length ? sanitized[pos++] : "";
  }

  function parseNumber(): number {
    let start = pos;
    if (peek() === "-") getChar();
    while (pos < sanitized.length && /[0-9.]/.test(sanitized[pos])) {
      pos++;
    }
    const substr = sanitized.slice(start, pos);
    const n = parseFloat(substr);
    return isNaN(n) ? 0 : n;
  }

  function parseFactor(): number {
    const ch = peek();
    if (ch === "(") {
      getChar(); // '('
      const val = parseExpression();
      if (peek() === ")") getChar(); // ')'
      return val;
    }
    if (ch === "+") {
      getChar();
      return parseFactor();
    }
    if (ch === "-") {
      getChar();
      return -parseFactor();
    }
    return parseNumber();
  }

  function parsePower(): number {
    let val = parseFactor();
    while (peek() === "^") {
      getChar();
      const exponent = parseFactor();
      val = Math.pow(val, exponent);
    }
    return val;
  }

  function parseTerm(): number {
    let val = parsePower();
    while (true) {
      const ch = peek();
      if (ch === "*") {
        getChar();
        val *= parsePower();
      } else if (ch === "/") {
        getChar();
        const denom = parsePower();
        val = denom !== 0 ? val / denom : 0;
      } else if (ch === "%") {
        getChar();
        const denom = parsePower();
        val = denom !== 0 ? val % denom : 0;
      } else {
        break;
      }
    }
    return val;
  }

  function parseExpression(): number {
    let val = parseTerm();
    while (true) {
      const ch = peek();
      if (ch === "+") {
        getChar();
        val += parseTerm();
      } else if (ch === "-") {
        getChar();
        val -= parseTerm();
      } else {
        break;
      }
    }
    return val;
  }

  try {
    const result = parseExpression();
    return isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

/**
 * Formats a calculated numeric value.
 */
function formatOutputValue(val: number, format?: string, explicitUnit?: string): string {
  if (isNaN(val)) return "0";

  if (format === "currency") {
    const rounded = Math.round(val);
    if (Math.abs(rounded) >= 10000000) {
      return `₹${(rounded / 10000000).toFixed(2)} Cr`;
    }
    if (Math.abs(rounded) >= 100000) {
      return `₹${(rounded / 100000).toFixed(2)} Lakh`;
    }
    return `₹${rounded.toLocaleString("en-IN")}`;
  }

  if (format === "percentage") {
    return `${val.toFixed(1)}%`;
  }

  if (format === "days") {
    return `${Math.round(val)} days`;
  }

  const formatted = Math.abs(val) >= 1000 ? val.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : val.toFixed(1).replace(/\.0$/, "");
  return explicitUnit ? `${formatted} ${explicitUnit}` : formatted;
}

export function InteractiveCalculator({ rawJson, spec }: { rawJson?: string; spec?: CalculatorSpec }) {
  const parsedSpec = useMemo<CalculatorSpec | null>(() => {
    if (spec) return spec;
    if (!rawJson) return null;
    try {
      const cleaned = rawJson
        .trim()
        .replace(/^```(?:calculator|simulator|calc|json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }, [rawJson, spec]);

  // Track state for each input field
  const initialValues = useMemo<Record<string, number>>(() => {
    if (!parsedSpec || !Array.isArray(parsedSpec.inputs)) return {};
    const init: Record<string, number> = {};
    for (const inp of parsedSpec.inputs) {
      const def = inp.defaultValue !== undefined ? Number(inp.defaultValue) : inp.min !== undefined ? inp.min : 0;
      init[inp.id] = isNaN(def) ? 0 : def;
    }
    return init;
  }, [parsedSpec]);

  const [values, setValues] = useState<Record<string, number>>(initialValues);

  // Sync state if spec changes
  React.useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const handleSliderChange = (id: string, val: number) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  };

  const handleReset = () => {
    setValues(initialValues);
  };

  // Evaluate all output formulas live
  const computedOutputs = useMemo(() => {
    if (!parsedSpec || !Array.isArray(parsedSpec.outputs)) return [];
    return parsedSpec.outputs.map((out) => {
      const rawVal = evaluateSafeFormula(out.formula, values);
      return {
        ...out,
        numericValue: rawVal,
        formattedValue: formatOutputValue(rawVal, out.format, out.unit),
      };
    });
  }, [parsedSpec, values]);

  if (!parsedSpec || !parsedSpec.inputs || parsedSpec.inputs.length === 0) {
    return null;
  }

  return (
    <div className="my-3.5 w-full rounded-2xl border border-sage/30 dark:border-zinc-800 bg-white/95 dark:bg-[#12151e]/95 backdrop-blur-xs overflow-hidden shadow-2xs hover:shadow-xs transition-all not-prose">
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-forest/5 dark:bg-zinc-800/60 border-b border-sage/20 dark:border-zinc-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-lg bg-mint-pale/80 dark:bg-zinc-800 border border-mint/20 dark:border-zinc-700 text-forest dark:text-mint flex items-center justify-center shrink-0">
            <Calculator className="size-3.5" />
          </div>
          <div>
            <h4 className="text-[13.5px] font-semibold text-forest dark:text-zinc-100 truncate">
              {parsedSpec.title || "Interactive Calculation Simulator"}
            </h4>
            {parsedSpec.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {parsedSpec.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {parsedSpec.badge && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-forest/10 dark:bg-mint/15 text-forest dark:text-mint border border-forest/15">
              {parsedSpec.badge}
            </span>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-cream dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Reset to initial values"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* Output KPI Cards Grid */}
        {computedOutputs.length > 0 && (
          <div
            className={cn(
              "grid gap-2.5",
              computedOutputs.length === 1
                ? "grid-cols-1"
                : computedOutputs.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-3"
            )}
          >
            {computedOutputs.map((out, idx) => {
              const isHighlight = out.highlight || idx === computedOutputs.length - 1;
              return (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-xl border transition-all flex flex-col justify-between",
                    isHighlight
                      ? "bg-forest/5 dark:bg-mint/10 border-forest/20 dark:border-mint/30 shadow-2xs"
                      : "bg-cream/40 dark:bg-zinc-900/50 border-sage/25 dark:border-zinc-800"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-muted-foreground">
                    <span className="truncate">{out.label}</span>
                    {isHighlight && <Activity className="size-3 text-forest dark:text-mint shrink-0" />}
                  </div>
                  <div
                    className={cn(
                      "text-lg sm:text-xl font-bold tracking-tight mt-1 truncate",
                      isHighlight
                        ? "text-forest dark:text-mint"
                        : "text-foreground"
                    )}
                  >
                    {out.formattedValue}
                  </div>
                  {out.subtext && (
                    <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                      {out.subtext}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Input Sliders & Selectors */}
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <SlidersHorizontal className="size-3.5 text-forest dark:text-mint" />
            <span>Adjust Parameters (Live Simulation)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {parsedSpec.inputs.map((inp) => {
              const curVal = values[inp.id] !== undefined ? values[inp.id] : (inp.min || 0);

              if (inp.type === "select" && inp.options && inp.options.length > 0) {
                return (
                  <div key={inp.id} className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground/90 block">
                      {inp.label}
                    </label>
                    <select
                      value={curVal}
                      onChange={(e) => handleSliderChange(inp.id, Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-sage/30 dark:border-zinc-800 text-xs font-semibold text-foreground focus:outline-hidden focus:border-mint cursor-pointer shadow-2xs"
                    >
                      {inp.options.map((opt, oIdx) => (
                        <option key={oIdx} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              const min = inp.min !== undefined ? inp.min : 0;
              const max = inp.max !== undefined ? inp.max : 100;
              const step = inp.step !== undefined ? inp.step : 1;

              return (
                <div
                  key={inp.id}
                  className="p-3 rounded-xl bg-cream/30 dark:bg-zinc-900/40 border border-sage/20 dark:border-zinc-800/80 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground/90">{inp.label}</span>
                    <span className="font-mono font-bold text-forest dark:text-mint">
                      {inp.unit === "₹" ? `₹${curVal.toLocaleString("en-IN")}` : inp.unit ? `${curVal.toLocaleString("en-IN")} ${inp.unit}` : curVal.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {/* Range Slider */}
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={curVal}
                    onChange={(e) => handleSliderChange(inp.id, Number(e.target.value))}
                    className="w-full h-1.5 bg-sage/30 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-forest dark:accent-mint focus:outline-hidden"
                  />

                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>{inp.unit === "₹" ? `₹${min.toLocaleString("en-IN")}` : `${min} ${inp.unit || ""}`}</span>
                    <span>{inp.unit === "₹" ? `₹${max.toLocaleString("en-IN")}` : `${max} ${inp.unit || ""}`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
