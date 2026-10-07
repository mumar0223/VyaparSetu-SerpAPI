"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Check,
  X,
  Plus,
  Trash2,
  Mic,
  AudioLines,
  Target,
  PieChart as PieIcon,
  IndianRupee,
  Calendar,
  Layers,
  Landmark,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  LineChart as LineIcon,
  Activity,
  Download,
  ClipboardList,
  ChevronDown,
  Printer,
  Copy,
  FileText,
  FileSpreadsheet,
  LayoutTemplate,
  Pencil,
  Coins,
  Store,
  CreditCard,
  Compass,
} from "lucide-react";
import { SwarmTabsCard } from "./swarm-tabs-card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MarkdownMessage } from "./markdown-message";

export interface ArtifactPayload {
  artifactId?: string;
  targetArtifactId?: string;
  isUpdated?: boolean;
  artifactType:
    | "budget"
    | "expense"
    | "transaction"
    | "saving_goal"
    | "debt"
    | "delete_record"
    | "chart"
    | "form"
    | "document"
    | "mandi_arbitrage"
    | "mandi"
    | "govt_schemes"
    | "schemes"
    | "swot_matrix"
    | "swot"
    | "catchment_radar"
    | "competitors"
    | "emi_calculator"
    | "credit"
    | "swarm_dossier"
    | (string & {});
  title?: string;
  summary?: string;
  data: any;
}

interface ArtifactModalProps {
  isOpen: boolean;
  onClose: () => void;
  artifact: ArtifactPayload | null;
  onCommitSuccess?: (record: any) => void;
  isVoiceMode?: boolean;
  onVoiceHoldStart?: () => void;
  onVoiceHoldEnd?: () => void;
  isUserSpeaking?: boolean;
  isHoldingToSpeak?: boolean;
}

export function convertFormToMarkdown(formData: any): string {
  let md = `# ${formData.title || "Official Registration Form"}\n\n`;
  if (formData.documentBadge) {
    md += `**Document Code:** \`${formData.documentBadge}\`\n\n`;
  }
  if (formData.description) {
    md += `> ${formData.description}\n\n`;
  }

  for (const sec of formData.sections || []) {
    md += `### ${sec.title || "Section Details"}\n\n`;
    if (sec.description) md += `*${sec.description}*\n\n`;

    if (sec.table && sec.table.headers?.length) {
      md += `| ${sec.table.headers.join(" | ")} |\n`;
      md += `| ${sec.table.headers.map(() => "---").join(" | ")} |\n`;
      for (const row of sec.table.rows || []) {
        md += `| ${row.join(" | ")} |\n`;
      }
      md += "\n";
    }

    const allRows: any[] = [];
    if (sec.rows?.length) {
      allRows.push(...sec.rows);
    } else if (sec.fields?.length) {
      for (let i = 0; i < sec.fields.length; i += 2) {
        allRows.push({ fields: sec.fields.slice(i, i + 2) });
      }
    }

    if (allRows.length > 0) {
      md += `| Field / विवरण | Value / प्रविष्टि |\n| :--- | :--- |\n`;
      for (const r of allRows) {
        for (const f of r.fields || []) {
          const val =
            formData.values?.[f.id] !== undefined
              ? formData.values[f.id]
              : (f.defaultValue ?? "");
          md += `| **${f.label || f.id}** | ${String(val || "-")} |\n`;
        }
      }
      md += "\n";
    }
  }

  return md;
}

export function chunkFieldsIntoRows(fields: any[]): Array<{ fields: any[] }> {
  const rows: Array<{ fields: any[] }> = [];
  let currentRow: any[] = [];

  for (const f of fields) {
    const isFullWidth =
      f.colSpan === 2 ||
      f.colSpan === 3 ||
      f.type === "textarea" ||
      f.type === "checkbox" ||
      f.id?.toLowerCase().includes("address") ||
      f.id?.toLowerCase().includes("notes") ||
      f.id?.toLowerCase().includes("purpose") ||
      f.id?.toLowerCase().includes("declaration") ||
      f.id?.toLowerCase().includes("certif") ||
      f.id?.toLowerCase().includes("undertaking") ||
      f.id?.toLowerCase().includes("description");

    if (isFullWidth) {
      if (currentRow.length > 0) {
        rows.push({ fields: currentRow });
        currentRow = [];
      }
      rows.push({ fields: [f] });
    } else {
      currentRow.push(f);
      if (currentRow.length === 2) {
        rows.push({ fields: currentRow });
        currentRow = [];
      }
    }
  }

  if (currentRow.length > 0) {
    rows.push({ fields: currentRow });
  }

  return rows;
}

