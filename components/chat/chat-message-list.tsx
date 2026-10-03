"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  Check,
  Volume2,
  VolumeX,
  AudioLines,
  FileCheck,
  ArrowUpRight,
  PieChart,
  BarChart3,
  IndianRupee,
  Layers,
  Target,
  Landmark,
  AlertTriangle,
  ClipboardList,
  Eye,
  Maximize2,
  FileText,
  Download,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThinkingAccordion } from "./thinking-accordion";
import { SwarmTabsCard } from "./swarm-tabs-card";
import { MarkdownMessage } from "./markdown-message";
import type { ChatMessage, ToolCallItem } from "./types";
import type { ArtifactPayload } from "./artifact-modal";
import { useTranslation } from "@/lib/i18n";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onOpenArtifact?: (artifact: ArtifactPayload) => void;
}

interface ExtractedAttachmentItem {
  id?: string;
  url: string;
  uploadedName: string;
  mimeType?: string;
  size?: number;
}

function getParsedAttachments(msg: ChatMessage): {
  images: ExtractedAttachmentItem[];
  files: ExtractedAttachmentItem[];
} {
  const images: ExtractedAttachmentItem[] = [];
  const files: ExtractedAttachmentItem[] = [];
  const seenUrls = new Set<string>();

  // 1. Check msg.attachments
  if (Array.isArray(msg.attachments)) {
    for (const att of msg.attachments) {
      if (att && att.url && !seenUrls.has(att.url)) {
        seenUrls.add(att.url);
        const typeStr = (att.type || "").toUpperCase();
        const fileName = att.name || att.uploadedName || "";
        const isImg =
          typeStr === "IMAGE" ||
          att.mimeType?.startsWith("image/") ||
          /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(fileName || att.url);
        const item: ExtractedAttachmentItem = {
          id: att.id,
          url: att.url,
          uploadedName: fileName || (isImg ? "Image" : "Document"),
          mimeType: att.mimeType,
          size: att.size,
        };
        if (isImg) images.push(item);
        else files.push(item);
      }
    }
  }

  // 2. Check msg.files (which might be JSON serialized or raw URLs)
  if (Array.isArray(msg.files)) {
    for (let idx = 0; idx < msg.files.length; idx++) {
      const f = msg.files[idx];
      if (typeof f !== "string" || !f.trim()) continue;

      let parsed: any = null;
      try {
        parsed = JSON.parse(f);
      } catch {
        // raw url string
      }

      if (parsed && typeof parsed === "object" && parsed.url) {
        if (!seenUrls.has(parsed.url)) {
          seenUrls.add(parsed.url);
          const typeStr = (parsed.type || "").toUpperCase();
          const fileName = parsed.name || parsed.uploadedName || "";
          const mime = parsed.mimeType || "";
          const isImg =
            typeStr === "IMAGE" ||
            mime.startsWith("image/") ||
            /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(fileName || parsed.url);
          const item: ExtractedAttachmentItem = {
            id: parsed.id || `att_${idx}`,
            url: parsed.url,
            uploadedName: fileName || (isImg ? "Image" : "Document"),
            mimeType: mime || undefined,
            size: parsed.size,
          };
          if (isImg) images.push(item);
          else files.push(item);
        }
        continue;
      }

      const url = f.trim();
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        const isImg = /\.(jpeg|jpg|png|gif|webp|svg)/i.test(url);
        const name = url.split("/").pop() || "Document";
        const item: ExtractedAttachmentItem = {
          url,
          uploadedName: name,
        };
        if (isImg) images.push(item);
        else files.push(item);
      }
    }
  }

  // 3. Check tool calls (captured document scans)
  if (Array.isArray(msg.toolCalls)) {
    for (const tc of msg.toolCalls as any[]) {
      const isDoc =
        tc?.type === "captured_document" ||
        tc?.toolName === "captured_document" ||
        tc?.toolName === "captureDocument" ||
        tc?.name === "captureDocument";
      const docUrl =
        tc?.url ||
        tc?.result?.url ||
        tc?.result?.savedImageUrl ||
        (typeof tc?.result === "object" && tc?.result?.savedImageUrl);

      if (isDoc && docUrl && typeof docUrl === "string") {
        if (!seenUrls.has(docUrl)) {
          seenUrls.add(docUrl);
          images.push({
            url: docUrl,
            uploadedName: "Document Scan",
          });
        }
      }
    }
  }

  return { images, files };
}

