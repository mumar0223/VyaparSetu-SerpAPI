"use client";

import {
  useState,
  useRef,
  useEffect,
  KeyboardEvent,
  ChangeEvent,
  DragEvent,
} from "react";
import {
  Plus,
  ArrowUp,
  AudioLines,
  X,
  FileText,
  FileSpreadsheet,
  File as GenericFileIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { DuplicateFileDialog } from "./duplicate-file-dialog";
import type { ChatAttachment } from "./types";

interface PendingAttachment {
  id: string;
  file?: File;
  uploadedName: string;
  savedName?: string;
  url?: string;
  type: "image" | "file";
  mimeType: string;
  size: number;
  progress: number;
  status: "uploading" | "completed" | "error";
  previewUrl?: string;
}

interface FloatingInputProps {
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
  onStartVoiceMode?: () => void;
  isLoading?: boolean;
  isCentered?: boolean;
  placeholder?: string;
}

export function FloatingInput({
  onSend,
  onStartVoiceMode,
  isLoading = false,
  isCentered = false,
  placeholder,
}: FloatingInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [duplicateFileName, setDuplicateFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const displayPlaceholder =
    placeholder ||
    t(
      "chat.placeholder",
      "Ask anything about mandi rates, mudra loans, or ledgers...",
    );

  const isAnyFileUploading = attachments.some((a) => a.status === "uploading");
  const canSend =
    !isLoading &&
    !isAnyFileUploading &&
    (input.trim().length > 0 || attachments.length > 0);

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180,
      )}px`;
    }
  }, [input]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []);

  // Auto-scroll attachment bar to right on new addition
  const scrollAttachmentsToEnd = () => {
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          left: scrollContainerRef.current.scrollWidth,
          behavior: "smooth",
        });
      }
    });
  };

  const handleFiles = async (filesList: FileList | File[]) => {
    const rawFiles = Array.from(filesList);
    if (!rawFiles.length) return;

    // Maximum 5 files check
    const currentCount = attachments.length;
    if (currentCount >= 5) {
      alert("Maximum 5 files can be attached at this time.");
      return;
    }

    const availableSlots = 5 - currentCount;
    const filesToProcess = rawFiles.slice(0, availableSlots);

    // Duplicate detection
    const validFiles: File[] = [];
    for (const f of filesToProcess) {
      const isDuplicate = attachments.some(
        (existing) =>
          existing.uploadedName.toLowerCase() === f.name.toLowerCase(),
      );
      if (isDuplicate) {
        setDuplicateFileName(f.name);
        return; // Halt and show duplicate dialog
      }
      validFiles.push(f);
    }

    if (!validFiles.length) return;

    // Read files locally into Base64 Data URLs with zero latency and no external cloud upload
    try {
      const processed: PendingAttachment[] = await Promise.all(
        validFiles.map((f, i) => {
          return new Promise<PendingAttachment>((resolve) => {
            const isImg = f.type.startsWith("image/");
            const reader = new FileReader();

            reader.onload = () => {
              const dataUrl = reader.result as string;
              resolve({
                id: `att_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                file: f,
                uploadedName: f.name,
                savedName: f.name,
                url: dataUrl,
                type: isImg ? "image" : "file",
                mimeType: f.type || "application/octet-stream",
                size: f.size,
                progress: 100,
                status: "completed",
                previewUrl: isImg ? dataUrl : undefined,
              });
            };

            reader.onerror = () => {
              resolve({
                id: `att_${Date.now()}_${i}`,
                file: f,
                uploadedName: f.name,
                type: isImg ? "image" : "file",
                mimeType: f.type || "application/octet-stream",
                size: f.size,
                progress: 0,
                status: "error",
              });
            };

            reader.readAsDataURL(f);
          });
        }),
      );

      setAttachments((prev) => [...prev, ...processed]);
      scrollAttachmentsToEnd();
    } catch (uploadError) {
      console.error("[Local File Read Error]:", uploadError);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleSubmit = () => {
    if (!canSend) return;

    const completedAttachments: ChatAttachment[] = attachments
      .filter((a) => a.status === "completed" && a.url)
      .map((a) => ({
        id: a.id,
        uploadedName: a.uploadedName,
        savedName: a.savedName || a.uploadedName,
        url: a.url!,
        type: a.type,
        mimeType: a.mimeType,
        size: a.size,
      }));

    onSend(
      input.trim(),
      completedAttachments.length > 0 ? completedAttachments : undefined,
    );

    // Clean up previews and reset
    attachments.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    });
    setAttachments([]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const startVoiceAgent = () => {
    if (!isLoading) onStartVoiceMode?.();
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileBadgeStyle = (mimeType: string, name: string) => {
    if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
      return {
        bg: "bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30",
        label: "PDF",
        icon: FileText,
      };
    }
    if (
      mimeType.includes("sheet") ||
      mimeType.includes("csv") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".csv")
    ) {
      return {
        bg: "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30",
        label: "Sheet",
        icon: FileSpreadsheet,
      };
    }
    return {
      bg: "bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30",
      label: "Document",
      icon: GenericFileIcon,
    };
  };

  return (
    <div className="w-full transition-all duration-300 ease-out z-20 font-sans">
      {/* Hidden File Picker */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*,application/pdf,text/plain,text/csv"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Duplicate File Alert Dialog */}
      <DuplicateFileDialog
        isOpen={Boolean(duplicateFileName)}
        fileName={duplicateFileName || ""}
        onClose={() => setDuplicateFileName(null)}
      />

      {/* Elevated Pill Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-2xl md:rounded-3xl border border-sage/25 dark:border-border bg-white/45 dark:bg-card/45 backdrop-blur-md p-2 shadow-lg transition-all focus-within:border-mint focus-within:ring-1 focus-within:ring-mint/40 focus-within:bg-white/65 dark:focus-within:bg-card/65",
          isDragOver && "border-mint ring-2 ring-mint/50 bg-mint/5",
        )}
      >
        <div className="flex flex-col">
          {/* ChatGPT-Style Horizontal Scroll Attachments Row */}
          {attachments.length > 0 && (
            <div
              ref={scrollContainerRef}
              className="flex items-center gap-2.5 overflow-x-auto pb-2 px-1 pt-1 scroll-smooth"
              style={{ scrollbarWidth: "thin" }}
            >
              {attachments.map((att) => {
                const isImage = att.type === "image";
                const badge = getFileBadgeStyle(att.mimeType, att.uploadedName);
                const BadgeIcon = badge.icon;
                const isUploading = att.status === "uploading";

                return isImage ? (
                  /* Image Thumbnail Tile */
                  <div
                    key={att.id}
                    className="relative group size-14 rounded-2xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 shadow-xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.previewUrl || att.url}
                      alt={att.uploadedName}
                      className={cn(
                        "w-full h-full object-cover transition-opacity duration-200",
                        isUploading ? "opacity-60 blur-2xs" : "opacity-100",
                      )}
                    />

                    {/* Centered Circular Upload Progress Ring */}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-3xs flex items-center justify-center">
                        <svg
                          className="size-7 -rotate-90"
                          viewBox="0 0 32 32"
                        >
                          <circle
                            cx="16"
                            cy="16"
                            r="12"
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.25)"
                            strokeWidth="2.5"
                          />
                          <circle
                            cx="16"
                            cy="16"
                            r="12"
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            strokeDasharray={75.4}
                            strokeDashoffset={
                              75.4 - (75.4 * (att.progress || 10)) / 100
                            }
                            strokeLinecap="round"
                            className="transition-all duration-150 ease-out"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Top-Right Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      title="Remove attachment"
                      className="absolute top-1 right-1 size-4.5 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center shadow-xs transition-transform active:scale-90 cursor-pointer z-10"
                    >
                      <X className="size-3 stroke-[2.5]" />
                    </button>
                  </div>
                ) : (
                  /* File / Document Pill Card */
                  <div
                    key={att.id}
                    className="relative group h-14 pl-2.5 pr-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex items-center gap-3 shrink-0 max-w-[240px] select-none"
                  >
                    {/* Left Icon / Progress Box */}
                    <div
                      className={cn(
                        "size-9.5 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden",
                        badge.bg,
                      )}
                    >
                      {isUploading ? (
                        <svg
                          className="size-6 -rotate-90"
                          viewBox="0 0 32 32"
                        >
                          <circle
                            cx="16"
                            cy="16"
                            r="12"
                            fill="none"
                            stroke="currentColor"
                            strokeOpacity="0.25"
                            strokeWidth="2.5"
                          />
                          <circle
                            cx="16"
                            cy="16"
                            r="12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeDasharray={75.4}
                            strokeDashoffset={
                              75.4 - (75.4 * (att.progress || 10)) / 100
                            }
                            strokeLinecap="round"
                            className="transition-all duration-150 ease-out"
                          />
                        </svg>
                      ) : (
                        <BadgeIcon className="size-4.5" />
                      )}
                    </div>

                    {/* Filename and Subtitle */}
                    <div className="min-w-0 flex flex-col justify-center">
                      <span className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[130px]">
                        {att.uploadedName}
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                        {isUploading
                          ? "Uploading..."
                          : `${badge.label}${att.size ? ` • ${formatFileSize(att.size)}` : ""}`}
                      </span>
                    </div>

                    {/* Top-Right Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      title="Remove attachment"
                      className="absolute -top-1 -right-1 size-4.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-xs transition-transform active:scale-90 cursor-pointer z-10"
                    >
                      <X className="size-3 stroke-[2.5]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Main Input Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={displayPlaceholder}
            className="w-full resize-none bg-transparent px-3 py-2 text-[14px] sm:text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-hidden min-h-[44px] max-h-[180px]"
          />

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between pt-1 px-1">
            {/* Left Actions: Attach */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || attachments.length >= 5}
                title={
                  attachments.length >= 5
                    ? "Maximum 5 attachments reached"
                    : "Attach images, PDFs, or documents"
                }
                className={cn(
                  "size-8 rounded-full flex items-center justify-center transition-colors cursor-pointer",
                  attachments.length >= 5
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-cream dark:hover:bg-muted",
                )}
              >
                <Plus className="size-4" />
              </button>
            </div>

            {/* Right Actions: Live Voice Agent & Send */}
            <div className="flex items-center gap-2">
              {/* Gemini Live Voice Agent Trigger */}
              <button
                type="button"
                onClick={startVoiceAgent}
                disabled={isLoading}
                aria-label="Start live voice agent"
                title={t("common.voiceAgent", "Voice Agent OS")}
                className="h-8 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 bg-mint-pale dark:bg-mint/15 hover:bg-mint/25 text-forest dark:text-mint border border-mint/30 hover:border-mint/50 transition-all cursor-pointer shadow-xs active:scale-95 group"
              >
                <AudioLines className="size-3.5 text-mint group-hover:scale-110 transition-transform animate-pulse" />
                <span className="text-[11.5px] sm:text-[12px] font-semibold tracking-tight">
                  {t("common.voiceAgent", "Voice Agent OS")}
                </span>
              </button>

              {/* Send Button: Disabled during file upload */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                title={
                  isAnyFileUploading
                    ? "Please wait for files to finish uploading"
                    : isLoading
                    ? "AI is generating a response..."
                    : "Send message"
                }
                className={cn(
                  "size-8 rounded-full flex items-center justify-center transition-all cursor-pointer",
                  canSend
                    ? "bg-forest dark:bg-mint hover:bg-forest-deep dark:hover:bg-mint-light text-white dark:text-black shadow-md scale-100"
                    : "bg-sage/20 dark:bg-muted text-muted-foreground cursor-not-allowed opacity-50",
                )}
              >
                <ArrowUp className="size-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Footer Disclaimer */}
      <p className="mt-2 text-center text-[11px] text-muted-foreground select-none">
        {t(
          "chat.disclaimer",
          "VyaparSetu AI can make mistakes. Verify important financial & trade decisions.",
        )}
      </p>
    </div>
  );
}