export function ArtifactModal({
  isOpen,
  onClose,
  artifact,
  onCommitSuccess,
  isVoiceMode = false,
  onVoiceHoldStart,
  onVoiceHoldEnd,
  isUserSpeaking = false,
  isHoldingToSpeak = false,
}: ArtifactModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [activeChartType, setActiveChartType] = useState<"bar" | "line" | "area" | "pie">("bar");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formViewMode, setFormViewMode] = useState<"paper" | "classic">("paper");
  const [inlineEditingFieldId, setInlineEditingFieldId] = useState<string | null>(null);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  useEffect(() => {
    if (artifact?.data) {
      const cloned = JSON.parse(JSON.stringify(artifact.data));
      if (artifact.artifactType === "form" && cloned.sections) {
        const initialVals: Record<string, any> = cloned.values || {};
        for (const sec of cloned.sections) {
          const allFields = [
            ...(sec.fields || []),
            ...(sec.rows?.flatMap((r: any) => r.fields || []) || []),
          ];
          for (const f of allFields) {
            if (f.id && initialVals[f.id] === undefined) {
              initialVals[f.id] =
                f.value !== undefined
                  ? f.value
                  : (f.defaultValue !== undefined ? f.defaultValue : "");
            }
          }
        }
        cloned.values = initialVals;
      }
      setFormData(cloned);
      if (artifact.artifactType === "chart" && artifact.data.chartType) {
        setActiveChartType(artifact.data.chartType);
      }
    }
  }, [artifact]);

  if (!artifact) return null;

  const handleCopyMarkdown = () => {
    let md = "";
    if (artifact.artifactType === "document" || formData.content || formData.markdown || artifact.data?.content) {
      md = formData.content || formData.markdown || artifact.data?.content || artifact.summary || "";
    } else if (artifact.artifactType === "form") {
      md = convertFormToMarkdown(formData);
    }
    if (md) {
      void navigator.clipboard.writeText(md);
      setCopiedMarkdown(true);
      toast.success("Copied markdown to clipboard!");
      setTimeout(() => setCopiedMarkdown(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleDynamicFieldChange = (fieldId: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      values: {
        ...(prev.values || {}),
        [fieldId]: value,
      },
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData((prev: any) => {
      const items = [...(prev.items || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const handleAddItem = () => {
    setFormData((prev: any) => ({
      ...prev,
      items: [...(prev.items || []), { category: "New Category", allocatedAmount: 5000 }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData((prev: any) => {
      const items = (prev.items || []).filter((_: any, i: number) => i !== index);
      return { ...prev, items };
    });
  };

  const handleApprove = async () => {
    if (
      artifact.artifactType === "chart" ||
      artifact.artifactType === "document" ||
      [
        "mandi_arbitrage",
        "mandi",
        "govt_schemes",
        "schemes",
        "swot_matrix",
        "swot",
        "catchment_radar",
        "competitors",
        "emi_calculator",
        "credit",
        "swarm_dossier",
      ].includes(artifact.artifactType)
    ) {
      toast.success(
        artifact.artifactType === "chart"
          ? "Visual chart view saved!"
          : "Intelligence details reviewed!"
      );
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/agent/commit-artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactType: artifact.artifactType,
          data: formData,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to commit record.");
      }

      toast.success(json.message || "Record successfully committed to database!");
      onCommitSuccess?.(json.record);
      onClose();
    } catch (err: any) {
      console.error("Commit artifact error:", err);
      toast.error(err?.message || "Failed to commit record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateAllocatedTotal = () => {
    return (formData.items || []).reduce(
      (sum: number, item: any) => sum + (Number(item.allocatedAmount) || 0),
      0
    );
  };

  const renderPaperFieldValue = (field: any) => {
    const fieldVal =
      formData.values?.[field.id] !== undefined
        ? formData.values[field.id]
        : (field.defaultValue !== undefined ? field.defaultValue : "");

    const isEditing = inlineEditingFieldId === field.id;

    if (isEditing) {
      if (field.type === "select") {
        return (
          <DropdownMenu
            open={inlineEditingFieldId === field.id}
            onOpenChange={(open) => {
              if (!open) setInlineEditingFieldId(null);
            }}
          >
            <DropdownMenuTrigger className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-mint text-xs text-foreground font-semibold flex items-center justify-between focus:outline-hidden cursor-pointer shadow-xs">
              <span className="truncate">{fieldVal || field.placeholder || "Select option"}</span>
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0 opacity-70 ml-1" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-(--anchor-width) min-w-[180px] bg-white dark:bg-[#18181b] border border-sage/30 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1"
            >
              {(field.options || []).map((opt: string, optIdx: number) => (
                <DropdownMenuItem
                  key={`${opt}-${optIdx}`}
                  onClick={() => {
                    handleDynamicFieldChange(field.id, opt);
                    setInlineEditingFieldId(null);
                  }}
                  className="cursor-pointer text-xs rounded-lg px-2.5 py-1.5 focus:bg-cream dark:focus:bg-muted"
                >
                  {opt}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }

      if (field.type === "checkbox") {
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              autoFocus
              checked={Boolean(fieldVal)}
              onChange={(e) => handleDynamicFieldChange(field.id, e.target.checked)}
              onBlur={() => setInlineEditingFieldId(null)}
              className="size-4 rounded accent-forest dark:accent-mint"
            />
            <span className="text-xs font-semibold text-foreground">
              {fieldVal ? "Yes / हाँ" : "No / नहीं"}
            </span>
          </label>
        );
      }

      if (field.type === "number") {
        return (
          <input
            type="number"
            autoFocus
            value={fieldVal}
            onChange={(e) =>
              handleDynamicFieldChange(
                field.id,
                e.target.value === "" ? "" : Number(e.target.value)
              )
            }
            onBlur={() => setInlineEditingFieldId(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setInlineEditingFieldId(null);
            }}
            placeholder={field.placeholder || "0"}
            className="w-full text-xs bg-white dark:bg-zinc-900 border border-mint rounded-lg px-2 py-1 text-foreground font-semibold focus:outline-hidden"
          />
        );
      }

      if (field.type === "date") {
        return (
          <input
            type="date"
            autoFocus
            value={fieldVal || ""}
            onChange={(e) => handleDynamicFieldChange(field.id, e.target.value)}
            onBlur={() => setInlineEditingFieldId(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setInlineEditingFieldId(null);
            }}
            className="w-full text-xs bg-white dark:bg-zinc-900 border border-mint rounded-lg px-2 py-1 text-foreground font-semibold focus:outline-hidden"
          />
        );
      }

      // Auto word-wrap & auto-height expanding textarea for text/textarea inputs
      return (
        <textarea
          autoFocus
          rows={1}
          value={fieldVal || ""}
          ref={(el) => {
            if (el) {
              el.style.height = "auto";
              el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
            }
          }}
          onChange={(e) => {
            handleDynamicFieldChange(field.id, e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.max(e.target.scrollHeight, 28)}px`;
          }}
          onBlur={() => setInlineEditingFieldId(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              setInlineEditingFieldId(null);
            }
          }}
          placeholder={field.placeholder || ""}
          className="w-full text-xs bg-white dark:bg-zinc-900 border border-mint rounded-lg px-2 py-1 text-foreground font-semibold focus:outline-hidden resize-none overflow-hidden break-words whitespace-pre-wrap leading-relaxed"
        />
      );
    }

    return (
      <div
        onClick={() => setInlineEditingFieldId(field.id)}
        className="flex items-center justify-between w-full gap-2 select-none min-h-[24px]"
        title="Click to edit value"
      >
        {field.displayVariant === "char_boxes" || field.displayVariant === "character_boxes" ? (
          <div className="flex items-center gap-1 flex-wrap">
            {(String(fieldVal || "").padEnd(field.charCount || 8, " "))
              .split("")
              .map((c, i) => (
                <span
                  key={i}
                  className="size-5 sm:size-5.5 border border-sage/50 dark:border-border rounded-xs bg-cream/30 dark:bg-muted/40 flex items-center justify-center font-mono font-bold text-[11px] text-foreground uppercase shadow-2xs"
                >
                  {c.trim() || "\u00A0"}
                </span>
              ))}
          </div>
        ) : field.type === "checkbox" ? (
          <span className="font-semibold text-xs text-foreground">
            {fieldVal ? "✓ Yes / हाँ" : "✕ No / नहीं"}
          </span>
        ) : (
          <span className="font-semibold text-xs text-foreground break-words whitespace-pre-wrap leading-relaxed">
            {fieldVal !== undefined && fieldVal !== "" ? (
              String(fieldVal)
            ) : (
              <span className="text-muted-foreground/40 italic font-normal">Click to fill</span>
            )}
            {field.suffix && <span className="ml-1 text-muted-foreground font-normal">{field.suffix}</span>}
          </span>
        )}

        <Pencil className="size-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 md:p-7 rounded-2xl bg-white dark:bg-[#0c0e12] border border-sage/30 dark:border-zinc-800 text-foreground font-sans shadow-2xl z-50">
        <DialogHeader className="pr-8">
          <div className="flex items-start gap-3 mb-1">
            <span className="p-2 rounded-xl bg-mint-pale dark:bg-mint/15 text-forest dark:text-mint shrink-0 mt-0.5">
              {artifact.artifactType === "budget" && <PieIcon className="size-5" />}
              {artifact.artifactType === "chart" && <BarChart3 className="size-5" />}
              {artifact.artifactType === "expense" && <IndianRupee className="size-5" />}
              {artifact.artifactType === "transaction" && <Layers className="size-5" />}
              {artifact.artifactType === "saving_goal" && <Target className="size-5" />}
              {artifact.artifactType === "debt" && <Landmark className="size-5" />}
              {artifact.artifactType === "form" && <ClipboardList className="size-5" />}
              {artifact.artifactType === "document" && <FileSpreadsheet className="size-5" />}
              {(artifact.artifactType === "mandi_arbitrage" || artifact.artifactType === "mandi") && <Coins className="size-5" />}
              {(artifact.artifactType === "govt_schemes" || artifact.artifactType === "schemes") && <Landmark className="size-5" />}
              {(artifact.artifactType === "swot_matrix" || artifact.artifactType === "swot") && <Target className="size-5" />}
              {(artifact.artifactType === "catchment_radar" || artifact.artifactType === "competitors") && <Store className="size-5" />}
              {(artifact.artifactType === "emi_calculator" || artifact.artifactType === "credit") && <CreditCard className="size-5" />}
              {artifact.artifactType === "swarm_dossier" && <Compass className="size-5" />}
              {artifact.artifactType === "delete_record" && <AlertTriangle className="size-5 text-rose-500" />}
              {![
                "budget", "chart", "expense", "transaction", "saving_goal", "debt", "form",
                "document", "mandi_arbitrage", "mandi", "govt_schemes", "schemes",
                "swot_matrix", "swot", "catchment_radar", "competitors", "emi_calculator", "credit", "swarm_dossier", "delete_record"
              ].includes(artifact.artifactType) && <FileText className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-serif font-bold text-lg sm:text-2xl text-forest dark:text-foreground leading-snug">
                {artifact.title || `Review & Approve ${artifact.artifactType}`}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {artifact.summary || "Review the generated draft below. You can edit any value before approving."}
              </DialogDescription>
            </div>
          </div>

          {/* Top Controls Toolbar for Forms and Documents */}
          {artifact.artifactType === "form" && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sage/20 dark:border-border/40 mt-3">
              <div className="flex items-center gap-2">
                {formData.documentBadge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-forest/10 dark:bg-mint/20 text-forest dark:text-mint border border-forest/20">
                    {formData.documentBadge}
                  </span>
                )}
                <div className="inline-flex p-0.5 rounded-xl bg-cream/70 dark:bg-muted/40 border border-sage/30 dark:border-border">
                  <button
                    type="button"
                    onClick={() => setFormViewMode("paper")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                      formViewMode === "paper"
                        ? "bg-forest dark:bg-mint text-white dark:text-black shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FileText className="size-3.5" />
                    <span>Official Paper</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormViewMode("classic")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                      formViewMode === "classic"
                        ? "bg-forest dark:bg-mint text-white dark:text-black shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <LayoutTemplate className="size-3.5" />
                    <span>Classic Inputs</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-sage/30 dark:border-border bg-white dark:bg-card hover:bg-cream dark:hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Copy form data as Markdown"
                >
                  {copiedMarkdown ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
                  <span>{copiedMarkdown ? "Copied" : "Copy MD"}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-sage/30 dark:border-border bg-white dark:bg-card hover:bg-cream dark:hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Print document or Save as PDF"
                >
                  <Printer className="size-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>
          )}

          {(artifact.artifactType === "document" ||
            Boolean(formData.content || formData.markdown || artifact.data?.content)) && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sage/20 dark:border-border/40 mt-3">
              <div className="flex items-center gap-2">
                {formData.badge && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-forest/10 dark:bg-mint/20 text-forest dark:text-mint border border-forest/20">
                    {formData.badge}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-sage/30 dark:border-border bg-white dark:bg-card hover:bg-cream dark:hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Copy Markdown"
                >
                  {copiedMarkdown ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
                  <span>{copiedMarkdown ? "Copied" : "Copy MD"}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-sage/30 dark:border-border bg-white dark:bg-card hover:bg-cream dark:hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Print document or Save as PDF"
                >
                  <Printer className="size-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* ── Dynamic Form Based on Artifact Type ── */}
        <div className="space-y-4 py-3">
          {/* 1. BUDGET ARTIFACT FORM */}
          {artifact.artifactType === "budget" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Budget Plan Name
                  </label>
                  <input
                    type="text"
                    value={formData.name || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm text-foreground focus:outline-hidden focus:border-mint"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Period Frequency
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full h-9.5 px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-xs sm:text-sm text-foreground flex items-center justify-between focus:outline-hidden focus:border-mint transition-colors cursor-pointer">
                      <span className="truncate">{formData.period || "Monthly"}</span>
                      <ChevronDown className="size-4 text-muted-foreground shrink-0 opacity-70" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-(--anchor-width) min-w-[180px] bg-white dark:bg-[#18181b] border border-sage/30 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1"
                    >
                      {["Monthly", "Quarterly", "Annual", "Weekly"].map((opt) => (
                        <DropdownMenuItem
                          key={opt}
                          onClick={() => handleFieldChange("period", opt)}
                          className="cursor-pointer text-xs sm:text-sm rounded-lg px-2.5 py-1.5 focus:bg-cream dark:focus:bg-muted"
                        >
                          {opt}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Total Budget Limit (₹)
                </label>
                <input
                  type="number"
                  value={formData.totalAmount || ""}
                  onChange={(e) => handleFieldChange("totalAmount", Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm font-bold text-forest dark:text-mint focus:outline-hidden focus:border-mint"
                />
              </div>

              {/* Category Allocations Sub-List */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Category Allocations</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-forest dark:text-mint hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="size-3.5" /> Add Category
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(formData.items || []).map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-xl bg-cream/40 dark:bg-muted/30 border border-sage/20 dark:border-border"
                    >
                      <input
                        type="text"
                        value={item.category || ""}
                        onChange={(e) => handleItemChange(idx, "category", e.target.value)}
                        placeholder="Category"
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-card border border-sage/30 dark:border-border text-xs text-foreground focus:outline-hidden"
                      />
                      <div className="flex items-center gap-1 w-32">
                        <span className="text-xs text-muted-foreground font-semibold">₹</span>
                        <input
                          type="number"
                          value={item.allocatedAmount || ""}
                          onChange={(e) =>
                            handleItemChange(idx, "allocatedAmount", Number(e.target.value))
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-card border border-sage/30 dark:border-border text-xs font-bold text-foreground focus:outline-hidden"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total Allocation Sum Checker */}
                <div className="flex items-center justify-between text-xs px-2 pt-1 text-muted-foreground">
                  <span>Allocated Sum: ₹{calculateAllocatedTotal().toLocaleString("en-IN")}</span>
                  <span
                    className={cn(
                      "font-semibold",
                      calculateAllocatedTotal() > (formData.totalAmount || 0)
                        ? "text-rose-500"
                        : "text-mint font-bold"
                    )}
                  >
                    {calculateAllocatedTotal() > (formData.totalAmount || 0)
                      ? "⚠️ Exceeds total budget limit"
                      : "✓ Fits within budget limit"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2. EXPENSE ARTIFACT FORM */}
          {artifact.artifactType === "expense" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Expense Category
                  </label>
                  <input
                    type="text"
                    value={formData.category || ""}
                    onChange={(e) => handleFieldChange("category", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm text-foreground focus:outline-hidden focus:border-mint"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.amount || ""}
                    onChange={(e) => handleFieldChange("amount", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm font-bold text-forest dark:text-mint focus:outline-hidden focus:border-mint"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Vendor / Supplier
                  </label>
                  <input
                    type="text"
                    value={formData.vendor || ""}
                    onChange={(e) => handleFieldChange("vendor", e.target.value)}
                    placeholder="e.g. Mahalakshmi Traders"
                    className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm text-foreground focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Payment Method
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full h-9.5 px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-xs sm:text-sm text-foreground flex items-center justify-between focus:outline-hidden transition-colors cursor-pointer">
                      <span className="truncate">{formData.paymentMethod || "UPI"}</span>
                      <ChevronDown className="size-4 text-muted-foreground shrink-0 opacity-70" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-(--anchor-width) min-w-[180px] bg-white dark:bg-[#18181b] border border-sage/30 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1"
                    >
                      {[
                        { label: "UPI", value: "UPI" },
                        { label: "Cash", value: "CASH" },
                        { label: "Bank Transfer / NEFT", value: "BANK_TRANSFER" },
                        { label: "Cheque", value: "CHEQUE" },
                        { label: "Credit Card", value: "CREDIT_CARD" },
                        { label: "Other", value: "OTHER" },
                      ].map((item) => (
                        <DropdownMenuItem
                          key={item.value}
                          onClick={() => handleFieldChange("paymentMethod", item.value)}
                          className="cursor-pointer text-xs sm:text-sm rounded-lg px-2.5 py-1.5 focus:bg-cream dark:focus:bg-muted"
                        >
                          {item.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Description / Notes
                </label>
                <input
                  type="text"
                  value={formData.description || formData.notes || ""}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  placeholder="Optional details"
                  className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm text-foreground focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* 3. TRANSACTION ARTIFACT FORM */}
          {artifact.artifactType === "transaction" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Transaction Type
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full h-9.5 px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-xs sm:text-sm text-foreground flex items-center justify-between focus:outline-hidden transition-colors cursor-pointer">
                      <span className="truncate">
                        {formData.type === "INCOME"
                          ? "Income / Revenue"
                          : formData.type === "TRANSFER"
                          ? "Transfer"
                          : formData.type === "DEBT_PAYMENT"
                          ? "Debt Payment"
                          : formData.type === "OTHER"
                          ? "Other"
                          : "Expense"}
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground shrink-0 opacity-70" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-(--anchor-width) min-w-[180px] bg-white dark:bg-[#18181b] border border-sage/30 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1"
                    >
                      {[
                        { label: "Income / Revenue", value: "INCOME" },
                        { label: "Expense", value: "EXPENSE" },
                        { label: "Transfer", value: "TRANSFER" },
                        { label: "Debt Payment", value: "DEBT_PAYMENT" },
                        { label: "Other", value: "OTHER" },
                      ].map((item) => (
                        <DropdownMenuItem
                          key={item.value}
                          onClick={() => handleFieldChange("type", item.value)}
                          className="cursor-pointer text-xs sm:text-sm rounded-lg px-2.5 py-1.5 focus:bg-cream dark:focus:bg-muted"
                        >
                          {item.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.amount || ""}
                    onChange={(e) => handleFieldChange("amount", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm font-bold text-forest dark:text-mint focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Category &amp; Description
                </label>
                <input
                  type="text"
                  value={formData.description || ""}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  placeholder="e.g. Daily mandi grain sales receipt"
                  className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm text-foreground focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* 4. SAVINGS GOAL ARTIFACT FORM */}
          {artifact.artifactType === "saving_goal" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Goal Name
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="e.g. Cold Storage Equipment"
                  className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm text-foreground focus:outline-hidden"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Target Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.targetAmount || ""}
                    onChange={(e) => handleFieldChange("targetAmount", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm font-bold text-forest dark:text-mint focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={formData.targetDate || ""}
                    onChange={(e) => handleFieldChange("targetDate", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm text-foreground focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. DEBT ARTIFACT FORM */}
          {artifact.artifactType === "debt" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Lender Bank / Name
                  </label>
                  <input
                    type="text"
                    value={formData.lender || ""}
                    onChange={(e) => handleFieldChange("lender", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm text-foreground focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Loan Type
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full h-9.5 px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-xs sm:text-sm text-foreground flex items-center justify-between focus:outline-hidden transition-colors cursor-pointer">
                      <span className="truncate">
                        {formData.type === "TERM_LOAN"
                          ? "Term Loan"
                          : formData.type === "EQUIPMENT_FINANCING"
                          ? "Equipment Financing"
                          : formData.type === "CREDIT_CARD"
                          ? "Credit Card"
                          : formData.type === "OTHER"
                          ? "Other"
                          : "Working Capital"}
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground shrink-0 opacity-70" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-(--anchor-width) min-w-[180px] bg-white dark:bg-[#18181b] border border-sage/30 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1"
                    >
                      {[
                        { label: "Working Capital", value: "WORKING_CAPITAL" },
                        { label: "Term Loan", value: "TERM_LOAN" },
                        { label: "Equipment Financing", value: "EQUIPMENT_FINANCING" },
                        { label: "Credit Card", value: "CREDIT_CARD" },
                        { label: "Other", value: "OTHER" },
                      ].map((item) => (
                        <DropdownMenuItem
                          key={item.value}
                          onClick={() => handleFieldChange("type", item.value)}
                          className="cursor-pointer text-xs sm:text-sm rounded-lg px-2.5 py-1.5 focus:bg-cream dark:focus:bg-muted"
                        >
                          {item.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Total Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.totalAmount || ""}
                    onChange={(e) => handleFieldChange("totalAmount", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm text-foreground focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Outstanding (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.amountOutStanding || ""}
                    onChange={(e) => handleFieldChange("amountOutStanding", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm font-bold text-forest dark:text-mint focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Monthly EMI (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.emiAmount || ""}
                    onChange={(e) => handleFieldChange("emiAmount", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-cream/60 dark:bg-muted/40 border border-sage/30 dark:border-border text-sm text-foreground focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. DYNAMIC RICH MARKDOWN DOCUMENT ARTIFACT */}
          {artifact.artifactType === "document" && (
            <div className="w-full space-y-3 pt-1">
              {formData.description && (
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {formData.description}
                </p>
              )}

              <div className="w-full overflow-x-auto text-[14px] sm:text-[15px] leading-relaxed text-foreground">
                <MarkdownMessage content={formData.content || ""} variant="assistant" />
              </div>
            </div>
          )}

          {/* 6c. UNIFIED MULTI-DOMAIN SWARM DOSSIER */}
          {(artifact.artifactType === "swarm_dossier" || (Array.isArray(formData.toolCalls) && formData.toolCalls.length > 0)) && (
            <div className="w-full space-y-4">
              <SwarmTabsCard toolCalls={formData.toolCalls || artifact.data?.toolCalls} />
            </div>
          )}

          {/* 6b. DYNAMIC SWARM DOMAIN RESEARCH ARTIFACTS */}
          {artifact.artifactType !== "swarm_dossier" && !formData.toolCalls && [
            "mandi_arbitrage",
            "mandi",
            "govt_schemes",
            "schemes",
            "swot_matrix",
            "swot",
            "catchment_radar",
            "competitors",
            "emi_calculator",
            "credit",
          ].includes(artifact.artifactType) && (
            <div className="space-y-4">
              {formData.summary && (
                <div className="p-3.5 rounded-2xl bg-forest/5 dark:bg-mint/10 border border-sage/20 dark:border-mint/20 text-xs text-forest dark:text-mint leading-relaxed">
                  💡 <span className="font-semibold">Executive Summary:</span> {formData.summary}
                </div>
              )}

              {formData.content ? (
                <div className="w-full overflow-x-auto text-[14px] sm:text-[15px] leading-relaxed text-foreground pt-1">
                  <MarkdownMessage content={formData.content} variant="assistant" />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Swarm Mandi Rates Table */}
                  {(formData.rates || formData.commodities) && (
                    <div className="overflow-x-auto rounded-xl border border-sage/20 dark:border-border">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-cream/60 dark:bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-sage/20">
                          <tr>
                            <th className="py-2.5 px-3">Commodity</th>
                            <th className="py-2.5 px-3">Market Yard</th>
                            <th className="py-2.5 px-3">Modal Rate</th>
                            <th className="py-2.5 px-3">Range</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sage/15 dark:divide-border/40 font-mono">
                          {(formData.rates || formData.commodities || []).map((r: any, idx: number) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 font-bold font-sans">{r.commodity || r.name || formData.commodity}</td>
                              <td className="py-2 px-3 text-muted-foreground font-sans">{r.mandiName || r.market || "APMC Yard"}</td>
                              <td className="py-2 px-3 font-bold text-forest dark:text-mint">
                                {typeof r.modalPrice === "number" ? `₹${r.modalPrice}/qtl` : r.modalPrice || r.price || "Active"}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground text-[11px]">
                                {r.minPrice && r.maxPrice ? `₹${r.minPrice} - ₹${r.maxPrice}` : r.priceRange || "Spot"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Schemes List */}
                  {formData.schemes && Array.isArray(formData.schemes) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {formData.schemes.map((s: any, idx: number) => (
                        <div key={idx} className="p-3.5 rounded-2xl border border-sage/30 dark:border-border bg-cream/40 dark:bg-muted/30 space-y-1.5">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-xs text-forest dark:text-foreground">{s.title || s.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-mint-pale dark:bg-mint/20 text-forest dark:text-mint">{s.badge || "Subsidy"}</span>
                          </div>
                          <div className="text-xs font-mono font-bold text-forest dark:text-mint">{s.subsidy || s.amount}</div>
                          <p className="text-[11px] text-muted-foreground">{s.eligibility || s.features}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SWOT Matrix */}
                  {formData.strengths && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="border-l-2 border-emerald-500 pl-3 py-1 space-y-1">
                        <div className="font-bold text-emerald-700 dark:text-emerald-400">Strengths (ताकत)</div>
                        <ul className="space-y-0.5 text-foreground/80">{(formData.strengths || []).map((st: string, i: number) => <li key={i}>• {st}</li>)}</ul>
                      </div>
                      <div className="border-l-2 border-amber-500 pl-3 py-1 space-y-1">
                        <div className="font-bold text-amber-700 dark:text-amber-400">Weaknesses (कमजोरी)</div>
                        <ul className="space-y-0.5 text-foreground/80">{(formData.weaknesses || []).map((w: string, i: number) => <li key={i}>• {w}</li>)}</ul>
                      </div>
                      <div className="border-l-2 border-sky-500 pl-3 py-1 space-y-1">
                        <div className="font-bold text-sky-700 dark:text-sky-400">Opportunities (अवसर)</div>
                        <ul className="space-y-0.5 text-foreground/80">{(formData.opportunities || []).map((o: string, i: number) => <li key={i}>• {o}</li>)}</ul>
                      </div>
                      <div className="border-l-2 border-rose-500 pl-3 py-1 space-y-1">
                        <div className="font-bold text-rose-700 dark:text-rose-400">Threats (चुनौतियां)</div>
                        <ul className="space-y-0.5 text-foreground/80">{(formData.threats || []).map((th: string, i: number) => <li key={i}>• {th}</li>)}</ul>
                      </div>
                    </div>
                  )}

                  {/* Competitors List */}
                  {formData.competitors && Array.isArray(formData.competitors) && (
                    <div className="divide-y divide-muted/20 text-xs">
                      {formData.competitors.slice(0, 5).map((c: any, idx: number) => (
                        <div key={idx} className="py-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-foreground">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">{c.differentiator || c.vicinity || c.address}</p>
                          </div>
                          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">★ {c.rating || "4.2"} ({c.distance || "Nearby"})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Credit Breakdown */}
                  {formData.monthlyEMI && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-2xl bg-cream/50 dark:bg-muted/40 border border-sage/30 dark:border-border">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Monthly EMI</span>
                        <div className="text-xl font-bold text-forest dark:text-mint">₹{Number(formData.monthlyEMI).toLocaleString("en-IN")}</div>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-cream/50 dark:bg-muted/40 border border-sage/30 dark:border-border">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Total Interest</span>
                        <div className="text-xl font-bold text-forest dark:text-mint">₹{Number(formData.totalInterest || 0).toLocaleString("en-IN")}</div>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-cream/50 dark:bg-muted/40 border border-sage/30 dark:border-border">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Interest Rate</span>
                        <div className="text-xl font-bold text-forest dark:text-mint">{formData.annualInterestRate || 10.5}% p.a.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 7. DYNAMIC MULTI-SECTION FORM ARTIFACT (OFFICIAL PAPER & CLASSIC VIEWS) */}
          {artifact.artifactType === "form" && (
            <div>
              {formViewMode === "paper" ? (
                /* OFFICIAL PAPER VIEW (Matching Authentic Government / Institutional Registration Slips) */
                <div
                  className="p-4 sm:p-6 rounded-2xl border border-sage/40 dark:border-zinc-800 bg-white dark:bg-[#10141d] shadow-xs space-y-4 print:border-none print:shadow-none print:p-0"
                  style={{
                    backgroundColor: formData.theme?.paperBg || undefined,
                    color: formData.theme?.textColor || undefined,
                  }}
                >
                  {/* Header Banner */}
                  <div className="text-center pb-3 border-b-2 border-sage/40 dark:border-zinc-800">
                    {formData.documentBadge && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-forest dark:text-mint block mb-1">
                        {formData.documentBadge}
                      </span>
                    )}
                    <h2 className="font-serif font-bold text-base sm:text-xl text-forest dark:text-foreground">
                      {artifact.title || "आधिकारिक आवेदन प्रपत्र / Official Form"}
                    </h2>
                    {formData.description && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-xl mx-auto">
                        {formData.description}
                      </p>
                    )}
                  </div>

                  {/* Sections */}
                  {(formData.sections || []).map((section: any, sIdx: number) => {
                    const sectionRows =
                      section.rows && section.rows.length > 0
                        ? section.rows
                        : chunkFieldsIntoRows(section.fields || []);

                    const cleanSectionTitle = (section.title || "")
                      .replace(/^[#*—\-\|\s\[>~]+/, "")
                      .replace(/[#*—\-\|\s\]>~]+$/, "")
                      .trim();

                    return (
                      <div key={sIdx} className={cn("space-y-3", sIdx > 0 && "pt-2")}>
                        {/* Clean official section header: single underline strictly below with comfortable gap */}
                        {cleanSectionTitle && (
                          <div className="pb-2 border-b border-sage/30 dark:border-zinc-800">
                            <div className="flex items-center gap-2.5">
                              <span className="size-2 rounded-full bg-forest dark:bg-mint shrink-0" />
                              <h3 className="font-serif font-bold text-xs sm:text-sm text-forest dark:text-mint tracking-wide">
                                {cleanSectionTitle}
                              </h3>
                              {section.description && (
                                <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline-block">
                                  {section.description}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Section row grid with optional right-side passport photo box */}
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                          {/* Main Form Fields Grid */}
                          <div className="flex-1 min-w-0 border border-sage/40 dark:border-border/80 rounded-lg overflow-hidden divide-y divide-sage/30 dark:divide-border/60 bg-white dark:bg-card">
                            {sectionRows.map((row: any, rIdx: number) => {
                              const fields = row.fields || [];
                              const fieldCount = fields.length;

                              if (fieldCount === 1) {
                                const f = fields[0];
                                return (
                                  <div
                                    key={f.id || rIdx}
                                    className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-sage/30 dark:divide-border/60"
                                  >
                                    <div className="sm:col-span-1 bg-cream/50 dark:bg-muted/30 px-3 py-2 text-xs font-semibold text-forest dark:text-mint flex items-center">
                                      <span>{f.label || f.id}</span>
                                      {f.required && <span className="text-rose-500 ml-1 font-bold">*</span>}
                                    </div>
                                    <div className="sm:col-span-3 bg-white dark:bg-zinc-900/40 px-3 py-2 text-xs text-foreground flex items-center justify-between group cursor-pointer hover:bg-mint-pale/15 transition-colors">
                                      {renderPaperFieldValue(f)}
                                    </div>
                                  </div>
                                );
                              }

                              if (fieldCount === 2) {
                                const [f1, f2] = fields;
                                return (
                                  <div
                                    key={rIdx}
                                    className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-sage/30 dark:divide-border/60"
                                  >
                                    {/* Field 1 */}
                                    <div className="sm:col-span-1 bg-cream/50 dark:bg-muted/30 px-3 py-2 text-xs font-semibold text-forest dark:text-mint flex items-center">
                                      <span className="truncate">{f1.label || f1.id}</span>
                                      {f1.required && <span className="text-rose-500 ml-1 font-bold">*</span>}
                                    </div>
                                    <div className="sm:col-span-1 bg-white dark:bg-zinc-900/40 px-3 py-2 text-xs text-foreground flex items-center justify-between group cursor-pointer hover:bg-mint-pale/15 transition-colors">
                                      {renderPaperFieldValue(f1)}
                                    </div>

                                    {/* Field 2 */}
                                    <div className="sm:col-span-1 bg-cream/50 dark:bg-muted/30 px-3 py-2 text-xs font-semibold text-forest dark:text-mint flex items-center">
                                      <span className="truncate">{f2.label || f2.id}</span>
                                      {f2.required && <span className="text-rose-500 ml-1 font-bold">*</span>}
                                    </div>
                                    <div className="sm:col-span-1 bg-white dark:bg-zinc-900/40 px-3 py-2 text-xs text-foreground flex items-center justify-between group cursor-pointer hover:bg-mint-pale/15 transition-colors">
                                      {renderPaperFieldValue(f2)}
                                    </div>
                                  </div>
                                );
                              }

                              // 3 or more fields per row
                              return (
                                <div
                                  key={rIdx}
                                  className="grid grid-cols-1 sm:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-sage/30 dark:divide-border/60"
                                >
                                  {fields.map((f: any, fIdx: number) => (
                                    <React.Fragment key={f.id || fIdx}>
                                      <div className="sm:col-span-1 bg-cream/50 dark:bg-muted/30 px-2.5 py-2 text-[11px] font-semibold text-forest dark:text-mint flex items-center">
                                        <span className="truncate">{f.label || f.id}</span>
                                        {f.required && <span className="text-rose-500 ml-0.5 font-bold">*</span>}
                                      </div>
                                      <div className="sm:col-span-1 bg-white dark:bg-zinc-900/40 px-2.5 py-2 text-xs text-foreground flex items-center justify-between group cursor-pointer hover:bg-mint-pale/15 transition-colors">
                                        {renderPaperFieldValue(f)}
                                      </div>
                                    </React.Fragment>
                                  ))}
                                </div>
                              );
                            })}
                          </div>

                          {/* Optional Passport Photo Box */}
                          {section.photoBox && (
                            <div className="w-full sm:w-32 border border-sage/40 dark:border-border rounded-lg bg-cream/20 dark:bg-muted/20 flex flex-col items-center justify-center p-3 text-center shrink-0">
                              {section.photoBox.url ? (
                                <img
                                  src={section.photoBox.url}
                                  alt={section.photoBox.label || "Passport Photo"}
                                  className="w-full h-auto max-h-36 object-cover rounded border border-sage/30 shadow-2xs"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-2 py-4 text-muted-foreground">
                                  <div className="w-16 h-20 border-2 border-dashed border-sage/50 dark:border-border rounded flex items-center justify-center bg-white/70 dark:bg-black/30">
                                    <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase text-center px-1">
                                      PHOTO
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-medium leading-tight text-foreground/80">
                                    {section.photoBox.label || "Passport Photo / फ़ोटो"}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Embedded Sub-Table (e.g. Qualification / Marksheet Table) */}
                        {section.table && section.table.headers && section.table.headers.length > 0 && (
                          <div className="overflow-x-auto border border-sage/40 dark:border-border rounded-lg mt-3">
                            <table className="w-full text-xs text-left border-collapse">
                              <thead className="bg-cream/60 dark:bg-muted/50 border-b border-sage/40 dark:border-border text-forest dark:text-mint font-bold">
                                <tr>
                                  {section.table.headers.map((h: string, hIdx: number) => (
                                    <th
                                      key={hIdx}
                                      className="px-3 py-2 border-r last:border-r-0 border-sage/30 dark:border-border whitespace-nowrap"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-sage/30 dark:divide-border bg-white dark:bg-card">
                                {(section.table.rows || []).map((tRow: string[], trIdx: number) => (
                                  <tr key={trIdx} className="hover:bg-cream/20 dark:hover:bg-muted/20 transition-colors">
                                    {tRow.map((cell: string, tcIdx: number) => (
                                      <td
                                        key={tcIdx}
                                        className="px-3 py-2 border-r last:border-r-0 border-sage/30 dark:border-border font-medium text-foreground whitespace-nowrap"
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Official Declaration & Signature Footer */}
                  <div className="pt-4 mt-4 border-t border-sage/30 dark:border-border flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-xs text-muted-foreground">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">घोषणा / Declaration:</p>
                      <p className="text-[11px] leading-relaxed max-w-md">
                        प्रमाणित किया जाता है कि उपरोक्त विवरण मेरे द्वारा सत्यापित है तथा सत्य है।
                        <br />
                        Certified that the particulars given above are true, accurate, and verified.
                      </p>
                    </div>
                    <div className="w-40 text-center border-t border-dashed border-sage/60 dark:border-border pt-2 self-end">
                      <span className="text-[10px] font-semibold text-foreground/80 block">
                        हस्ताक्षर / Candidate Signature
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* CLASSIC INPUTS VIEW (Interactive form controls with full rows resolution) */
                <div className="space-y-5">
                  {formData.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed -mt-1">
                      {formData.description}
                    </p>
                  )}

                  {(formData.sections || []).map((section: any, sIdx: number) => {
                    const cleanSectionTitle = (section.title || "")
                      .replace(/^[#*—\-\|\s\[>~]+/, "")
                      .replace(/[#*—\-\|\s\]>~]+$/, "")
                      .trim();
                    // Resolve rows dynamically so 1-field rows and single-column sections span full width
                    const sectionRows: Array<{ fields: any[] }> =
                      section.rows && section.rows.length > 0
                        ? section.rows
                        : section.columns === 1 || (section.fields && section.fields.length === 1)
                        ? (section.fields || []).map((f: any) => ({ fields: [f] }))
                        : chunkFieldsIntoRows(section.fields || []);

                    return (
                      <div
                        key={sIdx}
                        className="p-4 sm:p-5 rounded-2xl bg-cream/40 dark:bg-[#141822] border border-sage/30 dark:border-zinc-800 space-y-3.5 shadow-xs"
                      >
                        {cleanSectionTitle && (
                          <div className="border-b border-sage/20 dark:border-zinc-800 pb-2 flex items-center gap-2">
                            <span className="size-2 rounded-full bg-forest dark:bg-mint shrink-0" />
                            <h3 className="font-serif font-bold text-sm sm:text-base text-forest dark:text-mint">
                              {cleanSectionTitle}
                            </h3>
                            {section.description && (
                              <p className="text-xs text-muted-foreground ml-auto hidden sm:block">
                                {section.description}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="space-y-3.5">
                          {sectionRows.map((row: any, rIdx: number) => {
                            const rFields = row.fields || [];
                            const count = rFields.length;
                            const gridCls =
                              count === 1
                                ? "grid grid-cols-1"
                                : count === 2
                                ? "grid grid-cols-1 sm:grid-cols-2 gap-3.5"
                                : "grid grid-cols-1 sm:grid-cols-3 gap-3.5";

                            return (
                              <div key={rIdx} className={gridCls}>
                                {rFields.map((field: any, fIdx: number) => {
                                  const fieldKey = field?.id ? String(field.id) : `f-${rIdx}-${fIdx}`;
                                  const fieldVal =
                                    formData.values?.[field.id] !== undefined
                                      ? formData.values[field.id]
                                      : (field.defaultValue !== undefined ? field.defaultValue : "");

                                  if (field.type === "checkbox") {
                                    return (
                                      <div key={fieldKey} className="w-full space-y-1">
                                        <label className="flex items-start sm:items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-sage/30 dark:border-zinc-800 cursor-pointer select-none hover:border-mint transition-colors w-full shadow-2xs">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(fieldVal)}
                                            onChange={(e) =>
                                              handleDynamicFieldChange(field.id, e.target.checked)
                                            }
                                            className="size-4 rounded-md accent-forest dark:accent-mint cursor-pointer mt-0.5 sm:mt-0 shrink-0"
                                          />
                                          <span className="text-xs sm:text-sm text-foreground leading-relaxed">
                                            {field.label || field.placeholder}
                                            {field.required && (
                                              <span className="text-rose-500 ml-1 font-bold">*</span>
                                            )}
                                          </span>
                                        </label>
                                        {field.helpText && (
                                          <p className="text-[11px] text-muted-foreground ml-1">
                                            {field.helpText}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={fieldKey} className="space-y-1.5 w-full">
                                      <label className="text-xs font-semibold text-foreground/90 block">
                                        {field.label || field.id}
                                        {field.required && (
                                          <span className="text-rose-500 ml-1 font-bold">*</span>
                                        )}
                                      </label>

                                      {field.type === "select" ? (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger className="w-full h-9.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-sage/30 dark:border-zinc-800 text-xs sm:text-sm text-foreground flex items-center justify-between focus:outline-hidden focus:border-mint transition-colors cursor-pointer">
                                            <span className="truncate">
                                              {fieldVal || field.placeholder || "Select option"}
                                            </span>
                                            <ChevronDown className="size-4 text-muted-foreground shrink-0 opacity-70" />
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent
                                            align="start"
                                            className="w-(--anchor-width) min-w-[180px] bg-white dark:bg-[#18181b] border border-sage/30 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1"
                                          >
                                            {(field.options || []).map((opt: string, optIdx: number) => (
                                              <DropdownMenuItem
                                                key={`${fieldKey}-opt-${optIdx}-${opt}`}
                                                onClick={() =>
                                                  handleDynamicFieldChange(field.id, opt)
                                                }
                                                className="cursor-pointer text-xs sm:text-sm rounded-lg px-2.5 py-1.5 focus:bg-cream dark:focus:bg-muted"
                                              >
                                                {opt}
                                              </DropdownMenuItem>
                                            ))}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      ) : field.type === "textarea" ? (
                                        <textarea
                                          rows={3}
                                          value={fieldVal || ""}
                                          ref={(el) => {
                                            if (el) {
                                              el.style.height = "auto";
                                              el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
                                            }
                                          }}
                                          onChange={(e) => {
                                            handleDynamicFieldChange(field.id, e.target.value);
                                            e.target.style.height = "auto";
                                            e.target.style.height = `${Math.max(e.target.scrollHeight, 72)}px`;
                                          }}
                                          placeholder={field.placeholder || ""}
                                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-sage/30 dark:border-zinc-800 text-xs sm:text-sm text-foreground focus:outline-hidden focus:border-mint resize-none overflow-hidden break-words whitespace-pre-wrap leading-relaxed"
                                        />
                                      ) : field.type === "date" ? (
                                        <input
                                          type="date"
                                          value={fieldVal || ""}
                                          onChange={(e) =>
                                            handleDynamicFieldChange(field.id, e.target.value)
                                          }
                                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-sage/30 dark:border-zinc-800 text-xs sm:text-sm text-foreground focus:outline-hidden focus:border-mint"
                                        />
                                      ) : field.type === "number" ? (
                                        <input
                                          type="number"
                                          value={fieldVal}
                                          onChange={(e) =>
                                            handleDynamicFieldChange(
                                              field.id,
                                              e.target.value === "" ? "" : Number(e.target.value)
                                            )
                                          }
                                          placeholder={field.placeholder || "0"}
                                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-sage/30 dark:border-zinc-800 text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus:border-mint"
                                        />
                                      ) : (
                                        <textarea
                                          rows={1}
                                          value={fieldVal || ""}
                                          ref={(el) => {
                                            if (el) {
                                              el.style.height = "auto";
                                              el.style.height = `${Math.min(Math.max(el.scrollHeight, 38), 160)}px`;
                                            }
                                          }}
                                          onChange={(e) => {
                                            handleDynamicFieldChange(field.id, e.target.value);
                                            e.target.style.height = "auto";
                                            e.target.style.height = `${Math.min(Math.max(e.target.scrollHeight, 38), 160)}px`;
                                          }}
                                          placeholder={field.placeholder || ""}
                                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-sage/30 dark:border-zinc-800 text-xs sm:text-sm text-foreground focus:outline-hidden focus:border-mint resize-none overflow-hidden break-words whitespace-pre-wrap leading-relaxed"
                                        />
                                      )}

                                      {field.helpText && (
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                          {field.helpText}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>

                        {/* Embedded Sub-Table in Classic View */}
                        {section.table && section.table.headers && section.table.headers.length > 0 && (
                          <div className="overflow-x-auto border border-sage/30 dark:border-zinc-800 rounded-xl mt-3">
                            <table className="w-full text-xs text-left border-collapse">
                              <thead className="bg-cream/60 dark:bg-zinc-900 border-b border-sage/30 dark:border-zinc-800 text-forest dark:text-mint font-bold">
                                <tr>
                                  {section.table.headers.map((h: string, hIdx: number) => (
                                    <th
                                      key={hIdx}
                                      className="px-3 py-2 border-r last:border-r-0 border-sage/30 dark:border-zinc-800 whitespace-nowrap"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-sage/20 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                                {(section.table.rows || []).map((tRow: string[], trIdx: number) => (
                                  <tr key={trIdx} className="hover:bg-cream/20 dark:hover:bg-zinc-900/40 transition-colors">
                                    {tRow.map((cell: string, tcIdx: number) => (
                                      <td
                                        key={tcIdx}
                                        className="px-3 py-2 border-r last:border-r-0 border-sage/30 dark:border-zinc-800 font-medium text-foreground whitespace-nowrap"
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 6. DELETE RECORD CONFIRMATION */}
          {artifact.artifactType === "delete_record" && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-center space-y-2">
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                Are you sure you want to permanently delete this {formData.entityType}?
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {formData.entityName} (ID: {formData.entityId})
              </p>
            </div>
          )}

          {/* 7. INTERACTIVE VISUAL CHART ARTIFACT */}
          {artifact.artifactType === "chart" && (
            <div className="space-y-4">
              {/* Chart Type Selector Bar */}
              <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-cream/70 dark:bg-muted/40 border border-sage/30 dark:border-border">
                <span className="text-xs font-semibold text-muted-foreground px-2">Visualization Type:</span>
                <div className="flex items-center gap-1">
                  {[
                    { type: "bar" as const, label: "Bar", icon: BarChart3 },
                    { type: "line" as const, label: "Line", icon: LineIcon },
                    { type: "area" as const, label: "Area", icon: Activity },
                    { type: "pie" as const, label: "Pie", icon: PieIcon },
                  ].map((tab) => (
                    <button
                      key={tab.type}
                      type="button"
                      onClick={() => setActiveChartType(tab.type)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                        activeChartType === tab.type
                          ? "bg-forest dark:bg-mint text-white dark:text-black shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-card"
                      )}
                    >
                      <tab.icon className="size-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recharts Container */}
              <div className="h-[340px] sm:h-[400px] md:h-[440px] w-full p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#18181b]/90 border border-sage/30 dark:border-border">
                <ResponsiveContainer width="100%" height="100%">
                  {activeChartType === "bar" ? (
                    <BarChart data={formData.data || []} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey={formData.xAxisKey || "name"} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(18, 19, 22, 0.95)",
                          borderRadius: "12px",
                          border: "1px solid rgba(74, 222, 128, 0.2)",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                      {(formData.series || [{ dataKey: "value", color: "#4ADE80" }]).map((s: any, idx: number) => {
                        const barColor = typeof s.color === "string" && s.color !== "true" && s.color !== "false" ? s.color : "#4ADE80";
                        return (
                          <Bar
                            isAnimationActive={false}
                            key={s.dataKey || idx}
                            dataKey={s.dataKey}
                            name={s.name || s.dataKey}
                            fill={barColor}
                            radius={[6, 6, 0, 0]}
                          />
                        );
                      })}
                    </BarChart>
                  ) : activeChartType === "line" ? (
                    <LineChart data={formData.data || []} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey={formData.xAxisKey || "name"} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(18, 19, 22, 0.95)",
                          borderRadius: "12px",
                          border: "1px solid rgba(74, 222, 128, 0.2)",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                      {(formData.series || [{ dataKey: "value", color: "#4ADE80" }]).map((s: any, idx: number) => {
                        const lineColor = typeof s.color === "string" && s.color !== "true" && s.color !== "false" ? s.color : "#4ADE80";
                        return (
                          <Line
                            isAnimationActive={false}
                            key={s.dataKey || idx}
                            type="monotone"
                            dataKey={s.dataKey}
                            name={s.name || s.dataKey}
                            stroke={lineColor}
                            strokeWidth={2.5}
                            dot={{ r: 4 }}
                          />
                        );
                      })}
                    </LineChart>
                  ) : activeChartType === "area" ? (
                    <AreaChart data={formData.data || []}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey={formData.xAxisKey || "name"} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(18, 19, 22, 0.95)",
                          borderRadius: "12px",
                          border: "1px solid rgba(74, 222, 128, 0.2)",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      {(formData.series || [{ dataKey: "value", color: "#4ADE80" }]).map((s: any, idx: number) => {
                        const areaColor = typeof s.color === "string" && s.color !== "true" && s.color !== "false" ? s.color : "#4ADE80";
                        return (
                          <Area
                            isAnimationActive={false}
                            key={s.dataKey || idx}
                            type="monotone"
                            dataKey={s.dataKey}
                            name={s.name || s.dataKey}
                            stroke={areaColor}
                            fill={areaColor}
                            fillOpacity={0.2}
                          />
                        );
                      })}
                    </AreaChart>
                  ) : (
                    <PieChart>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(18, 19, 22, 0.95)",
                          borderRadius: "12px",
                          border: "1px solid rgba(74, 222, 128, 0.2)",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Pie
                        isAnimationActive={false}
                        data={formData.data || []}
                        dataKey={(formData.series && formData.series[0]?.dataKey) || "value"}
                        nameKey={formData.xAxisKey || "name"}
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        label={({ name, percent }: any) => `${name || ""} ${(((percent || 0) as number) * 100).toFixed(0)}%`}
                      >
                        {(formData.data || []).map((_: any, index: number) => {
                          const colors = ["#4ADE80", "#1B4332", "#D98E2A", "#EAB308", "#10B981", "#3B82F6", "#8B5CF6"];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Data points table preview */}
              {Array.isArray(formData.data) && formData.data.length > 0 && (
                <div className="rounded-2xl border border-sage/30 dark:border-border overflow-hidden">
                  <div className="px-3.5 py-2 bg-cream/70 dark:bg-muted/40 text-xs font-bold text-forest dark:text-mint flex items-center justify-between">
                    <span>Dataset Points ({formData.data.length})</span>
                    <span className="text-[11px] text-muted-foreground font-normal">X-Axis: {formData.xAxisKey || "name"}</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-sage/20 dark:divide-border/40">
                    {formData.data.map((row: any, rIdx: number) => (
                      <div key={rIdx} className="px-3.5 py-1.5 text-xs flex items-center justify-between text-muted-foreground">
                        <span className="font-semibold text-foreground">{row[formData.xAxisKey || "name"] || `Point ${rIdx + 1}`}</span>
                        <div className="flex items-center gap-3 font-mono">
                          {(formData.series || []).map((s: any, sIdx: number) => (
                            <span key={sIdx} className="text-forest dark:text-mint">
                              {s.name || s.dataKey}: {row[s.dataKey]}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}


        </div>

        {/* ── Bottom Voice Interaction Bar (Only if Voice Agent Mode is active) ── */}
        {isVoiceMode && (
          <div className="p-3 rounded-2xl bg-mint-pale/50 dark:bg-mint/10 border border-mint/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AudioLines className="size-4 text-mint animate-pulse" />
              <span className="text-xs text-forest dark:text-mint font-semibold">
                Voice Feedback Active: Speak modifications or approve
              </span>
            </div>
            <button
              type="button"
              onMouseDown={onVoiceHoldStart}
              onMouseUp={onVoiceHoldEnd}
              onTouchStart={onVoiceHoldStart}
              onTouchEnd={onVoiceHoldEnd}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer select-none",
                isHoldingToSpeak
                  ? "bg-mint text-black shadow-md scale-105"
                  : "bg-forest dark:bg-mint text-white dark:text-black hover:opacity-90"
              )}
            >
              <Mic className="size-3.5" />
              <span>{isHoldingToSpeak ? "Listening..." : "Hold to Speak"}</span>
            </button>
          </div>
        )}

        {/* ── Dialog Action Footer ── */}
        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-cream dark:hover:bg-muted transition-colors cursor-pointer"
          >
            {["chart", "document", "mandi_arbitrage", "mandi", "govt_schemes", "schemes", "swot_matrix", "swot", "catchment_radar", "competitors", "emi_calculator", "credit", "swarm_dossier"].includes(artifact.artifactType) ? "Close" : "Discard"}
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isSubmitting}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md",
              artifact.artifactType === "delete_record"
                ? "bg-rose-500 hover:bg-rose-600 text-white"
                : "bg-forest dark:bg-mint hover:bg-forest-deep dark:hover:bg-mint-light text-white dark:text-black"
            )}
          >
            <Check className="size-4 stroke-[2.5]" />
            <span>
              {["chart", "document", "mandi_arbitrage", "mandi", "govt_schemes", "schemes", "swot_matrix", "swot", "catchment_radar", "competitors", "emi_calculator", "credit", "swarm_dossier"].includes(artifact.artifactType)
                ? "Done"
                : isSubmitting
                  ? "Saving..."
                  : formData.submitLabel || "Approve & Save"}
            </span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