function chunkImageRows(
  items: ExtractedAttachmentItem[],
): ExtractedAttachmentItem[][] {
  const rows: ExtractedAttachmentItem[][] = [];
  const maxCols = 3;
  for (let i = 0; i < items.length; i += maxCols) {
    rows.push(items.slice(i, i + maxCols));
  }
  return rows;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatMessageList({
  messages,
  isLoading = false,
  onOpenArtifact,
}: ChatMessageListProps) {
  const { t } = useTranslation();
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null,
  );
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<
    string | null
  >(null);

  // Clean up speech synthesis when unmounting
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleSpeak = (msgId: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown symbols for cleaner speech
    const cleanText = text
      .replace(/[\#\*\`\$\_\[\]\(\)]/g, "")
      .replace(/\n+/g, " ");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col space-y-6 w-full font-sans">
      {messages.map((msg, index) => {
        const isSystem = msg.role === "system";
        const isUser = msg.role === "user";

        if (isSystem) {
          return (
            <div
              key={msg.id || index}
              className="w-full flex items-center justify-center my-4 animate-in fade-in-50 select-none"
            >
              <div className="w-full max-w-sm flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-mint-pale dark:bg-mint/10 border border-mint/30 text-forest dark:text-mint shadow-2xs">
                <div className="flex items-center gap-2">
                  <AudioLines className="size-4 text-mint animate-pulse" />
                  <span className="text-[12.5px] font-medium">
                    Voice Agent OS Session
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-mint/20 text-forest dark:text-mint border border-mint/30">
                  Live
                </span>
              </div>
            </div>
          );
        }

        // Extract attachments (images & documents) directly from DB records
        const { images, files } = getParsedAttachments(msg);
        let userDisplayText = msg.content;
        if (typeof userDisplayText === "string") {
          const docMatch = userDisplayText.match(
            /^\[Captured Document Image:\s*(.*)\]$/,
          );
          if (docMatch) {
            const rawTag = docMatch[1]?.trim();
            if (
              !rawTag ||
              rawTag.toLowerCase() === "document scan" ||
              rawTag.toLowerCase() === "captured document"
            ) {
              userDisplayText = "";
            } else {
              userDisplayText = rawTag;
            }
          }
        }

        const imageRows = chunkImageRows(images);
        const isCompact = images.length > 6;

        // Extract ONLY visual staged document artifacts and charts/forms (e.g. stageDocument, stageForm, stageChart)
        // All swarm intelligence sub-agents (Radar, Mandi, SWOT, Schemes, Credit, ONDC, District, Custom Research)
        // are strictly rendered inside SwarmTabsCard and must never leak as duplicate inline documents!
        const artifacts: ArtifactPayload[] = [];
        (msg.toolCalls || []).forEach((tc) => {
          if (!tc.toolName.startsWith("stage")) {
            return;
          }
          const res = tc.result as any;
          if (res?.isArtifact && res?.data) {
            artifacts.push({
              artifactId:
                res.artifactId || res.data?.artifactId || tc.toolCallId,
              targetArtifactId: res.targetArtifactId,
              isUpdated: res.isUpdated,
              artifactType: res.artifactType || "document",
              title: res.title || res.data?.title || tc.summary,
              summary: res.summary || res.data?.summary,
              data: res.data,
            });
          }
        });

        return (
          <div
            key={msg.id || index}
            className={cn(
              "flex flex-col w-full animate-in fade-in-50 duration-200",
              isUser ? "items-end" : "items-start",
            )}
          >
            {isUser ? (
              /* User Message Bubble */
              <div className="max-w-[85%] md:max-w-xl flex flex-col items-end gap-2.5">
                {/* 1. Attached Images Grid (Max 3 columns, right-aligned, 60% compact scaling for > 6) */}
                {images.length > 0 && (
                  <div className="flex flex-col gap-2.5 w-full items-end">
                    {images.length === 1 ? (
                      /* Single Featured Image Card */
                      <div
                        onClick={() => setSelectedLightboxImage(images[0].url)}
                        className="group relative rounded-3xl overflow-hidden border border-sage/40 dark:border-zinc-800 bg-black/10 dark:bg-card/60 shadow-sm hover:shadow-md transition-all cursor-pointer w-full max-w-[320px] aspect-square select-none"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={images[0].url}
                          alt={images[0].uploadedName}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                          <span className="text-xs font-medium text-white flex items-center gap-1.5 truncate max-w-[220px]">
                            <Eye className="size-3.5" />
                            {images[0].uploadedName}
                          </span>
                          <Maximize2 className="size-3.5 text-white/90 shrink-0" />
                        </div>
                      </div>
                    ) : (
                      /* Multiple Images: 3-Column Max Rows (Flush to the Right Edge) */
                      imageRows.map((row, rIdx) => (
                        <div
                          key={rIdx}
                          className="flex justify-end gap-2.5 w-full"
                        >
                          {row.map((img, i) => (
                            <div
                              key={i}
                              onClick={() => setSelectedLightboxImage(img.url)}
                              className={cn(
                                "group relative overflow-hidden border border-sage/40 dark:border-zinc-800 bg-black/10 dark:bg-card/60 shadow-2xs hover:shadow-md transition-all cursor-pointer shrink-0 select-none",
                                isCompact
                                  ? "size-18 sm:size-20 rounded-xl"
                                  : "size-28 sm:size-32 rounded-2xl",
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img.url}
                                alt={img.uploadedName}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="size-4 text-white drop-shadow-md" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 2. Attached Files & Documents (Vertical Stack) */}
                {files.length > 0 && (
                  <div className="flex flex-col gap-2 w-full max-w-sm ml-auto items-end">
                    {files.map((file, fIdx) => {
                      const isPdf =
                        file.mimeType === "application/pdf" ||
                        file.uploadedName.toLowerCase().endsWith(".pdf");
                      const isSheet =
                        file.mimeType?.includes("sheet") ||
                        file.mimeType?.includes("csv") ||
                        file.uploadedName.toLowerCase().endsWith(".xlsx") ||
                        file.uploadedName.toLowerCase().endsWith(".csv");

                      const badgeBg = isPdf
                        ? "bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30"
                        : isSheet
                          ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"
                          : "bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30";

                      const badgeLabel = isPdf
                        ? "PDF"
                        : isSheet
                          ? "Sheet"
                          : "Document";

                      return (
                        <a
                          key={fIdx}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={file.uploadedName}
                          className="w-full pl-3 pr-3.5 py-2.5 rounded-2xl border border-sage/30 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-mint dark:hover:border-mint/60 transition-all flex items-center justify-between gap-3 shadow-xs hover:shadow-md group select-none text-left"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                "size-9 rounded-xl border flex items-center justify-center shrink-0",
                                badgeBg,
                              )}
                            >
                              <FileText className="size-4.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[12.5px] font-semibold text-foreground truncate max-w-[200px] group-hover:text-mint transition-colors">
                                {file.uploadedName}
                              </p>
                              <p className="text-[10px] text-muted-foreground uppercase font-medium">
                                {badgeLabel}
                                {file.size
                                  ? ` • ${formatFileSize(file.size)}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <Download className="size-4 text-muted-foreground group-hover:text-mint transition-colors shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* 3. Text Message Bubble */}
                {userDisplayText ? (
                  <div className="rounded-3xl bg-forest dark:bg-card dark:border dark:border-border px-4 py-3 text-[14px] sm:text-[15px] leading-relaxed text-white dark:text-foreground shadow-xs">
                    <MarkdownMessage content={userDisplayText} variant="user" />
                  </div>
                ) : null}
              </div>
            ) : (
              /* Assistant Message */
              <div className="w-full text-foreground text-[14px] sm:text-[15px] leading-relaxed">
                {/* Thinking Loader / Dynamic Tool Accordion */}
                <ThinkingAccordion
                  isStreaming={Boolean(msg.isStreaming)}
                  toolCalls={msg.toolCalls}
                  completedDurationSeconds={msg.thoughtDurationSeconds}
                />

                {/* Sub-Agent Swarm Intelligence Tabs & Visual Domain View */}
                {Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
                  <SwarmTabsCard
                    toolCalls={msg.toolCalls}
                    onOpenArtifact={onOpenArtifact}
                  />
                )}

                {/* Sleek Claude-Style Interactive Artifact Pill or Inline Document */}
                {artifacts.length > 0 && (
                  <div className="my-3 space-y-2.5 w-full">
                    {artifacts.map((art, aIdx) => {
                      if (art.artifactType === "document") {
                        if (art.data?.content) {
                          return (
                            <div key={aIdx} className="my-2.5 w-full">
                              <MarkdownMessage
                                content={art.data.content}
                                variant="assistant"
                                isStreaming={Boolean(msg.isStreaming)}
                              />
                            </div>
                          );
                        }
                        return null;
                      }

                      if (art.artifactType === "chart") {
                        return null;
                      }

                      return (
                        <div
                          key={aIdx}
                          onClick={() => onOpenArtifact?.(art)}
                          className="max-w-md p-3 rounded-2xl border border-sage/40 dark:border-zinc-800 bg-white dark:bg-[#18181b]/95 hover:border-mint dark:hover:border-mint/60 flex items-center justify-between gap-3 transition-all cursor-pointer group shadow-xs hover:shadow-md select-none"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-9 rounded-xl bg-mint-pale/60 dark:bg-zinc-800 border border-mint/20 dark:border-zinc-700 text-forest dark:text-mint flex items-center justify-center shrink-0">
                              {art.artifactType === "budget" && (
                                <PieChart className="size-4" />
                              )}
                              {art.artifactType === "expense" && (
                                <IndianRupee className="size-4" />
                              )}
                              {art.artifactType === "transaction" && (
                                <Layers className="size-4" />
                              )}
                              {art.artifactType === "saving_goal" && (
                                <Target className="size-4" />
                              )}
                              {art.artifactType === "debt" && (
                                <Landmark className="size-4" />
                              )}
                              {art.artifactType === "form" && (
                                <ClipboardList className="size-4" />
                              )}
                              {art.artifactType === "delete_record" && (
                                <AlertTriangle className="size-4 text-rose-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-[13.5px] font-semibold text-forest dark:text-zinc-100 group-hover:text-mint transition-colors truncate">
                                  {art.title ||
                                    t(
                                      "chat.stagedDraft",
                                      "Interactive Action Draft",
                                    )}
                                </h4>
                                {art.isUpdated && (
                                  <span className="text-[9.5px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-mint/20 text-forest dark:text-mint border border-mint/30 shrink-0">
                                    Updated
                                  </span>
                                )}
                              </div>
                              <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                                {art.summary ||
                                  (art.isUpdated
                                    ? "Draft updated • Click to review changes"
                                    : t(
                                        "chat.clickToReview",
                                        "Draft prepared • Click to review & edit",
                                      ))}
                              </p>
                            </div>
                          </div>

                          <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-mint group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Rich Markdown Message Content (LaTeX, GFM Tables, Code) */}
                {msg.content && (
                  <MarkdownMessage
                    content={msg.content}
                    variant="assistant"
                    isStreaming={Boolean(msg.isStreaming)}
                  />
                )}

                {/* Assistant Action Bar: Copy & Speak Aloud only */}
                {!msg.isStreaming && msg.content && (
                  <div className="mt-3 flex items-center gap-1.5 text-muted-foreground select-none">
                    <CopyButton text={msg.content} />
                    <SpeakButton
                      isSpeaking={speakingMessageId === msg.id}
                      onToggle={() => handleToggleSpeak(msg.id, msg.content)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <ImageLightboxModal
        imageUrl={selectedLightboxImage}
        onClose={() => setSelectedLightboxImage(null)}
      />
    </div>
  );
}

function ImageLightboxModal({
  imageUrl,
  onClose,
}: {
  imageUrl: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!imageUrl) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[92vh] flex flex-col bg-zinc-950/95 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-mint" />
            <span className="text-sm font-semibold text-zinc-100">
              Document Scan Preview
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              download="scanned-document.jpg"
              title="Download original scan"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <Download className="size-3.5 text-mint" />
              <span>Download</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              title="Close preview"
              className="size-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* High-Resolution Document Image Viewport */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Scanned Document Preview"
            className="max-h-[78vh] w-auto max-w-full object-contain rounded-lg border border-zinc-800/80 shadow-lg"
          />
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy"}
      className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-cream dark:hover:bg-muted transition-colors cursor-pointer"
    >
      {copied ? (
        <Check className="size-4 text-mint" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}

function SpeakButton({
  isSpeaking,
  onToggle,
}: {
  isSpeaking: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isSpeaking ? "Stop reading" : "Read aloud"}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-lg transition-colors cursor-pointer",
        isSpeaking
          ? "text-mint bg-mint/15 hover:bg-mint/25"
          : "text-muted-foreground hover:text-foreground hover:bg-cream dark:hover:bg-muted",
      )}
    >
      {isSpeaking ? (
        <VolumeX className="size-4 text-mint animate-pulse" />
      ) : (
        <Volume2 className="size-4" />
      )}
    </button>
  );
}
