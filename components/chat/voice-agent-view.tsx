"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  MessageSquareText,
  Radio,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  PieChart,
  BarChart3,
  IndianRupee,
  Layers,
  Landmark,
  AlertTriangle,
  WifiOff,
  ShieldAlert,
  Target,
  ClipboardList,
  Search,
  CheckCircle2,
  Camera,
  VideoOff,
  SwitchCamera,
  X,
  Plus,
  FileText,
  Coins,
  Store,
  CreditCard,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupportedLanguageCode } from "@/lib/agent/chat-config";
import type { ArtifactPayload } from "./artifact-modal";
import type {
  BackgroundScreenTaskState,
  SubAgentTaskItem,
  CompletedTaskItem,
  VoiceAttachedDocument,
} from "./use-live-agent";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type VoiceAgentStatus =
  | "initializing"
  | "connecting"
  | "ready"
  | "listening"
  | "speaking"
  | "thinking"
  | "disconnected"
  | "error";

interface VoiceAgentViewProps {
  status?: VoiceAgentStatus;
  isMuted?: boolean;
  micVolume?: number;
  isUserSpeaking?: boolean;
  isHoldingToSpeak?: boolean;
  isEnding?: boolean;
  errorMessage?: string | null;
  selectedLanguage?: SupportedLanguageCode;
  onSelectLanguage?: (lang: SupportedLanguageCode) => void;
  onToggleMute?: () => void;
  onStartSpeaking?: () => void;
  onStopSpeaking?: () => void;
  onEndSession: () => void;
  onRetry?: () => void;
  liveTranscript?: string;
  assistantTranscript?: string;
  activeToolName?: string | null;
  activeArtifact?: ArtifactPayload | null;
  backgroundTask?: BackgroundScreenTaskState;
  activeTasks?: SubAgentTaskItem[];
  sessionCompletedTasks?: CompletedTaskItem[];
  onOpenArtifact?: (artifact: ArtifactPayload) => void;
  isCameraActive?: boolean;
  cameraFacingMode?: "environment" | "user";
  cameraError?: "denied" | null;
  onClearCameraError?: () => void;
  onToggleCamera?: () => void;
  onSwitchCameraFacing?: () => void;
  onAttachCameraVideoElement?: (el: HTMLVideoElement | null) => void;
  isSidebarOpen?: boolean;
  attachedDocuments?: VoiceAttachedDocument[];
  attachedDocument?: VoiceAttachedDocument | null;
  onAttachDocuments?: (files: FileList | File[]) => void;
  onAttachDocument?: (file: File) => void;
  onRemoveAttachedDocument?: (id?: string) => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanSummaryPreview(text?: string): string {
  if (!text) return "";
  return text.replace(/[*_#`~]/g, "").trim();
}

// ── Memoized Live Transcript Card (Light, Dark & Camera Feed Optimized) ──
const LiveTranscriptView = React.memo(function LiveTranscriptView({
  liveTranscript,
  isHoldingToSpeak,
  isCameraActive = false,
}: {
  liveTranscript: string;
  isHoldingToSpeak: boolean;
  isCameraActive?: boolean;
}) {
  if (!liveTranscript) return null;
  return (
    <div
      className={cn(
        "w-full rounded-2xl p-2.5 sm:p-3.5 shrink-0 text-left shadow-md backdrop-blur-md border transition-all",
        isCameraActive
          ? "border-emerald-500/50 bg-black/75 text-white shadow-xl backdrop-blur-xl"
          : "border-emerald-300/80 dark:border-emerald-800/40 bg-white/95 dark:bg-emerald-950/30 dark:shadow-lg",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between pb-1 sm:pb-1.5 mb-1 sm:mb-1.5 border-b shrink-0",
          isCameraActive
            ? "border-emerald-500/30"
            : "border-emerald-200/60 dark:border-emerald-800/30",
        )}
      >
        <div className="flex items-center gap-1.5">
          <div className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
          <span
            className={cn(
              "text-[10px] font-bold tracking-wider uppercase",
              isCameraActive
                ? "text-emerald-300"
                : "text-emerald-700 dark:text-emerald-300",
            )}
          >
            You {isHoldingToSpeak ? "· speaking" : "· transcript"}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "max-h-[50px] sm:max-h-[70px] overflow-y-auto pr-1 text-xs md:text-sm font-medium leading-relaxed",
          isCameraActive
            ? "text-white"
            : "text-emerald-950 dark:text-emerald-200",
        )}
      >
        {liveTranscript}
      </div>
    </div>
  );
});

// ── Memoized Assistant Caption Card (Light, Dark & Camera Feed Optimized) ──
const AssistantCaptionView = React.memo(function AssistantCaptionView({
  assistantTranscript,
  isSpeaking,
  isCameraActive = false,
}: {
  assistantTranscript: string;
  isSpeaking: boolean;
  isCameraActive?: boolean;
}) {
  if (!assistantTranscript) return null;
  return (
    <div
      className={cn(
        "w-full rounded-2xl p-2.5 sm:p-3.5 text-left shadow-lg backdrop-blur-md border transition-all",
        isCameraActive
          ? "border-sky-500/50 bg-black/75 text-white shadow-xl backdrop-blur-xl"
          : "border-sky-200 dark:border-sky-800/40 bg-white/95 dark:bg-sky-950/40 dark:shadow-xl",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between pb-1 sm:pb-1.5 mb-1 sm:mb-1.5 border-b shrink-0",
          isCameraActive
            ? "border-sky-500/30"
            : "border-sky-200/60 dark:border-sky-800/40",
        )}
      >
        <div className="flex items-center gap-1.5">
          <div className="size-2 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse" />
          <span
            className={cn(
              "text-[10.5px] font-bold tracking-wider uppercase",
              isCameraActive
                ? "text-sky-300"
                : "text-sky-700 dark:text-sky-300",
            )}
          >
            VyaparSetu {isSpeaking ? "· speaking" : "· response"}
          </span>
        </div>
        <span
          className={cn(
            "text-[9.5px] font-semibold uppercase px-2 py-0.5 rounded-full border",
            isCameraActive
              ? "text-sky-200 bg-sky-950/70 border-sky-600/40"
              : "text-sky-700 dark:text-sky-300/90 bg-sky-100 dark:bg-sky-900/50 border-sky-200 dark:border-sky-700/40",
          )}
        >
          Live
        </span>
      </div>

      <div
        className={cn(
          "max-h-[65px] sm:max-h-[120px] md:max-h-[150px] overflow-y-auto pr-1 text-xs md:text-[13.5px] font-normal leading-relaxed max-w-none",
          isCameraActive
            ? "text-zinc-100 prose prose-invert prose-p:my-0.5"
            : "text-zinc-800 dark:text-zinc-100 prose prose-zinc dark:prose-invert prose-p:my-0.5",
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {assistantTranscript}
        </ReactMarkdown>
      </div>
    </div>
  );
});

// ── Unified Voice Orb Component (Preserving Exact Visual Styles) ──
const VoiceOrbView = React.memo(function VoiceOrbView({
  size = "large",
  status,
  isHoldingToSpeak,
  isError,
  errorType,
  isInitializing,
  orbLabel,
}: {
  size?: "compact" | "large";
  status: VoiceAgentStatus;
  isHoldingToSpeak: boolean;
  isError: boolean;
  errorType: "mic" | "connection" | "general";
  isInitializing: boolean;
  orbLabel?: string;
}) {
  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center shrink-0",
        isCompact ? "size-16 sm:size-18" : "size-28 sm:size-44 md:size-52",
      )}
    >
      {/* Outer Ripple Rings */}
      <div
        className={cn(
          "absolute inset-0 rounded-full border",
          isCompact
            ? "border-sky-400/40 dark:border-sky-500/30"
            : "border-sky-400/30 dark:border-sky-500/20",
          status === "speaking" || isHoldingToSpeak || status === "listening"
            ? isCompact
              ? "animate-ping opacity-35"
              : "animate-ping opacity-30 dark:opacity-25"
            : isCompact
              ? "opacity-15"
              : "opacity-15 dark:opacity-10",
        )}
      />
      <div
        className={cn(
          "absolute rounded-full border border-indigo-400/30 dark:border-indigo-500/25 transition-transform duration-150 will-change-transform",
          isCompact ? "-inset-1.5" : "-inset-2 sm:-inset-4",
          (isHoldingToSpeak || status === "listening") && "scale-105",
        )}
      />

      {/* Main Glowing Sphere */}
      <div
        className={cn(
          "relative rounded-full flex items-center justify-center cursor-pointer overflow-hidden will-change-transform transition-transform duration-150",
          isCompact
            ? "size-14 sm:size-16 shadow-2xl ring-2 ring-zinc-900/80 dark:ring-white/30"
            : "size-24 sm:size-36 md:size-44 shadow-xl dark:shadow-2xl ring-1 ring-black/5 dark:ring-white/10",
          isHoldingToSpeak &&
            (isCompact
              ? "scale-105 ring-3 ring-emerald-500/60 shadow-emerald-500/40"
              : "scale-105 ring-4 ring-emerald-500/40 shadow-emerald-500/30"),
          status === "speaking" &&
            (isCompact
              ? "scale-105 shadow-sky-500/40"
              : "scale-105 shadow-sky-500/30"),
          isError
            ? "bg-gradient-to-tr from-rose-700 via-rose-600 to-amber-600 shadow-rose-500/30"
            : isInitializing
              ? "bg-gradient-to-tr from-amber-600 via-orange-500 to-yellow-400"
              : status === "speaking"
                ? "bg-gradient-to-tr from-sky-600 via-indigo-500 to-cyan-400 shadow-sky-500/30"
                : isHoldingToSpeak || status === "listening"
                  ? "bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 shadow-emerald-500/30"
                  : status === "thinking"
                    ? "bg-gradient-to-tr from-purple-600 via-indigo-500 to-sky-400 shadow-purple-500/30"
                    : "bg-gradient-to-tr from-indigo-700 via-purple-600 to-sky-500 shadow-indigo-500/30",
        )}
      >
        {/* Fluid inner distortion */}
        <div className="absolute inset-0 bg-white/10 backdrop-blur-xs rounded-full animate-pulse" />

        {isError ? (
          <div className="flex flex-col items-center gap-1.5 text-white/90">
            {errorType === "mic" ? (
              <MicOff
                className={cn(isCompact ? "size-4" : "size-8", "text-rose-100")}
              />
            ) : errorType === "connection" ? (
              <WifiOff
                className={cn(
                  isCompact ? "size-4" : "size-8",
                  "text-amber-100",
                )}
              />
            ) : (
              <ShieldAlert
                className={cn(
                  isCompact ? "size-4" : "size-8",
                  "text-orange-100",
                )}
              />
            )}
            {!isCompact && orbLabel && (
              <span className="text-[11px] font-semibold tracking-wider uppercase text-rose-100">
                {orbLabel}
              </span>
            )}
          </div>
        ) : isInitializing ? (
          <div className="flex flex-col items-center gap-1.5 text-white/90">
            <Loader2
              className={cn(
                isCompact ? "size-4" : "size-8",
                "animate-spin text-white",
              )}
            />
            {!isCompact && (
              <span className="text-xs font-semibold tracking-wider uppercase">
                Setting up...
              </span>
            )}
          </div>
        ) : status === "speaking" ? (
          <div className="flex items-center gap-1 text-white/95">
            <span
              className={cn(
                "rounded-full bg-white animate-bounce",
                isCompact ? "h-2 w-0.5" : "h-6 w-1",
              )}
              style={{ animationDelay: "0ms" }}
            />
            <span
              className={cn(
                "rounded-full bg-white animate-bounce",
                isCompact ? "h-3.5 w-0.5" : "h-10 w-1",
              )}
              style={{ animationDelay: "150ms" }}
            />
            <span
              className={cn(
                "rounded-full bg-white animate-bounce",
                isCompact ? "h-5 w-0.5" : "h-14 w-1",
              )}
              style={{ animationDelay: "300ms" }}
            />
            <span
              className={cn(
                "rounded-full bg-white animate-bounce",
                isCompact ? "h-3 w-0.5" : "h-8 w-1",
              )}
              style={{ animationDelay: "450ms" }}
            />
            <span
              className={cn(
                "rounded-full bg-white animate-bounce",
                isCompact ? "h-1.5 w-0.5" : "h-5 w-1",
              )}
              style={{ animationDelay: "200ms" }}
            />
          </div>
        ) : status === "thinking" ? (
          <div className="flex flex-col items-center gap-1.5 text-white/90">
            <Loader2
              className={cn(
                isCompact ? "size-4" : "size-8",
                "animate-spin text-purple-100",
              )}
            />
            {!isCompact && (
              <span className="text-[11px] font-semibold tracking-wider uppercase text-purple-100">
                Thinking...
              </span>
            )}
          </div>
        ) : isHoldingToSpeak || status === "listening" ? (
          <div className="flex flex-col items-center gap-1.5 text-white/90">
            <Mic
              className={cn(
                isCompact ? "size-4" : "size-8",
                "animate-pulse text-emerald-100",
              )}
            />
            {!isCompact && (
              <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-100">
                Listening...
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-white/90">
            <Radio
              className={cn(
                isCompact ? "size-4" : "size-8",
                "text-indigo-100 opacity-90",
              )}
            />
            {!isCompact && (
              <span className="text-[11px] font-medium tracking-wider uppercase text-indigo-100">
                Idle
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export const VoiceAgentView = React.memo(function VoiceAgentView({
  status = "initializing",
  isMuted = false,
  micVolume = 0,
  isUserSpeaking = false,
  isHoldingToSpeak = false,
  isEnding = false,
  errorMessage = null,
  selectedLanguage = "hi-IN",
  onSelectLanguage,
  onToggleMute,
  onStartSpeaking,
  onStopSpeaking,
  onEndSession,
  onRetry,
  liveTranscript = "",
  assistantTranscript = "",
  activeToolName = null,
  activeArtifact = null,
  backgroundTask,
  activeTasks = [],
  sessionCompletedTasks = [],
  onOpenArtifact,
  isCameraActive = false,
  cameraFacingMode = "environment",
  cameraError = null,
  onClearCameraError,
  onToggleCamera,
  onSwitchCameraFacing,
  onAttachCameraVideoElement,
  isSidebarOpen,
  attachedDocuments = [],
  attachedDocument,
  onAttachDocuments,
  onAttachDocument,
  onRemoveAttachedDocument,
}: VoiceAgentViewProps) {
  const [showLiveCaptions, setShowLiveCaptions] = useState(true);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isResultsHubOpen, setIsResultsHubOpen] = useState(false);
  const [isFilesDialogOpen, setIsFilesDialogOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const docs: VoiceAttachedDocument[] = useMemo(() => {
    if (attachedDocuments && attachedDocuments.length > 0) return attachedDocuments;
    if (attachedDocument) return [attachedDocument];
    return [];
  }, [attachedDocuments, attachedDocument]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (onAttachDocuments) {
        onAttachDocuments(files);
      } else if (onAttachDocument) {
        onAttachDocument(files[0]);
      }
    }
    e.target.value = "";
  };

  // ── Track History Sidebar Open State (Hides Top & Bottom Controls on Mobile like Language Switcher) ──
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);

  useEffect(() => {
    const handleChatSidebarToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsChatSidebarOpen(Boolean(detail?.isOpen));
    };
    window.addEventListener("chat-sidebar-toggle", handleChatSidebarToggle);
    return () => {
      window.removeEventListener(
        "chat-sidebar-toggle",
        handleChatSidebarToggle,
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && isSidebarOpen !== undefined) {
      const isMobile = window.innerWidth < 1024;
      setIsChatSidebarOpen(isMobile && isSidebarOpen);
    }
  }, [isSidebarOpen]);

  // ── Classify error type from the errorMessage string ──
  const errorType = useMemo(() => {
    if (!errorMessage) return "mic" as const;
    const msg = errorMessage.toLowerCase();
    if (
      msg.includes("microphone") ||
      msg.includes("mic") ||
      msg.includes("notallowederror") ||
      msg.includes("permission") ||
      msg.includes("not allowed") ||
      msg.includes("blocked") ||
      msg.includes("notfounderror") ||
      msg.includes("no microphone") ||
      msg.includes("notreadableerror") ||
      msg.includes("busy in another")
    ) {
      return "mic" as const;
    }
    if (
      msg.includes("connection") ||
      msg.includes("vertex") ||
      msg.includes("websocket") ||
      msg.includes("ended unexpectedly") ||
      msg.includes("could not be established") ||
      msg.includes("reconnect") ||
      msg.includes("session") ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("token") ||
      msg.includes("unauthorized") ||
      msg.includes("401") ||
      msg.includes("500")
    ) {
      return "connection" as const;
    }
    return "general" as const;
  }, [errorMessage]);

  const errorConfig = useMemo(() => {
    switch (errorType) {
      case "mic":
        return {
          statusPillText: "Microphone Permission Required",
          orbLabel: "Mic Blocked",
          dialogTitle: "Microphone Permission Blocked",
          dialogDescription:
            errorMessage ||
            "VyaparSetu Voice requires microphone access to start the conversation.",
          dialogIcon: MicOff,
          dialogIconColor: "text-rose-500 dark:text-rose-400",
          dialogIconBg:
            "bg-rose-50 dark:bg-rose-500/20 border-rose-200 dark:border-rose-500/30",
          retryLabel: "Retry Microphone",
          showMicSteps: true,
        };
      case "connection":
        return {
          statusPillText: "Connection Lost",
          orbLabel: "Disconnected",
          dialogTitle: "Voice Connection Failed",
          dialogDescription:
            errorMessage ||
            "The secure voice connection to VyaparSetu could not be established.",
          dialogIcon: WifiOff,
          dialogIconColor: "text-amber-500 dark:text-amber-400",
          dialogIconBg:
            "bg-amber-50 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30",
          retryLabel: "Reconnect",
          showMicSteps: false,
        };
      case "general":
      default:
        return {
          statusPillText: "Something Went Wrong",
          orbLabel: "Error",
          dialogTitle: "Something Went Wrong",
          dialogDescription:
            errorMessage || "An unexpected error occurred. Please try again.",
          dialogIcon: ShieldAlert,
          dialogIconColor: "text-orange-500 dark:text-orange-400",
          dialogIconBg:
            "bg-orange-50 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/30",
          retryLabel: "Try Again",
          showMicSteps: false,
        };
    }
  }, [errorType, errorMessage]);

  // Multi-agent running tasks selector
  const runningTasks = useMemo(() => {
    if (activeTasks && activeTasks.length > 0) {
      return activeTasks.filter((t) => t.status === "working");
    }
    if (backgroundTask?.status === "working") {
      return [
        {
          id: "legacy_task",
          status: "working" as const,
          activeTool: backgroundTask.activeTool,
          description: backgroundTask.description,
          spokenHint: backgroundTask.spokenHint,
          progressPhase: backgroundTask.progressPhase,
          artifact: backgroundTask.artifact,
          startTime: Date.now(),
        },
      ];
    }
    return [];
  }, [activeTasks, backgroundTask]);

  const runningCount = runningTasks.length;

  // Session completed items sorted latest to oldest
  const completedItems = useMemo(() => {
    if (sessionCompletedTasks && sessionCompletedTasks.length > 0) {
      return [...sessionCompletedTasks].sort(
        (a, b) => b.completedAt - a.completedAt,
      );
    }
    if (backgroundTask?.status === "completed" && backgroundTask.artifact) {
      return [
        {
          id: "legacy_completed",
          completedAt: Date.now(),
          title: backgroundTask.artifact.title || "Ready on Screen",
          summary:
            backgroundTask.artifact.summary || "Draft prepared • Tap to review",
          artifact: backgroundTask.artifact,
        },
      ];
    }
    return [];
  }, [sessionCompletedTasks, backgroundTask]);

  const completedCount = completedItems.length;

  // Keyboard shortcut: Spacebar hold-to-speak on PC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (
          activeTag === "input" ||
          activeTag === "textarea" ||
          activeTag === "select"
        )
          return;
        if (
          status === "error" ||
          isEnding ||
          status === "initializing" ||
          status === "connecting" ||
          isMuted ||
          status === "speaking"
        )
          return;
        e.preventDefault();
        onStartSpeaking?.();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (
          activeTag === "input" ||
          activeTag === "textarea" ||
          activeTag === "select"
        )
          return;
        e.preventDefault();
        onStopSpeaking?.();
      }
    };

    const handleBlur = () => {
      if (isHoldingToSpeak) {
        onStopSpeaking?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [
    isHoldingToSpeak,
    status,
    isEnding,
    isMuted,
    onStartSpeaking,
    onStopSpeaking,
  ]);

  const isInitializing = status === "initializing" || status === "connecting";
  const isError = status === "error";

  return (
    <div
      className={cn(
        "relative w-full h-full select-none overflow-hidden overscroll-none touch-none flex flex-col items-center justify-between transition-colors duration-300 animate-in fade-in duration-300 flex-1 min-w-0 min-h-0",
        isCameraActive
          ? "bg-black text-white"
          : "bg-radial from-emerald-50/40 via-[#FDFCFA] to-cream dark:from-[#181a20] dark:via-[#121316] dark:to-[#0d0e11] text-foreground",
      )}
    >
      {/* ── Full-Screen Gemini Live Edge-to-Edge Camera Feed (When Camera Active) ── */}
      {isCameraActive && (
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-black animate-in fade-in duration-300">
          <video
            ref={(el) => onAttachCameraVideoElement?.(el)}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Viewfinder Target Framing Brackets (Apple / Samsung style) */}
          <div className="absolute inset-4 sm:inset-6 pointer-events-none border border-white/10 rounded-3xl">
            <div className="absolute top-0 left-0 size-6 border-t-2 border-l-2 border-emerald-400/80 rounded-tl-xl" />
            <div className="absolute top-0 right-0 size-6 border-t-2 border-r-2 border-emerald-400/80 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 size-6 border-b-2 border-l-2 border-emerald-400/80 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 size-6 border-b-2 border-r-2 border-emerald-400/80 rounded-br-xl" />
          </div>

          {/* Top Vignette Gradient Overlay (for Top Controls Readability) */}
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none z-1" />

          {/* Bottom Vignette Gradient Overlay (for Bottom Controls Readability) */}
          <div className="absolute bottom-0 inset-x-0 h-72 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-1" />
        </div>
      )}

      {/* ── Fixed Top Controls Area: Positioned cleanly BELOW Row 1 (Menu/Language & New Chat/Sidebar) ── */}
      <div className="w-full flex flex-col items-center gap-2 sm:gap-2.5 z-25 shrink-0 px-3 sm:px-6 pt-14 sm:pt-16 max-w-2xl mx-auto">
        {/* Row 2: Status Pill on Left, Captions & Flip Camera on Right */}
        <div
          className={cn(
            "flex items-center justify-between w-full gap-2 transition-all duration-200",
            isChatSidebarOpen
              ? "opacity-0 pointer-events-none -translate-y-2"
              : "opacity-100 translate-y-0",
          )}
        >
          <div
            className={cn(
              "h-10 px-3.5 flex items-center gap-2 rounded-2xl backdrop-blur-md border transition-all truncate shadow-xs",
              isCameraActive
                ? "bg-black/70 text-white border-white/20 shadow-md"
                : "bg-white/90 dark:bg-card/90 text-foreground border-sage/40 dark:border-border",
            )}
          >
            <span className="relative flex size-2.5 shrink-0">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                  isError
                    ? "bg-rose-400"
                    : isInitializing
                      ? "bg-amber-400"
                      : status === "speaking"
                        ? "bg-sky-400"
                        : isHoldingToSpeak || status === "listening"
                          ? "bg-emerald-400"
                          : status === "thinking"
                            ? "bg-purple-400"
                            : "bg-indigo-400 opacity-40",
                )}
              />
              <span
                className={cn(
                  "relative inline-flex rounded-full size-2.5",
                  isError
                    ? "bg-rose-500"
                    : isInitializing
                      ? "bg-amber-500"
                      : status === "speaking"
                        ? "bg-sky-500"
                        : isHoldingToSpeak || status === "listening"
                          ? "bg-emerald-500"
                          : status === "thinking"
                            ? "bg-purple-500"
                            : "bg-indigo-500",
                )}
              />
            </span>

            <span
              className={cn(
                "text-xs sm:text-[13px] font-semibold capitalize tracking-wide truncate",
                isCameraActive ? "text-white" : "text-foreground",
              )}
            >
              {isError
                ? errorConfig.statusPillText
                : isInitializing
                  ? "Setting Up Voice OS..."
                  : isMuted
                    ? "Muted"
                    : status === "speaking"
                      ? "VyaparSetu Speaking..."
                      : isHoldingToSpeak || status === "listening"
                        ? "Listening to you..."
                        : status === "thinking"
                          ? "Analyzing..."
                          : "Idle • Hold to Speak"}
            </span>
          </div>

          {/* Top Right Controls: Flip Camera (when camera active) & Captions Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isCameraActive && (
              <button
                type="button"
                onClick={onSwitchCameraFacing}
                className="h-10 px-3 rounded-2xl flex items-center gap-1.5 text-xs font-semibold border border-white/20 bg-black/70 hover:bg-black/85 text-white backdrop-blur-md shadow-md transition-colors cursor-pointer"
                title={`Switch camera (currently ${cameraFacingMode})`}
              >
                <SwitchCamera className="size-4" />
                <span className="hidden sm:inline">Flip</span>
              </button>
            )}

            <button
              onClick={() => setShowLiveCaptions(!showLiveCaptions)}
              title="Toggle live captions"
              className={cn(
                "h-10 px-2.5 sm:px-3.5 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold border backdrop-blur-md shadow-xs transition-all cursor-pointer",
                isCameraActive
                  ? showLiveCaptions
                    ? "bg-white text-zinc-900 border-white shadow-md"
                    : "bg-black/70 text-white/80 border-white/20 hover:bg-black/85 hover:text-white"
                  : showLiveCaptions
                    ? "bg-forest dark:bg-mint text-white dark:text-forest-dark border-forest dark:border-mint shadow-xs"
                    : "bg-white/90 dark:bg-card/90 text-ink-muted hover:text-forest dark:hover:text-mint border-sage/40 dark:border-border hover:bg-cream dark:hover:bg-muted",
              )}
            >
              <MessageSquareText className="size-4.5" />
              <span className="hidden sm:inline">Captions</span>
            </button>
          </div>
        </div>

        {/* ── Row 3: Interactive Staged Artifact Pill (Directly below Row 2) ── */}
        {activeArtifact && (
          <div
            onClick={() => onOpenArtifact?.(activeArtifact)}
            className={cn(
              "w-full max-w-md p-3 rounded-2xl border text-foreground flex items-center justify-between gap-3 shadow-md backdrop-blur-xl transition-all cursor-pointer group select-none animate-in fade-in-50 duration-200",
              isCameraActive
                ? "bg-black/80 hover:bg-black/90 border-emerald-500/50 text-white shadow-2xl"
                : "bg-white/95 dark:bg-card/95 hover:bg-white dark:hover:bg-card border-emerald-500/40 hover:border-emerald-500",
              isChatSidebarOpen && "opacity-0 pointer-events-none -translate-y-2",
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-xl bg-emerald-50 dark:bg-mint/15 border border-emerald-200 dark:border-mint/30 text-emerald-700 dark:text-mint flex items-center justify-center shrink-0">
                {activeArtifact.artifactType === "chart" && (
                  <BarChart3 className="size-4" />
                )}
                {activeArtifact.artifactType === "budget" && (
                  <PieChart className="size-4" />
                )}
                {activeArtifact.artifactType === "expense" && (
                  <IndianRupee className="size-4" />
                )}
                {activeArtifact.artifactType === "transaction" && (
                  <Layers className="size-4" />
                )}
                {activeArtifact.artifactType === "saving_goal" && (
                  <Target className="size-4" />
                )}
                {activeArtifact.artifactType === "debt" && (
                  <Landmark className="size-4" />
                )}
                {activeArtifact.artifactType === "form" && (
                  <ClipboardList className="size-4" />
                )}
                {activeArtifact.artifactType === "document" && (
                  <FileText className="size-4" />
                )}
                {(activeArtifact.artifactType === "mandi_arbitrage" || activeArtifact.artifactType === "mandi") && (
                  <Coins className="size-4" />
                )}
                {(activeArtifact.artifactType === "govt_schemes" || activeArtifact.artifactType === "schemes") && (
                  <Landmark className="size-4" />
                )}
                {(activeArtifact.artifactType === "swot_matrix" || activeArtifact.artifactType === "swot") && (
                  <Target className="size-4" />
                )}
                {(activeArtifact.artifactType === "catchment_radar" || activeArtifact.artifactType === "competitors") && (
                  <Store className="size-4" />
                )}
                {(activeArtifact.artifactType === "emi_calculator" || activeArtifact.artifactType === "credit") && (
                  <CreditCard className="size-4" />
                )}
                {activeArtifact.artifactType === "swarm_dossier" && (
                  <Compass className="size-4" />
                )}
                {activeArtifact.artifactType === "delete_record" && (
                  <AlertTriangle className="size-4 text-rose-500" />
                )}
                {![
                  "chart", "budget", "expense", "transaction", "saving_goal",
                  "debt", "form", "document", "mandi_arbitrage", "mandi",
                  "govt_schemes", "schemes", "swot_matrix", "swot",
                  "catchment_radar", "competitors", "emi_calculator", "credit", "swarm_dossier", "delete_record"
                ].includes(activeArtifact.artifactType) && (
                  <FileText className="size-4" />
                )}
              </div>
              <div className="min-w-0">
                <h4
                  className={cn(
                    "text-[13.5px] font-semibold transition-colors truncate",
                    isCameraActive
                      ? "text-white group-hover:text-mint"
                      : "text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-mint",
                  )}
                >
                  {activeArtifact.title || "Interactive Action Draft"}
                </h4>
                <p
                  className={cn(
                    "text-[11.5px] truncate mt-0.5",
                    isCameraActive
                      ? "text-zinc-300"
                      : "text-zinc-500 dark:text-zinc-400",
                  )}
                >
                  {cleanSummaryPreview(activeArtifact.summary) ||
                    "Draft prepared • Tap to review & edit"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-mint px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-mint/10 border border-emerald-200 dark:border-mint/20">
                Review
              </span>
              <ArrowUpRight className="size-4 text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-mint group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>
        )}
      </div>

      {/* ── Central Stage: Ambient Voice Orb (When Camera is Inactive) & Overlay Captions ── */}
      <div
        className={cn(
          "relative flex flex-col items-center justify-center flex-1 min-h-0 w-full my-auto z-10 transition-all duration-300",
          isCameraActive ? "max-w-lg" : "max-w-md",
        )}
      >
        {!isCameraActive && (
          <>
            {/* Glowing Background Radial Bloom (Hardware accelerated) */}
            <div
              className={cn(
                "absolute -inset-10 rounded-full blur-3xl opacity-40 dark:opacity-40 pointer-events-none will-change-transform",
                (isHoldingToSpeak || status === "listening") && "animate-pulse",
                isError
                  ? "bg-rose-500/20"
                  : isInitializing
                    ? "bg-amber-500/20"
                    : status === "speaking"
                      ? "bg-sky-500/25 dark:bg-sky-500/30 animate-pulse"
                      : isHoldingToSpeak || status === "listening"
                        ? "bg-emerald-500/20 dark:bg-emerald-500/25"
                        : status === "thinking"
                          ? "bg-purple-500/20 dark:bg-purple-500/25 animate-pulse"
                          : "bg-indigo-500/15 dark:bg-indigo-500/20",
              )}
            />

            <VoiceOrbView
              size="large"
              status={status}
              isHoldingToSpeak={isHoldingToSpeak}
              isError={isError}
              errorType={errorType}
              isInitializing={isInitializing}
              orbLabel={errorConfig.orbLabel}
            />
          </>
        )}

        {/* Real-time Autonomous Background Task Progression */}
        {runningCount >= 2 ? (
          /* Multi-Agent Compact Counter Pill (When 2+ Sub-Agents are working simultaneously) */
          <div
            className={cn(
              "inline-flex items-center gap-2.5 px-4 py-2 rounded-full border backdrop-blur-xl shadow-lg transition-all animate-pulse",
              isCameraActive
                ? "bg-black/85 border-sky-400/60 text-white"
                : "bg-white/90 dark:bg-zinc-900/90 border-sky-400/50 dark:border-sky-500/40 text-sky-600 dark:text-sky-300",
              isCameraActive ? "mt-4" : "mt-5",
            )}
          >
            <span className="relative flex size-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-80" />
              <span className="relative inline-flex rounded-full size-2.5 bg-sky-500" />
            </span>
            <span className="text-xs font-bold tracking-wide">
              ⚡ {runningCount} Agents Working in Parallel...
            </span>
          </div>
        ) : runningCount === 1 ? (
          /* Single Sub-Agent Detailed Task Card (When exactly 1 agent is working) */
          <div
            className={cn(
              "w-full max-w-md px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200",
              isCameraActive
                ? "bg-black/80 border-sky-500/40 text-white"
                : "bg-white/85 dark:bg-zinc-900/85 border-sky-400/40 dark:border-sky-500/30",
              isCameraActive ? "mt-4" : "mt-5",
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-sky-500" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  Autonomous Screen Engine
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                {runningTasks[0]?.activeTool
                  ? `${runningTasks[0].activeTool}...`
                  : "Working..."}
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="size-7 rounded-lg bg-sky-100 dark:bg-sky-950/60 border border-sky-300/60 dark:border-sky-800/40 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400 mt-0.5">
                {runningTasks[0]?.activeTool === "webSearch" ? (
                  <Search className="size-3.5" />
                ) : runningTasks[0]?.activeTool === "stageForm" ? (
                  <ClipboardList className="size-3.5 animate-bounce" />
                ) : runningTasks[0]?.activeTool === "stageChart" ? (
                  <BarChart3 className="size-3.5 animate-pulse" />
                ) : (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
              </div>
              <div className="min-w-0 text-left">
                <p
                  className={cn(
                    "text-xs font-semibold line-clamp-2",
                    isCameraActive
                      ? "text-white"
                      : "text-zinc-800 dark:text-zinc-200",
                  )}
                >
                  {runningTasks[0]?.description ||
                    "Researching official guidelines & preparing screen action..."}
                </p>
                {runningTasks[0]?.spokenHint && (
                  <p className="text-[11px] text-zinc-400 mt-0.5 truncate italic">
                    &ldquo;{runningTasks[0].spokenHint}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Completed Background Task / Results Hub Banner */}
        {completedCount === 1 && !activeArtifact ? (
          /* Single Completed Tool Preview Card */
          <div
            onClick={() => onOpenArtifact?.(completedItems[0].artifact)}
            className={cn(
              "mt-4 w-full max-w-md p-3 rounded-2xl border backdrop-blur-xl shadow-lg cursor-pointer transition-all hover:scale-[1.01] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
              isCameraActive
                ? "bg-black/80 border-emerald-500/50 text-white"
                : "bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500/40 hover:border-emerald-500",
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="min-w-0 text-left">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  {completedItems[0]?.title || "Ready on Screen"}
                </h4>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate">
                  {cleanSummaryPreview(completedItems[0]?.summary) ||
                    "Draft prepared • Tap to review"}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-500/40 shrink-0">
              Open
            </span>
          </div>
        ) : completedCount >= 2 && !activeArtifact ? (
          /* Consolidated Multi-Tool Results Hub Button (When 2+ tasks completed in session) */
          <div
            onClick={() => setIsResultsHubOpen(true)}
            className={cn(
              "mt-4 w-full max-w-md p-3 rounded-2xl border backdrop-blur-xl shadow-lg cursor-pointer transition-all hover:scale-[1.01] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
              isCameraActive
                ? "bg-black/85 border-emerald-500/60 text-white"
                : "bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-500/50 hover:border-emerald-500",
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Layers className="size-4" />
              </div>
              <div className="min-w-0 text-left">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  📋 Completed Tasks & Tools ({completedCount})
                </h4>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate">
                  Latest: {completedItems[0]?.title || "Draft prepared"} • Tap
                  to view all
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-500/40 shrink-0 flex items-center gap-1">
              View All <ArrowUpRight className="size-3" />
            </span>
          </div>
        ) : null}

        {/* Fallback Active Tool Badge */}
        {activeToolName && !backgroundTask?.status && (
          <div className="mt-6 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-medium shadow-xs animate-in fade-in zoom-in-95">
            <span>Executing {activeToolName}...</span>
          </div>
        )}

        {/* Real-time Mic Activity Level / Half-Duplex Indicator (only when camera inactive) */}
        {!isCameraActive &&
          (isHoldingToSpeak || status === "listening") &&
          !isMuted && (
            <div className="mt-4 flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800 shadow-xs animate-in fade-in-50">
              <div className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                Listening to your voice
              </span>
              <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-100 rounded-full"
                  style={{
                    width: `${Math.max(6, Math.min(100, micVolume * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

        {!isCameraActive && status === "speaking" && (
          <div className="mt-4 flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/40 shadow-xs animate-in fade-in-50">
            <div className="size-2 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse" />
            <span className="text-[11.5px] font-medium text-sky-700 dark:text-sky-300">
              AI Speaking &bull; Mic Locked
            </span>
          </div>
        )}

        {/* ── Live Captions / Subtitle Area with Responsive Max Height ── */}
        {showLiveCaptions && (
          <div className="mt-2.5 sm:mt-4 md:mt-6 w-full max-w-lg flex flex-col items-center justify-start gap-2 sm:gap-2.5 text-center px-2 z-20 min-h-0">
            <LiveTranscriptView
              liveTranscript={liveTranscript}
              isHoldingToSpeak={isHoldingToSpeak}
              isCameraActive={isCameraActive}
            />

            <AssistantCaptionView
              assistantTranscript={assistantTranscript}
              isSpeaking={status === "speaking"}
              isCameraActive={isCameraActive}
            />

            {!liveTranscript && !assistantTranscript && (
              <p
                className={cn(
                  "text-xs tracking-wide font-normal py-2",
                  isCameraActive
                    ? "text-white/70"
                    : "text-zinc-500 dark:text-zinc-400",
                )}
              >
                {isInitializing
                  ? "Connecting to Voice OS..."
                  : isMuted
                    ? "Microphone is paused. Tap mic below to resume."
                    : status === "speaking"
                      ? "VyaparSetu is speaking..."
                      : status === "thinking"
                        ? "Analyzing your request..."
                        : isHoldingToSpeak || status === "listening"
                          ? "Listening to you speak..."
                          : "Hold the button or Spacebar to speak in your language..."}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Control Deck (Hovering at bottom over camera video in camera mode) ── */}
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 sm:gap-2.5 w-full max-w-md z-20 transition-all duration-200 shrink-0",
          isCameraActive
            ? "pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-8"
            : "pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:pb-4",
          isChatSidebarOpen
            ? "opacity-0 pointer-events-none translate-y-2"
            : "opacity-100 translate-y-0",
        )}
      >
        {/* Hovering Voice Orb when Camera is Active (exact same visual style compact above buttons) */}
        {isCameraActive && (
          <div className="pointer-events-auto -mb-1 animate-in fade-in zoom-in-95 duration-200">
            <VoiceOrbView
              size="compact"
              status={status}
              isHoldingToSpeak={isHoldingToSpeak}
              isError={isError}
              errorType={errorType}
              isInitializing={isInitializing}
            />
          </div>
        )}

        {/* Real-time Mic Activity Level / Half-Duplex Indicator (shown in bottom deck when camera active) */}
        {isCameraActive &&
          (isHoldingToSpeak || status === "listening") &&
          !isMuted && (
            <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/75 text-white border border-white/20 backdrop-blur-md shadow-xs animate-in fade-in-50">
              <div className="size-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-medium text-white">
                Listening to your voice
              </span>
              <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-100 rounded-full"
                  style={{
                    width: `${Math.max(6, Math.min(100, micVolume * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

        {isCameraActive && status === "speaking" && (
          <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/75 text-sky-300 border border-sky-400/40 backdrop-blur-md shadow-xs animate-in fade-in-50">
            <div className="size-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-[11.5px] font-medium">
              AI Speaking &bull; Mic Locked
            </span>
          </div>
        )}

        {/* Hidden file input for uploading images & documents (Android WhatsApp-style rich picker) */}
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/*,.pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Floating Document Attachment Controls: Dialog Opener Badge + Same-Line "+ Add File" Button */}
        {docs.length > 0 ? (
          <div className="flex items-center justify-center gap-2 mb-1 max-w-[95%] sm:max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Opener Pill / Card */}
            <button
              type="button"
              onClick={() => setIsFilesDialogOpen(true)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm backdrop-blur-md transition-all cursor-pointer hover:scale-[1.02] active:scale-95 text-left min-w-0 max-w-[260px] sm:max-w-xs",
                isCameraActive
                  ? "bg-black/75 hover:bg-black/90 text-white border-white/25"
                  : "bg-white/95 dark:bg-card/90 hover:bg-cream dark:hover:bg-muted text-foreground border-sage/40 dark:border-border",
              )}
              title="Click to view attached documents"
            >
              {docs[docs.length - 1]?.previewUrl ? (
                <img
                  src={docs[docs.length - 1].previewUrl}
                  alt={docs[docs.length - 1].name}
                  className="size-5 rounded-md object-cover border border-sage/30 dark:border-border/60 shrink-0"
                />
              ) : (
                <div className="size-5 rounded-md bg-forest/10 dark:bg-mint/10 flex items-center justify-center shrink-0 text-forest dark:text-mint">
                  <FileText className="size-3" />
                </div>
              )}
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="text-xs font-semibold truncate">
                  {docs.length === 1 ? docs[0].name : `${docs.length} Files Attached`}
                </span>
                {docs.some((d) => d.status === "uploading") ? (
                  <Loader2 className="size-3 animate-spin text-amber-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                )}
              </div>
            </button>

            {/* Same-line "+ Add File" button */}
            <button
              type="button"
              onClick={() => {
                if (docs.length >= 5) return;
                uploadInputRef.current?.click();
              }}
              disabled={docs.length >= 5 || isInitializing || isEnding || isError}
              title={docs.length >= 5 ? "Maximum 5 files reached" : "Add more files (max 5)"}
              className={cn(
                "h-8 px-2.5 rounded-full flex items-center gap-1 text-xs font-medium transition-all shadow-xs hover:shadow cursor-pointer active:scale-95 shrink-0",
                docs.length >= 5
                  ? "opacity-50 cursor-not-allowed bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                  : isCameraActive
                    ? "bg-black/65 hover:bg-black/85 text-white/90 border border-white/20 backdrop-blur-md"
                    : "bg-white/90 dark:bg-card/90 hover:bg-cream dark:hover:bg-muted text-forest dark:text-mint border border-sage/40 dark:border-border",
              )}
            >
              <Plus className="size-3.5" />
              <span>Add File</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center mb-1">
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={isInitializing || isEnding || isError}
              title="Upload document or bill photo (up to 5 files)"
              className={cn(
                "h-7 px-3 rounded-full flex items-center gap-1.5 text-xs font-medium transition-all shadow-xs hover:shadow cursor-pointer active:scale-95",
                isCameraActive
                  ? "bg-black/65 hover:bg-black/85 text-white/90 border border-white/20 backdrop-blur-md"
                  : "bg-white/90 dark:bg-card/90 hover:bg-cream dark:hover:bg-muted text-forest dark:text-mint border border-sage/40 dark:border-border",
              )}
            >
              <Plus className="size-3.5" />
              <span>Add Document</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 sm:gap-3.5 md:gap-4 w-full px-2">
          {/* Mute / Unmute Button */}
          <button
            onClick={onToggleMute}
            disabled={isInitializing || isEnding || isError}
            title={isMuted ? "Unmute microphone" : "Mute microphone"}
            className={cn(
              "size-11 sm:size-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm hover:shadow-md shrink-0 active:scale-95",
              isCameraActive
                ? isMuted
                  ? "bg-rose-500/30 text-rose-300 border border-rose-400/50 hover:bg-rose-500/40"
                  : "bg-black/65 hover:bg-black/85 text-white border border-white/25 backdrop-blur-md shadow-lg"
                : isMuted
                  ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                  : "bg-white/95 dark:bg-card/90 text-foreground border border-sage/40 dark:border-border hover:bg-cream dark:hover:bg-muted hover:text-forest dark:hover:text-mint",
              isError && "opacity-50 cursor-not-allowed",
            )}
          >
            {isMuted ? (
              <MicOff className="size-4.5 sm:size-5" />
            ) : (
              <Mic className="size-4.5 sm:size-5" />
            )}
          </button>

          {/* Camera Realtime Vision Toggle Button */}
          <button
            onClick={onToggleCamera}
            disabled={isInitializing || isEnding || isError}
            title={
              isCameraActive
                ? "Turn off camera"
                : "Turn on real-time document camera"
            }
            className={cn(
              "size-11 sm:size-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm hover:shadow-md shrink-0 active:scale-95",
              isCameraActive
                ? "bg-emerald-500 text-white shadow-emerald-500/40 hover:bg-emerald-600 ring-2 ring-emerald-400/60"
                : "bg-white/95 dark:bg-card/90 text-foreground border border-sage/40 dark:border-border hover:bg-cream dark:hover:bg-muted hover:text-forest dark:hover:text-mint",
              isError && "opacity-50 cursor-not-allowed",
            )}
          >
            {isCameraActive ? (
              <VideoOff className="size-4.5 sm:size-5" />
            ) : (
              <Camera className="size-4.5 sm:size-5" />
            )}
          </button>

          {/* Hold to Speak Button */}
          <button
            onPointerDown={(e) => {
              if (
                status === "speaking" ||
                isMuted ||
                isInitializing ||
                isEnding ||
                isError
              )
                return;
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {
                /* ignored */
              }
              e.preventDefault();
              onStartSpeaking?.();
            }}
            onPointerUp={(e) => {
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(
                  e.pointerId,
                );
              } catch {
                /* already released */
              }
              onStopSpeaking?.();
            }}
            onPointerCancel={(e) => {
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(
                  e.pointerId,
                );
              } catch {
                /* already released */
              }
              onStopSpeaking?.();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              return false;
            }}
            draggable={false}
            disabled={
              isInitializing ||
              isEnding ||
              isError ||
              isMuted ||
              status === "speaking"
            }
            title={
              status === "speaking"
                ? "AI is speaking..."
                : "Hold to speak (or press Spacebar)"
            }
            className={cn(
              "h-11 sm:h-13 px-3.5 sm:px-6 rounded-full flex items-center justify-center gap-1.5 sm:gap-2 font-semibold text-xs sm:text-sm transition-all shadow-sm hover:shadow-md select-none touch-none cursor-pointer will-change-transform active:scale-98",
              isHoldingToSpeak
                ? "bg-emerald-600 hover:bg-emerald-500 text-white scale-105 shadow-emerald-600/30 dark:shadow-emerald-950/60 ring-4 ring-emerald-500/30"
                : isCameraActive
                  ? "bg-white/95 hover:bg-white text-zinc-900 border border-white/30 backdrop-blur-md shadow-2xl"
                  : "bg-white/95 dark:bg-card/90 hover:bg-cream dark:hover:bg-muted text-forest dark:text-foreground border border-sage/40 dark:border-border",
              (isInitializing ||
                isEnding ||
                isError ||
                isMuted ||
                status === "speaking") &&
                "opacity-50 cursor-not-allowed",
            )}
            style={{
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
              touchAction: "none",
            }}
          >
            <Mic
              className={cn(
                "size-4 sm:size-4.5 pointer-events-none select-none",
                isHoldingToSpeak && "animate-pulse text-white",
              )}
            />
            <span className="pointer-events-none select-none truncate">
              {status === "speaking"
                ? "AI Speaking..."
                : isHoldingToSpeak
                  ? "Release to Send"
                  : "Hold to Speak"}
            </span>
          </button>

          {/* End Call / Return to Chat Button */}
          <button
            onClick={onEndSession}
            disabled={isEnding}
            title="End voice session & return to chat"
            className={cn(
              "h-11 sm:h-13 px-3.5 sm:px-5.5 rounded-full flex items-center justify-center gap-1.5 sm:gap-2 font-semibold text-xs sm:text-sm transition-all shadow-sm hover:shadow-md shadow-rose-600/20 dark:shadow-rose-950/50 active:scale-95 shrink-0",
              isEnding
                ? "bg-rose-900/80 text-white/80 cursor-wait opacity-80"
                : "bg-rose-600 hover:bg-rose-500 text-white cursor-pointer hover:scale-105",
            )}
          >
            {isEnding ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span className="hidden xs:inline sm:inline">Ending...</span>
              </>
            ) : (
              <>
                <PhoneOff className="size-4" />
                <span>End</span>
              </>
            )}
          </button>
        </div>

        <p
          className={cn(
            "hidden md:block text-[11px] tracking-wide text-center select-none",
            isCameraActive
              ? "text-white/70"
              : "text-zinc-500 dark:text-zinc-400",
          )}
        >
          Tip: Press &amp; hold{" "}
          <span
            className={cn(
              "font-mono px-1 py-0.5 rounded text-[10px]",
              isCameraActive
                ? "bg-white/20 text-white"
                : "text-zinc-700 dark:text-zinc-300 bg-zinc-200/80 dark:bg-zinc-800/60",
            )}
          >
            Spacebar
          </span>{" "}
          to speak
        </p>
      </div>

      {/* ── LOCKING BACKGROUND DIALOG POPUP (Error-Type Aware - Shadcn Dialog with clean Artifact-style tint) ── */}
      <Dialog open={isError}>
        <DialogContent
          showCloseButton={false}
          className="max-w-md p-6 rounded-3xl bg-white dark:bg-[#18191c] shadow-2xl text-center border border-sage/30 dark:border-zinc-800"
        >
          {/* Top Icon */}
          <div
            className={cn(
              "mx-auto mb-4 size-14 rounded-2xl border flex items-center justify-center",
              errorConfig.dialogIconBg,
              errorConfig.dialogIconColor,
            )}
          >
            <errorConfig.dialogIcon className="size-7" />
          </div>

          <DialogTitle className="text-lg font-semibold text-zinc-900 dark:text-white mb-2 text-center">
            {errorConfig.dialogTitle}
          </DialogTitle>

          <DialogDescription className="text-xs md:text-[13px] text-zinc-600 dark:text-zinc-400 mb-5 leading-relaxed text-center">
            {errorConfig.dialogDescription}
          </DialogDescription>

          {/* Step-by-step Quick Guide — only for microphone errors */}
          {errorConfig.showMicSteps && (
            <div className="w-full p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-left mb-6 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 rounded-full bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/40 text-[11px] font-bold text-rose-600 dark:text-rose-300 items-center justify-center mt-0.5">
                  1
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                  Click the{" "}
                  <strong className="text-zinc-900 dark:text-white">
                    lock 🔒 or tune 🎛️ icon
                  </strong>{" "}
                  in your browser address bar (top left of the URL).
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 rounded-full bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/40 text-[11px] font-bold text-rose-600 dark:text-rose-300 items-center justify-center mt-0.5">
                  2
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                  Toggle{" "}
                  <strong className="text-zinc-900 dark:text-white">
                    Microphone
                  </strong>{" "}
                  to{" "}
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    &ldquo;Allow&rdquo;
                  </span>
                  .
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 rounded-full bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/40 text-[11px] font-bold text-rose-600 dark:text-rose-300 items-center justify-center mt-0.5">
                  3
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                  Click{" "}
                  <strong className="text-zinc-900 dark:text-white">
                    &ldquo;{errorConfig.retryLabel}&rdquo;
                  </strong>{" "}
                  below.
                </p>
              </div>
            </div>
          )}

          {/* Connection error help tips */}
          {errorType === "connection" && (
            <div className="w-full p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-left mb-6 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-[11px] font-bold text-amber-700 dark:text-amber-300 items-center justify-center mt-0.5">
                  1
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                  Check your{" "}
                  <strong className="text-zinc-900 dark:text-white">
                    internet connection
                  </strong>{" "}
                  is stable.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-[11px] font-bold text-amber-700 dark:text-amber-300 items-center justify-center mt-0.5">
                  2
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                  The voice server may be temporarily busy.{" "}
                  <strong className="text-zinc-900 dark:text-white">
                    Wait a moment
                  </strong>{" "}
                  and try again.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-[11px] font-bold text-amber-700 dark:text-amber-300 items-center justify-center mt-0.5">
                  3
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                  Click{" "}
                  <strong className="text-zinc-900 dark:text-white">
                    &ldquo;{errorConfig.retryLabel}&rdquo;
                  </strong>{" "}
                  below to reconnect.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="w-full flex flex-col gap-2.5">
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry()}
                className={cn(
                  "w-full py-2.5 px-4 rounded-xl text-white font-medium text-sm transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]",
                  errorType === "mic"
                    ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
                    : errorType === "connection"
                      ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30"
                      : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30",
                )}
              >
                <RefreshCw className="size-4" />
                <span>{errorConfig.retryLabel}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onEndSession}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 hover:bg-zinc-200 dark:hover:bg-zinc-700/90 border border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <PhoneOff className="size-4 text-zinc-500 dark:text-zinc-400" />
              <span>Return to Chat</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CAMERA PERMISSION BLOCKED DIALOG (Shadcn Dialog with clean Artifact-style tint) ── */}
      <Dialog open={cameraError === "denied"}>
        <DialogContent
          showCloseButton={false}
          className="max-w-md p-6 rounded-3xl bg-white dark:bg-[#18191c] shadow-2xl text-center border border-amber-200 dark:border-amber-500/30"
        >
          {/* Top Icon */}
          <div className="mx-auto mb-4 size-14 rounded-2xl border bg-amber-50 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center">
            <VideoOff className="size-7" />
          </div>

          <DialogTitle className="text-lg font-semibold text-zinc-900 dark:text-white mb-2 text-center">
            Camera Permission Blocked
          </DialogTitle>

          <DialogDescription className="text-xs md:text-[13px] text-zinc-600 dark:text-zinc-400 mb-5 leading-relaxed text-center">
            VyaparSetu needs camera access to inspect documents in real time. Your voice conversation remains active.
          </DialogDescription>

          {/* Step-by-step Quick Guide — matching mic permission steps */}
          <div className="w-full p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-left mb-6 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-[11px] font-bold text-amber-700 dark:text-amber-300 items-center justify-center mt-0.5">
                1
              </span>
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                Click the{" "}
                <strong className="text-zinc-900 dark:text-white">
                  lock 🔒 or tune 🎛️ icon
                </strong>{" "}
                in your browser address bar (top left of the URL).
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-[11px] font-bold text-amber-700 dark:text-amber-300 items-center justify-center mt-0.5">
                2
              </span>
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                Toggle{" "}
                <strong className="text-zinc-900 dark:text-white">
                  Camera
                </strong>{" "}
                to{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  &ldquo;Allow&rdquo;
                </span>
                .
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-[11px] font-bold text-amber-700 dark:text-amber-300 items-center justify-center mt-0.5">
                3
              </span>
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                Click{" "}
                <strong className="text-zinc-900 dark:text-white">
                  &ldquo;Retry Camera&rdquo;
                </strong>{" "}
                below.
              </p>
            </div>
          </div>

          {/* Actions: Retry OR Continue with Voice Only */}
          <div className="w-full flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClearCameraError?.();
                onToggleCamera?.();
              }}
              className="w-full py-2.5 px-4 rounded-xl text-white font-medium text-sm transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] bg-amber-600 hover:bg-amber-500 shadow-amber-600/30"
            >
              <RefreshCw className="size-4" />
              <span>Retry Camera</span>
            </button>

            <button
              type="button"
              onClick={onClearCameraError}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 hover:bg-zinc-200 dark:hover:bg-zinc-700/90 border border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue with Voice Only</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CONSOLIDATED TOOL RESULTS HUB MODAL (Sorted Latest to Oldest) ── */}
      {isResultsHubOpen && completedItems.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Layers className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                      Completed Tasks & Tools Hub
                    </h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/50">
                      {completedItems.length} Total
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Sorted latest to oldest from this voice session
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResultsHubOpen(false)}
                className="size-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* List of items sorted latest to oldest */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {completedItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  onClick={() => {
                    setIsResultsHubOpen(false);
                    onOpenArtifact?.(item.artifact);
                  }}
                  className="group p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/50 bg-white dark:bg-zinc-900/60 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-all cursor-pointer shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="size-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 group-hover:bg-emerald-500 group-hover:text-white text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0 transition-colors mt-0.5">
                      {item.artifact.artifactType === "form" ? (
                        <ClipboardList className="size-4" />
                      ) : item.artifact.artifactType === "document" ? (
                        <MessageSquareText className="size-4" />
                      ) : item.artifact.artifactType === "chart" ? (
                        <BarChart3 className="size-4" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                          {item.title}
                        </h4>
                        {idx === 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                        {cleanSummaryPreview(item.summary)}
                      </p>
                      <span className="text-[10px] text-zinc-400 font-mono mt-1 inline-block">
                        {new Date(item.completedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsResultsHubOpen(false);
                      onOpenArtifact?.(item.artifact);
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 group-hover:bg-emerald-600 group-hover:text-white text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Open <ArrowUpRight className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ATTACHED DOCUMENTS DIALOG (Matching isResultsHubOpen layout) ── */}
      {isFilesDialogOpen && docs.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <FileText className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                      Attached Documents
                    </h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/50">
                      {docs.length}/5 Attached
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Uploaded files available to AI during this voice session
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFilesDialogOpen(false)}
                className="size-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* List of files */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {docs.map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  className="p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {doc.previewUrl ? (
                      <img
                        src={doc.previewUrl}
                        alt={doc.name}
                        className="size-11 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                      />
                    ) : (
                      <div className="size-11 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <FileText className="size-5" />
                      </div>
                    )}
                    <div className="min-w-0 text-left">
                      <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {doc.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {doc.size ? (
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {formatFileSize(doc.size)}
                          </span>
                        ) : null}
                        <span className="text-zinc-300 dark:text-zinc-700">&bull;</span>
                        {doc.status === "uploading" ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            <Loader2 className="size-3 animate-spin" />
                            Uploading {doc.progress}%
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            Ready
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onRemoveAttachedDocument) {
                        onRemoveAttachedDocument(doc.id);
                      }
                      if (docs.length <= 1) {
                        setIsFilesDialogOpen(false);
                      }
                    }}
                    title="Remove this file"
                    className="size-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 text-zinc-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer with Add More & Done */}
            <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (docs.length >= 5) return;
                  uploadInputRef.current?.click();
                }}
                disabled={docs.length >= 5}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs",
                  docs.length >= 5
                    ? "opacity-50 cursor-not-allowed bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95",
                )}
              >
                <Plus className="size-3.5" />
                <span>Add More Files ({docs.length}/5)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFilesDialogOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
