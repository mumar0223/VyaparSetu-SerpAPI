"use client";

import React, { useState, useEffect, useId, useMemo, useContext } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  Check,
  Copy,
  Workflow,
  Code as CodeIcon,
  Loader2,
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  LineChart as LineIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface MarkdownMessageProps {
  content: string;
  variant?: "user" | "assistant";
  isStreaming?: boolean;
}

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex];

export const StreamingContext = React.createContext<boolean>(false);

function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Code copy failed:", e);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
    >
      {copied ? (
        <>
          <Check className="size-3 text-mint" />
          <span className="text-mint font-semibold">Copied</span>
        </>
      ) : (
        <>
          <Copy className="size-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

function InteractiveCheckbox({ defaultChecked }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(Boolean(defaultChecked));
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setChecked(!checked);
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setChecked(!checked);
        }
      }}
      className={cn(
        "inline-flex items-center justify-center size-4 rounded border transition-all cursor-pointer mr-2 align-middle -mt-0.5 select-none shrink-0",
        checked
          ? "bg-forest dark:bg-mint border-forest dark:border-mint text-white dark:text-zinc-950 shadow-2xs"
          : "border-sage/60 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:border-forest dark:hover:border-mint",
      )}
    >
      {checked && <Check className="size-3 stroke-[3]" />}
    </span>
  );
}

interface BlockClassification {
  type: "mermaid" | "chart" | "process-flow" | "code" | "text";
  label: string | null;
}

