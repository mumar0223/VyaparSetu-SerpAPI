"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function FloatingBotButton() {
  const pathname = usePathname();
  const { t } = useTranslation();

  // Hide on Landing page (/), Login/Signup pages, and AI Saathi pages
  const isExcluded =
    !pathname ||
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/signup/") ||
    pathname === "/ai-saathi" ||
    pathname.startsWith("/ai-saathi/") ||
    pathname.startsWith("/ai-saarthi");

  if (isExcluded) {
    return null;
  }

  const label = t("sidebar.aiSaathi", "AI Saathi");
  const askLabel = t("common.askAiSaathi", "Ask AI Saathi");

  return (
    <aside aria-label="AI Assistant Quick Access">
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 group select-none">
        <Link
          href="/ai-saathi"
          aria-label={`Open ${label}`}
          className="relative flex items-center justify-center size-13 sm:size-15 rounded-full bg-gradient-to-br from-white via-cream/80 to-sage/20 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 border-2 border-forest/20 dark:border-mint/30 shadow-xl shadow-forest/20 dark:shadow-emerald-950/40 backdrop-blur-md transition-all duration-300 ease-out hover:scale-110 active:scale-95 hover:shadow-2xl hover:shadow-forest/30 dark:hover:shadow-emerald-500/25 hover:border-forest/50 dark:hover:border-mint focus:outline-hidden focus-visible:ring-2 focus-visible:ring-forest dark:focus-visible:ring-mint"
        >
        {/* Soft Ambient Glow Ping */}
        <span
          className="absolute -inset-1 rounded-full bg-emerald-500/20 dark:bg-mint/15 blur-sm animate-pulse pointer-events-none"
          aria-hidden="true"
        />

        {/* Floating Bot Avatar Image */}
        <img
          src="/images/Floating Bot.png"
          alt={label}
          width={52}
          height={52}
          className="relative size-10.5 sm:size-12 object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
          loading="eager"
        />

        {/* Online Pulse Status Badge */}
        <span
          className="absolute -top-0.5 -right-0.5 flex size-3.5 sm:size-4 items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex size-2.5 sm:size-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950 shadow-xs" />
        </span>

        {/* Hover Tooltip / Speech Preview */}
        <div
          role="tooltip"
          className="absolute right-full mr-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full bg-forest dark:bg-zinc-800 text-white dark:text-zinc-100 text-xs font-semibold tracking-wide whitespace-nowrap shadow-xl border border-white/10 dark:border-zinc-700/60 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200 ease-out pointer-events-none flex items-center gap-1.5"
        >
          <Bot className="size-3 text-mint shrink-0" />
          <span>{askLabel}</span>
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 size-2 bg-forest dark:bg-zinc-800 rotate-45 border-r border-t border-white/10 dark:border-zinc-700/60" />
        </div>
      </Link>
    </div>
  </aside>
  );
}
