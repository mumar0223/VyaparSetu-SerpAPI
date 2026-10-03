"use client";

import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";

interface DuplicateFileDialogProps {
  isOpen: boolean;
  fileName: string;
  onClose: () => void;
}

export function DuplicateFileDialog({
  isOpen,
  fileName,
  onClose,
}: DuplicateFileDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150 font-sans"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-sage/30 dark:border-zinc-800 p-5 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        {/* Close Icon */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-cream dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center text-center">
          <div className="size-11 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <AlertCircle className="size-5" />
          </div>

          <h3
            id="duplicate-dialog-title"
            className="text-[15px] font-semibold text-foreground"
          >
            Duplicate File Detected
          </h3>

          <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
            You have already uploaded{" "}
            <span className="font-semibold text-foreground break-all">
              &quot;{fileName}&quot;
            </span>
            . Duplicate files cannot be added to the same message.
          </p>

          {/* OK Action Button */}
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="mt-5 w-full py-2.5 px-4 rounded-xl bg-forest dark:bg-mint hover:bg-forest-deep dark:hover:bg-mint-light text-white dark:text-black font-semibold text-sm transition-all shadow-xs cursor-pointer active:scale-98"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