function detectBlockClassification(language: string, rawCode: string): BlockClassification {
  const lang = (language || "").toLowerCase().trim();
  const code = rawCode.trim();

  // 1. Explicit Mermaid diagram
  if (lang === "mermaid") {
    return { type: "mermaid", label: "Workflow Diagram" };
  }

  // 2. Interactive Charts (```chart, ```chart-json, ```json-chart, ```recharts)
  if (
    lang === "chart" ||
    lang === "chart-json" ||
    lang === "json-chart" ||
    lang === "recharts" ||
    (code.startsWith("{") &&
      /"(?:type|chartType)"\s*:\s*"(?:bar|line|area|pie)"/i.test(code) &&
      /"data"\s*:/i.test(code))
  ) {
    return { type: "chart", label: "Interactive Chart" };
  }

  // 3. Known programming languages
  const knownLanguages: Record<string, string> = {
    javascript: "JavaScript",
    js: "JavaScript",
    typescript: "TypeScript",
    ts: "TypeScript",
    tsx: "TypeScript (React)",
    jsx: "JavaScript (React)",
    python: "Python",
    py: "Python",
    bash: "Terminal",
    sh: "Terminal",
    shell: "Terminal",
    zsh: "Terminal",
    json: "JSON",
    sql: "SQL",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    yaml: "YAML",
    yml: "YAML",
    rust: "Rust",
    rs: "Rust",
    go: "Go",
    golang: "Go",
    java: "Java",
    c: "C",
    cpp: "C++",
    csharp: "C#",
    cs: "C#",
    php: "PHP",
    dockerfile: "Docker",
    docker: "Docker",
    graphql: "GraphQL",
    xml: "XML",
    markdown: "Markdown",
    md: "Markdown",
  };

  if (lang && knownLanguages[lang]) {
    return { type: "code", label: knownLanguages[lang] };
  }

  // 4. Process Flow / ASCII Diagram / Step sequences
  const hasArrows = /(?:->|-->|==>|=>|➔|➜|→|►|▶|<-|<--|←)/.test(code);
  const hasStepBoxes = /\[\s*(?:Step|\d+|Phase|[A-Za-z0-9\s]+?)\s*\]/i.test(code);
  const hasTreeChars = /[├└│┌┐┘┴┬┼]/.test(code) || /(?:\+--|\|--|\+-\+-)/.test(code);
  const hasNumberedSteps = /(?:Step\s*\d+:|Phase\s*\d+:)/i.test(code);

  if ((hasArrows && (hasStepBoxes || hasNumberedSteps)) || hasTreeChars) {
    return { type: "process-flow", label: "Process Flow" };
  }

  // 5. Code heuristic detection if language tag was omitted
  if (
    (code.startsWith("{") && code.endsWith("}")) ||
    (code.startsWith("[") && code.endsWith("]"))
  ) {
    try {
      JSON.parse(code);
      return { type: "code", label: "JSON" };
    } catch (_) {}
  }

  if (
    /\b(SELECT\s+[\s\S]+?\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(code)
  ) {
    return { type: "code", label: "SQL" };
  }

  if (
    /^(?:npm|npx|pnpm|yarn|git|docker|curl|pip|sudo|cd|export)\s+[a-zA-Z0-9_-]/m.test(code) ||
    /^\$\s+[a-zA-Z0-9_-]/m.test(code)
  ) {
    return { type: "code", label: "Terminal" };
  }

  if (
    /\b(def\s+[a-zA-Z0-9_]+\s*\(|import\s+[a-zA-Z0-9_]+|from\s+[a-zA-Z0-9_]+\s+import|class\s+[a-zA-Z0-9_]+:)\b/.test(code)
  ) {
    return { type: "code", label: "Python" };
  }

  if (
    /\b(const\s+[a-zA-Z0-9_$]+\s*=|let\s+[a-zA-Z0-9_$]+\s*=|function\s+[a-zA-Z0-9_$]*\s*\(|console\.(?:log|error|warn)\(|export\s+(?:default|const|function))\b/.test(code)
  ) {
    return { type: "code", label: "JavaScript" };
  }

  if (
    /^<([a-zA-Z0-9_-]+)(?:\s+[^>]*)?>[\s\S]*<\/\1>$/m.test(code) &&
    /<\/[a-zA-Z0-9_-]+>/.test(code)
  ) {
    return { type: "code", label: "HTML" };
  }

  if (
    lang &&
    lang !== "text" &&
    lang !== "plaintext" &&
    lang !== "none" &&
    lang !== "code"
  ) {
    return { type: "code", label: lang.toUpperCase() };
  }

  return { type: "text", label: null };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Native Mermaid Diagram with Caching & Debouncing
 * ───────────────────────────────────────────────────────────────────────────── */
const mermaidCache = new Map<string, string>();
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => m.default);
  }
  return mermaidPromise;
}

function MermaidDiagram({ chart }: { chart: string }) {
  const isStreaming = useContext(StreamingContext);
  const rawChart = chart.trim();
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const cacheKey = `${isDark ? "dark" : "light"}:${rawChart}`;

  const [svgHtml, setSvgHtml] = useState<string | null>(
    () => mermaidCache.get(cacheKey) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const uid = useId().replace(/:/g, "_");

  useEffect(() => {
    const cached = mermaidCache.get(cacheKey);
    if (cached) {
      setSvgHtml(cached);
      setError(null);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const mermaid = await getMermaid();
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "loose",
          fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif",
          themeVariables: isDark
            ? {
                darkMode: true,
                background: "#18181b",
                primaryColor: "#059669",
                primaryTextColor: "#f4f4f5",
                primaryBorderColor: "#10b981",
                lineColor: "#71717a",
                secondaryColor: "#1e293b",
                tertiaryColor: "#27272a",
              }
            : {
                primaryColor: "#064e3b",
                primaryTextColor: "#064e3b",
                primaryBorderColor: "#059669",
                lineColor: "#94a3b8",
                secondaryColor: "#f0fdf4",
                tertiaryColor: "#f4f4f5",
              },
        });

        const renderId = `m_${uid}_${Date.now()}`;
        const { svg } = await mermaid.render(renderId, rawChart);
        mermaidCache.set(cacheKey, svg);
        if (isMounted) {
          setSvgHtml(svg);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          if (!isStreaming) {
            setError(err?.message || "Diagram syntax could not be rendered");
          }
        }
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [rawChart, cacheKey, isDark, isStreaming, uid]);

  return (
    <div className="relative my-4 rounded-xl border border-sage/30 dark:border-border bg-white dark:bg-zinc-900 overflow-hidden not-prose shadow-2xs">
      <div className="flex items-center justify-between px-3.5 py-2 bg-cream dark:bg-zinc-950 border-b border-sage/20 dark:border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium text-forest dark:text-mint">
          <Workflow className="size-3.5" />
          <span>Workflow Diagram</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Toggle source code"
          >
            <CodeIcon className="size-3" />
            <span>{showCode ? "Hide Code" : "Source"}</span>
          </button>
          <CodeCopyButton code={rawChart} />
        </div>
      </div>

      {showCode && (
        <pre className="p-3 bg-muted/40 border-b border-sage/20 dark:border-border overflow-x-auto text-[12px] font-mono text-foreground">
          <code>{rawChart}</code>
        </pre>
      )}

      <div className="p-4 overflow-x-auto flex justify-center items-center min-h-[100px] bg-white/50 dark:bg-zinc-900/50">
        {error && !isStreaming ? (
          <div className="text-xs text-muted-foreground py-2 text-center w-full">
            <p className="text-amber-600 dark:text-amber-400 font-medium mb-1">
              Diagram preview unavailable (Syntax Error)
            </p>
            <pre className="text-[11.5px] font-mono bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 text-left overflow-x-auto">
              <code>{rawChart}</code>
            </pre>
          </div>
        ) : svgHtml ? (
          <div
            className="w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <div className="w-full py-4">
            <Skeleton className="h-[120px] w-full rounded-xl" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Interactive Recharts Components with Loading Skeleton
 * ───────────────────────────────────────────────────────────────────────────── */
const PALETTE = [
  "#2D6A4F",
  "#52B788",
  "#74C69D",
  "#D8F3DC",
  "#E09F3E",
  "#E76F51",
  "#3B82F6",
  "#8B5CF6",
];

function sanitizeColor(val: any, fallback: string): string {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (
      trimmed !== "" &&
      trimmed !== "true" &&
      trimmed !== "false" &&
      trimmed !== "undefined" &&
      trimmed !== "null"
    ) {
      return trimmed;
    }
  }
  return fallback;
}

function ChartSkeleton() {
  return (
    <div className="my-3.5 w-full rounded-2xl border border-sage/30 dark:border-zinc-800 bg-white/95 dark:bg-[#131620]/95 overflow-hidden shadow-2xs not-prose p-4 h-[260px] sm:h-[280px] flex flex-col justify-between select-none">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pb-2.5 border-b border-sage/20 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="h-4 w-36 rounded" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Bar Columns Skeleton */}
      <div className="flex-1 w-full flex items-end justify-between gap-3 px-2 pt-3 pb-1">
        <Skeleton className="w-full h-[60%] rounded-t-lg" />
        <Skeleton className="w-full h-[40%] rounded-t-lg" />
        <Skeleton className="w-full h-[85%] rounded-t-lg" />
        <Skeleton className="w-full h-[55%] rounded-t-lg" />
        <Skeleton className="w-full h-[90%] rounded-t-lg" />
        <Skeleton className="w-full h-[70%] rounded-t-lg" />
      </div>

      {/* Axis Labels Skeleton */}
      <div className="flex justify-between px-1 pt-1 border-t border-sage/15 dark:border-zinc-800/60">
        <Skeleton className="h-3 w-10 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
      </div>
    </div>
  );
}

function parseFlexibleChartJson(raw: string): any {
  if (!raw) return null;
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  // 1. Strip markdown fences if present
  let cleaned = trimmed
    .replace(/^```(?:chart|json|recharts)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // 2. Remove single-line comments // and multi-line comments /* */
  cleaned = cleaned
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  // 3. Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // 4. Try fixing unquoted keys e.g. { name: "Bangalore", price: 3320 }
  try {
    const quoteKeys = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
    return JSON.parse(quoteKeys);
  } catch (_) {}

  return null;
}

function normalizeChartSpec(spec: any): {
  chartType: string;
  title: string;
  data: any[];
  xKey?: string;
  series?: Array<{ key: string; name: string; color?: string }>;
  summary?: string;
  unit?: string;
} {
  if (!spec) return { chartType: "bar", title: "Data Visualization", data: [] };

  const chartType = (spec.type || spec.chartType || "bar").toLowerCase();
  const title = spec.title || "Data Visualization";
  const summary = spec.summary || "";
  const unit = spec.unit || "";

  // 1. Root array of objects: [ { name: "A", value: 10 } ]
  if (Array.isArray(spec)) {
    return { chartType, title, data: spec, summary, unit };
  }

  // 2. spec.data or common synonyms is an array of objects
  const rawArray =
    spec.data ||
    spec.dataset ||
    spec.items ||
    spec.records ||
    spec.points ||
    spec.rows ||
    spec.values;

  if (Array.isArray(rawArray) && rawArray.length > 0 && typeof rawArray[0] === "object") {
    const sanitizedSeries = Array.isArray(spec.series)
      ? spec.series.map((s: any, idx: number) => ({
          ...s,
          key: s.key || s.dataKey || s.name || "value",
          name: s.name || s.label || s.key || "Value",
          color: sanitizeColor(s.color || s.stroke || s.fill, PALETTE[idx % PALETTE.length]),
        }))
      : undefined;

    return {
      chartType,
      title,
      data: rawArray,
      xKey: spec.xKey || spec.xAxisKey || spec.x,
      series: sanitizedSeries,
      summary,
      unit,
    };
  }

  // 3. ApexCharts / HighCharts: categories + series
  // e.g. categories: ["Bangalore", "Kolar"], series: [{ name: "Modal Price", data: [3320, 3100] }]
  const categories = spec.categories || spec.xAxis || spec.labels || spec.x;
  const rawSeries = spec.series || spec.datasets;
  if (Array.isArray(categories) && Array.isArray(rawSeries) && categories.length > 0) {
    const data = categories.map((cat: any, idx: number) => {
      const row: Record<string, any> = { name: String(cat) };
      rawSeries.forEach((s: any) => {
        const sName = s.name || s.label || "Value";
        const val = Array.isArray(s.data) ? s.data[idx] : s[cat];
        row[sName] = val;
      });
      return row;
    });
    return {
      chartType,
      title,
      data,
      xKey: "name",
      series: rawSeries.map((s: any, idx: number) => ({
        key: s.name || s.label || "Value",
        name: s.name || s.label || "Value",
        color: sanitizeColor(s.color || s.stroke || s.fill, PALETTE[idx % PALETTE.length]),
      })),
      summary,
      unit,
    };
  }

  // 4. Chart.js format: labels + datasets
  if (Array.isArray(spec.labels) && Array.isArray(spec.datasets) && spec.labels.length > 0) {
    const data = spec.labels.map((label: any, idx: number) => {
      const row: Record<string, any> = { name: String(label) };
      spec.datasets.forEach((ds: any) => {
        const dsName = ds.label || "Value";
        row[dsName] = Array.isArray(ds.data) ? ds.data[idx] : undefined;
      });
      return row;
    });
    return {
      chartType,
      title,
      data,
      xKey: "name",
      series: spec.datasets.map((ds: any, idx: number) => ({
        key: ds.label || "Value",
        name: ds.label || "Value",
        color: sanitizeColor(ds.color || ds.borderColor || ds.backgroundColor, PALETTE[idx % PALETTE.length]),
      })),
      summary,
      unit,
    };
  }

  // 5. spec.data is a key-value object: { "Bangalore": 3320, "Kolar": 3100 }
  if (spec.data && typeof spec.data === "object" && !Array.isArray(spec.data)) {
    const entries = Object.entries(spec.data);
    if (entries.length > 0) {
      const data = entries.map(([name, val]) => {
        if (typeof val === "object" && val !== null) {
          return { name, ...val };
        }
        return { name, value: val };
      });
      return { chartType, title, data, xKey: "name", summary, unit };
    }
  }

  // 6. Flat key-value pairs directly on spec
  const metaKeys = new Set([
    "title", "type", "chartType", "description", "summary", "unit", "xAxisKey", "yAxisKey", "xKey", "yKey"
  ]);
  const entries = Object.entries(spec).filter(
    ([k, v]) => !metaKeys.has(k) && (typeof v === "number" || typeof v === "string")
  );
  if (entries.length >= 2) {
    const data = entries.map(([name, value]) => ({ name, value }));
    return { chartType, title, data, xKey: "name", summary, unit };
  }

  if (Array.isArray(rawArray)) {
    return { chartType, title, data: rawArray, summary, unit };
  }

  return { chartType, title, data: [], summary, unit };
}

function ChartView({
  spec,
  normalized: propNormalized,
}: {
  spec?: any;
  normalized?: ReturnType<typeof normalizeChartSpec>;
}) {
  const normalized = useMemo(() => {
    return propNormalized || normalizeChartSpec(spec);
  }, [propNormalized, spec]);

  const { chartType, title, summary, unit, xKey: explicitXKey, series: explicitSeries } = normalized;
  const rawData = normalized.data;

  const data = useMemo(() => {
    return rawData.map((item: any) => {
      if (!item || typeof item !== "object") return item;
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(item)) {
        if (typeof v === "string") {
          const stripped = v.replace(/[₹$,]/g, "").trim();
          const num = Number(stripped);
          if (!isNaN(num) && stripped !== "") {
            cleaned[k] = num;
            continue;
          }
        }
        cleaned[k] = v;
      }
      return cleaned;
    });
  }, [rawData]);

  const sample = data[0] || {};
  const allKeys = Object.keys(sample);
  const xKey = useMemo(() => {
    return (
      explicitXKey ||
      allKeys.find((k) => typeof sample[k] === "string") ||
      allKeys[0] ||
      "name"
    );
  }, [explicitXKey, allKeys, sample]);

  const defaultYKey =
    allKeys.find((k) => typeof sample[k] === "number" && k !== xKey) ||
    allKeys[1] ||
    "value";
  const yKey = explicitSeries?.[0]?.key || defaultYKey;

  const seriesList = useMemo(() => {
    if (Array.isArray(explicitSeries) && explicitSeries.length > 0) {
      return explicitSeries.map((s, idx) => {
        const fallback = PALETTE[idx % PALETTE.length];
        const key = s.key || (s as any).dataKey || s.name || defaultYKey;
        const name = s.name || (s as any).label || key;
        const color = sanitizeColor(s.color || (s as any).stroke || (s as any).fill, fallback);
        return { key, name, color };
      });
    }
    const numKeys = allKeys.filter((k) => k !== xKey && typeof sample[k] === "number");
    if (numKeys.length > 0) {
      return numKeys.map((key, idx) => ({
        key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        color: PALETTE[idx % PALETTE.length],
      }));
    }
    return [{ key: defaultYKey, name: "Value", color: PALETTE[0] }];
  }, [explicitSeries, allKeys, xKey, sample, defaultYKey]);

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="my-3.5 w-full rounded-2xl border border-sage/30 dark:border-zinc-800 bg-white/95 dark:bg-[#131620]/95 backdrop-blur-xs overflow-hidden shadow-2xs hover:shadow-xs transition-all not-prose min-h-[260px] sm:min-h-[280px]">
      {/* Chart Header Bar */}
      <div className="px-4 py-2.5 bg-forest/5 dark:bg-zinc-800/60 border-b border-sage/20 dark:border-zinc-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-lg bg-mint-pale/80 dark:bg-zinc-800 border border-mint/20 dark:border-zinc-700 text-forest dark:text-mint flex items-center justify-center shrink-0">
            {chartType === "line" ? (
              <LineIcon className="size-3.5" />
            ) : chartType === "pie" ? (
              <PieIcon className="size-3.5" />
            ) : (
              <BarChart3 className="size-3.5" />
            )}
          </div>
          <span className="text-[13.5px] font-semibold text-forest dark:text-zinc-100 truncate">
            {title}
          </span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-forest/10 dark:bg-mint/15 text-forest dark:text-mint border border-forest/15 shrink-0">
          {chartType} chart
        </span>
      </div>

      {/* Responsive Recharts Canvas */}
      <div className="p-4 pt-5 w-full h-[260px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 260 }}>
          {chartType === "pie" ? (
            <PieChart>
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.95)",
                  borderColor: "rgba(63, 63, 70, 0.5)",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#fff",
                }}
                formatter={(val: any) => [
                  `${unit ? unit + " " : ""}${val}`,
                  "Value",
                ]}
              />
              <Pie
                isAnimationActive={false}
                data={data.map((d: any, idx: number) => ({
                  ...d,
                  fill: sanitizeColor(d.fill || d.color, PALETTE[idx % PALETTE.length]),
                }))}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={85}
                innerRadius={45}
                paddingAngle={3}
              />
              <Legend
                height={36}
                formatter={(val: any) => (
                  <span className="text-[11px] text-muted-foreground">
                    {val}
                  </span>
                )}
              />
            </PieChart>
          ) : chartType === "line" ? (
            <LineChart
              data={data}
              margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                className="dark:stroke-zinc-800"
                opacity={0.6}
              />
              <XAxis
                dataKey={xKey}
                stroke="#888888"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `${unit ? unit : ""}${v}`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.95)",
                  borderColor: "rgba(63, 63, 70, 0.5)",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#fff",
                }}
                formatter={(val: any) => [
                  `${unit ? unit + " " : ""}${val}`,
                  "",
                ]}
              />
              {seriesList.map((s: any, idx: number) => {
                const lineColor = sanitizeColor(s.color, PALETTE[idx % PALETTE.length]);
                return (
                  <Line
                    isAnimationActive={false}
                    key={s.key || `line-series-${idx}`}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={lineColor}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: lineColor }}
                    activeDot={{ r: 5 }}
                  />
                );
              })}
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart
              data={data}
              margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                className="dark:stroke-zinc-800"
                opacity={0.6}
              />
              <XAxis
                dataKey={xKey}
                stroke="#888888"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `${unit ? unit : ""}${v}`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.95)",
                  borderColor: "rgba(63, 63, 70, 0.5)",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#fff",
                }}
              />
              {seriesList.map((s: any, idx: number) => {
                const areaColor = sanitizeColor(s.color, PALETTE[idx % PALETTE.length]);
                return (
                  <Area
                    isAnimationActive={false}
                    key={s.key || `area-series-${idx}`}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={areaColor}
                    strokeWidth={2}
                    fillOpacity={0.25}
                    fill={areaColor}
                  />
                );
              })}
            </AreaChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                className="dark:stroke-zinc-800"
                opacity={0.6}
              />
              <XAxis
                dataKey={xKey}
                stroke="#888888"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `${unit ? unit : ""}${v}`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.95)",
                  borderColor: "rgba(63, 63, 70, 0.5)",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#fff",
                }}
                formatter={(val: any) => [
                  `${unit ? unit + " " : ""}${val}`,
                  "",
                ]}
              />
              {seriesList.map((s: any, idx: number) => {
                const barColor = sanitizeColor(s.color, PALETTE[idx % PALETTE.length]);
                return (
                  <Bar
                    isAnimationActive={false}
                    key={s.key || `bar-series-${idx}`}
                    dataKey={s.key}
                    name={s.name}
                    fill={barColor}
                    radius={[4, 4, 0, 0]}
                  />
                );
              })}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Summary Note */}
      {summary && (
        <div className="px-4 py-2 bg-cream/40 dark:bg-zinc-900/40 border-t border-sage/15 dark:border-zinc-800/80 text-[11.5px] text-muted-foreground">
          {summary}
        </div>
      )}
    </div>
  );
}

export const InlineMarkdownChart = React.memo(function InlineMarkdownChart({
  rawJson,
  chartSpec,
}: {
  rawJson?: string;
  chartSpec?: any;
}) {
  const isStreaming = useContext(StreamingContext);

  const normalized = useMemo(() => {
    if (chartSpec && typeof chartSpec === "object") {
      return normalizeChartSpec(chartSpec);
    }
    if (!rawJson) return null;
    const parsed = parseFlexibleChartJson(rawJson);
    if (!parsed) return null;
    return normalizeChartSpec(parsed);
  }, [rawJson, chartSpec]);

  // WHILE STREAMING:
  // If JSON is not yet complete OR data points haven't finished streaming:
  // ALWAYS KEEP DISPLAYING THE LOADING SKELETON! NEVER RETURN NULL!
  if (!normalized || normalized.data.length === 0) {
    if (isStreaming) {
      return <ChartSkeleton />;
    }
    // Only display error if streaming has completely ended and JSON genuinely couldn't be parsed:
    if (!normalized) {
      return (
        <div className="relative my-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 p-3.5 not-prose">
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
            Chart Specification Error
          </p>
          <pre className="text-[11.5px] font-mono text-muted-foreground whitespace-pre-wrap">
            {rawJson}
          </pre>
        </div>
      );
    }
    // If stream ended and data array is genuinely empty
    return null;
  }

  // The instant data points are ready: display the interactive Recharts graph!
  return <ChartView normalized={normalized} />;
});

/* ─────────────────────────────────────────────────────────────────────────────
 * Hoisted Static Components Map (Guarantees Zero Unmounting / Zero Flashing)
 * ───────────────────────────────────────────────────────────────────────────── */
const markdownComponents: Components = {
  // Fenced Code Block Handler (pre element wraps fenced blocks in react-markdown)
  pre({ children, ...props }: any) {
    const child = React.isValidElement(children) ? children : null;
    const childProps = (child ? child.props : null) as any;
    const className = childProps?.className || "";
    const match = /language-(\w+)/.exec(className);
    const language = match ? match[1].toLowerCase() : "";
    const rawCode = childProps?.children
      ? String(childProps.children).replace(/\n$/, "")
      : typeof children === "string"
        ? children.replace(/\n$/, "")
        : "";

    const block = detectBlockClassification(language, rawCode);

    // 1. Render Mermaid Flowchart / Sequence / State Diagrams natively
    if (block.type === "mermaid") {
      return <MermaidDiagram chart={rawCode} />;
    }

    // 2. Render Interactive Recharts Chart natively at the exact location
    if (block.type === "chart") {
      return <InlineMarkdownChart rawJson={rawCode} />;
    }

    // 3. Render Process Flow / Step Diagrams (e.g. [Step 1] -> [Step 2])
    if (block.type === "process-flow") {
      return (
        <div className="relative my-3 rounded-xl border border-sage/30 dark:border-border bg-white dark:bg-zinc-900 overflow-hidden not-prose shadow-2xs">
          <div className="flex items-center justify-between px-3.5 py-2 bg-cream dark:bg-zinc-950 border-b border-sage/20 dark:border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 font-semibold text-forest dark:text-mint">
              <Workflow className="size-3.5" />
              <span>{block.label}</span>
            </div>
            <CodeCopyButton code={rawCode} />
          </div>
          <pre className="p-4 overflow-x-auto text-[13px] sm:text-[13.5px] font-mono leading-relaxed text-foreground select-text whitespace-pre">
            <code>{rawCode}</code>
          </pre>
        </div>
      );
    }

    // 4. Render Real Code with detected/specified Language Header
    if (block.type === "code" && block.label) {
      return (
        <div className="relative my-3 rounded-xl border border-sage/30 dark:border-border bg-white dark:bg-zinc-900 overflow-hidden not-prose shadow-2xs">
          <div className="flex items-center justify-between px-3.5 py-1.5 bg-cream dark:bg-zinc-950 border-b border-sage/20 dark:border-border text-xs text-muted-foreground font-mono">
            <div className="flex items-center gap-1.5 font-semibold text-forest dark:text-mint">
              <CodeIcon className="size-3.5" />
              <span>{block.label}</span>
            </div>
            <CodeCopyButton code={rawCode} />
          </div>
          <pre className="p-4 overflow-x-auto text-[13.5px] font-mono text-foreground leading-relaxed select-text">
            <code className={className}>{rawCode}</code>
          </pre>
        </div>
      );
    }

    // 5. Render Plain Text / Non-Code Blocks
    return (
      <div className="relative my-3 rounded-xl border border-sage/30 dark:border-border bg-white dark:bg-zinc-900 overflow-hidden not-prose shadow-2xs">
        <div className="flex items-center justify-end px-3.5 py-1.5 bg-cream/60 dark:bg-zinc-950/60 border-b border-sage/20 dark:border-border text-xs text-muted-foreground">
          <CodeCopyButton code={rawCode} />
        </div>
        <pre className="p-4 overflow-x-auto text-[13.5px] font-mono text-foreground leading-relaxed select-text">
          <code>{rawCode || children}</code>
        </pre>
      </div>
    );
  },

  // Inline Code Component
  code({ className, children, node, ...props }: any) {
    return (
      <code
        className={cn(
          "bg-mint-pale dark:bg-mint/10 text-forest dark:text-mint px-1.5 py-0.5 rounded text-xs font-mono border border-mint/20 font-medium select-text",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  },

  // GFM Tables
  table({ children }) {
    return (
      <div className="my-4 w-full overflow-x-auto not-prose rounded-xl border border-sage/30 dark:border-border bg-white dark:bg-card shadow-2xs">
        <table className="w-full text-left text-sm border-collapse">
          {children}
        </table>
      </div>
    );
  },
  thead({ children }) {
    return (
      <thead className="bg-cream dark:bg-muted border-b border-sage/30 dark:border-border font-semibold text-foreground">
        {children}
      </thead>
    );
  },
  tbody({ children }) {
    return (
      <tbody className="divide-y divide-sage/20 dark:divide-border">
        {children}
      </tbody>
    );
  },
  tr({ children }) {
    return (
      <tr className="hover:bg-cream/50 dark:hover:bg-muted/50 transition-colors">
        {children}
      </tr>
    );
  },
  th({ children }) {
    return (
      <th className="px-3.5 py-2.5 text-xs font-serif font-bold text-forest dark:text-foreground">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="px-3.5 py-2.5 text-xs text-foreground/90 leading-normal">
        {children}
      </td>
    );
  },

  // Headings
  h1({ children }) {
    return (
      <h1 className="text-2xl font-serif font-bold text-forest dark:text-foreground mt-5 mb-2">
        {children}
      </h1>
    );
  },
  h2({ children }) {
    return (
      <h2 className="text-xl font-serif font-bold text-forest dark:text-foreground mt-4 mb-2">
        {children}
      </h2>
    );
  },
  h3({ children }) {
    return (
      <h3 className="text-lg font-serif font-bold text-forest dark:text-foreground mt-3 mb-1.5">
        {children}
      </h3>
    );
  },
  h4({ children }) {
    return (
      <h4 className="text-base font-serif font-bold text-forest dark:text-foreground mt-2.5 mb-1">
        {children}
      </h4>
    );
  },

  strong({ children }) {
    return <strong className="font-bold text-foreground">{children}</strong>;
  },

  // Lists
  ul({ children, className }: any) {
    const isTaskList = className?.includes("contains-task-list");
    return (
      <ul
        className={cn(
          "space-y-1.5 my-2.5 text-foreground/90",
          isTaskList ? "list-none pl-1" : "list-disc list-outside pl-5",
        )}
      >
        {children}
      </ul>
    );
  },
  ol({ children }) {
    return (
      <ol className="list-decimal list-outside pl-5 space-y-1.5 my-2.5 text-foreground/90">
        {children}
      </ol>
    );
  },
  li({ children, className }: any) {
    const isTaskItem = className?.includes("task-list-item");
    return (
      <li
        className={cn(
          "leading-relaxed",
          isTaskItem && "list-none flex items-start py-0.5",
        )}
      >
        {children}
      </li>
    );
  },
  input({ node, ...props }: any) {
    if (props.type === "checkbox") {
      return <InteractiveCheckbox defaultChecked={props.checked} />;
    }
    return <input {...props} />;
  },

  // Paragraphs
  p({ children, ...props }: any) {
    const hasBlockChild = React.Children.toArray(children).some((child) => {
      if (!React.isValidElement(child)) return false;
      const type = child.type;
      return (
        type === "div" ||
        type === "pre" ||
        type === "table" ||
        type === "ul" ||
        type === "ol" ||
        type === "blockquote" ||
        type === "hr"
      );
    });

    if (hasBlockChild) {
      return (
        <div className="leading-relaxed my-2 text-foreground" {...props}>
          {children}
        </div>
      );
    }

    return (
      <p className="leading-relaxed my-2 text-foreground" {...props}>
        {children}
      </p>
    );
  },

  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-mint pl-3.5 italic text-muted-foreground my-3">
        {children}
      </blockquote>
    );
  },

  hr() {
    return <hr className="my-4 border-sage/30 dark:border-border" />;
  },

  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-forest dark:text-mint font-semibold underline underline-offset-2 hover:opacity-80 transition-colors"
      >
        {children}
      </a>
    );
  },

  img({ src, alt }: any) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || "Image"}
        className="my-3 rounded-xl max-w-full h-auto border border-sage/30 dark:border-border shadow-2xs"
        loading="lazy"
      />
    );
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Main MarkdownMessage Export (Memoized & Powered by Static Hoisted Components)
 * ───────────────────────────────────────────────────────────────────────────── */
export const MarkdownMessage = React.memo(function MarkdownMessage({
  content,
  variant = "assistant",
  isStreaming = false,
}: MarkdownMessageProps) {
  if (variant === "user") {
    return <p className="whitespace-pre-wrap select-text">{content}</p>;
  }

  return (
    <StreamingContext.Provider value={isStreaming}>
      <div className="prose max-w-none text-[14.5px] sm:text-[15px] leading-relaxed text-foreground dark:prose-invert font-sans">
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    </StreamingContext.Provider>
  );
});
