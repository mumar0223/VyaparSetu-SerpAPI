"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Globe,
  Terminal,
  Sprout,
  Landmark,
  FolderGit2,
  FileText,
  Image as ImageIcon,
  Camera,
  Loader2,
  CreditCard,
  Layers,
  Compass,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallItem } from "./types";

interface ThinkingAccordionProps {
  isStreaming?: boolean;
  toolCalls?: ToolCallItem[];
  completedDurationSeconds?: number;
}

export const ThinkingAccordion = React.memo(function ThinkingAccordion({
  isStreaming = false,
  toolCalls = [],
  completedDurationSeconds,
}: ThinkingAccordionProps) {
  const [seconds, setSeconds] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const lastDurationRef = useRef(
    typeof completedDurationSeconds === "number" && completedDurationSeconds > 0
      ? completedDurationSeconds
      : 0,
  );

  useEffect(() => {
    if (!isStreaming) return;

    const start = Date.now() - (lastDurationRef.current > 0 ? lastDurationRef.current * 1000 : 0);
    const interval = setInterval(() => {
      const elapsed = Math.max(1, Math.round((Date.now() - start) / 1000));
      lastDurationRef.current = elapsed;
      setSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const hasTools = Boolean(toolCalls && toolCalls.length > 0);

  const resolvedDuration =
    typeof completedDurationSeconds === "number" && completedDurationSeconds > 0
      ? completedDurationSeconds
      : lastDurationRef.current > 0
        ? lastDurationRef.current
        : seconds > 0
          ? seconds
          : undefined;

  // If streaming and NO tools have been called yet: render thinking shimmer
  if (isStreaming && !hasTools) {
    const formattedDuration = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return (
      <div className="mb-2.5 select-none overflow-visible pt-0.5 pb-1.5">
        <span className="thinking-text text-[14.5px] font-medium text-forest dark:text-mint leading-relaxed overflow-visible inline-block">
          Thinking... {seconds > 0 ? `(${formattedDuration}s)` : ""}
        </span>
      </div>
    );
  }

  // If not streaming and no tools were called: do not render any accordion
  if (!isStreaming && !hasTools) {
    return null;
  }
  const formattedDuration = seconds < 10 ? `0${seconds}` : `${seconds}`;

  const headerText = isStreaming
    ? `Thinking... ${seconds > 0 ? `(${formattedDuration}s)` : ""}`
    : resolvedDuration !== undefined
      ? `Thought for ${resolvedDuration}s`
      : "Thought";

  return (
    <div className="mb-3 select-none font-sans overflow-visible">
      {/* Borderless Header Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 text-[14.5px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer pt-0.5 pb-1.5 group overflow-visible"
      >
        <span
          className={cn(
            "text-[14.5px] font-normal leading-relaxed overflow-visible inline-block",
            isStreaming
              ? "thinking-text font-medium text-forest dark:text-mint"
              : "text-muted-foreground group-hover:text-foreground"
          )}
        >
          {headerText}
        </span>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground group-hover:text-foreground transition-transform duration-200 ease-out shrink-0",
            isOpen ? "rotate-0 text-foreground" : "-rotate-90"
          )}
        />
      </button>

      {/* Clean Dynamic Tool Actions List */}
      {isOpen && (
        <div className="mt-2 pl-0.5 space-y-2 text-[14px] text-foreground/90 animate-in fade-in-50 duration-150">
          {toolCalls.map((tc, idx) => {
            const icon = renderToolIcon(tc.icon || tc.toolName);
            const summary = tc.summary || `Executed ${tc.toolName}`;
            const isCalling = tc.status === "calling";

            return (
              <div key={idx} className="flex items-center gap-2.5 py-0.5">
                <span className="shrink-0">
                  {isCalling ? (
                    <Loader2 className="size-4 text-muted-foreground animate-spin" />
                  ) : (
                    icon
                  )}
                </span>
                <span className="text-[14px] font-normal text-foreground/90 leading-relaxed">
                  {summary}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

function renderToolIcon(iconType?: string) {
  const t = (iconType || "").toLowerCase();

  if (t === "globe" || t.includes("web") || t.includes("search")) {
    return <Globe className="size-4 text-muted-foreground" />;
  }
  if (t === "github" || t.includes("git")) {
    return <FolderGit2 className="size-4 text-muted-foreground" />;
  }
  if (
    t === "sprout" ||
    t.includes("mandi") ||
    t.includes("rate") ||
    t.includes("bar-chart") ||
    t.includes("chart")
  ) {
    return <Sprout className="size-4 text-mint" />;
  }
  if (t === "landmark" || t.includes("scheme") || t.includes("loan") || t.includes("mudra")) {
    return <Landmark className="size-4 text-orange" />;
  }
  if (t === "calculator" || t.includes("credit") || t.includes("emi")) {
    return <CreditCard className="size-4 text-emerald-500" />;
  }
  if (t === "layers" || t.includes("swot")) {
    return <Layers className="size-4 text-purple-500" />;
  }
  if (t === "compass" || t.includes("radar") || t.includes("competitor")) {
    return <Store className="size-4 text-blue-500" />;
  }
  if (t === "camera" || t.includes("camera") || t.includes("captured") || t.includes("capturedocument")) {
    return <Camera className="size-4 text-emerald-500" />;
  }
  if (t === "image" || t.includes("img") || t.includes("photo")) {
    return <ImageIcon className="size-4 text-sky-500" />;
  }
  if (t === "document" || t.includes("doc") || t.includes("file") || t.includes("pdf")) {
    return <FileText className="size-4 text-sky-500" />;
  }
  if (t === "code" || t.includes("clone")) {
    return <Terminal className="size-4 text-muted-foreground" />;
  }

  return <Terminal className="size-4 text-muted-foreground" />;
}
