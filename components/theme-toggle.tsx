"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({
  className = "",
  variant = "button",
}: {
  className?: string;
  variant?: "button" | "row";
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (variant === "row") {
      return (
        <div
          className={`w-full h-10 rounded-xl border border-sage/20 dark:border-border/70 bg-white/40 dark:bg-card/40 ${className}`}
        />
      );
    }
    return (
      <div
        className={`size-9 rounded-xl border border-sage/30 bg-cream/40 ${className}`}
      />
    );
  }

  const isDark = theme === "dark";

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        title={`Switch to ${isDark ? "Light" : "Dark"} theme`}
        className={`w-full h-10 px-3 rounded-xl border border-sage/30 dark:border-border/80 bg-white/70 dark:bg-zinc-900/70 hover:bg-white dark:hover:bg-zinc-800 text-foreground flex items-center justify-between transition-all cursor-pointer shadow-2xs group select-none ${className}`}
      >
        <div className="flex items-center gap-2.5">
          {isDark ? (
            <Moon className="size-4 text-mint transition-transform group-hover:scale-110" />
          ) : (
            <Sun className="size-4 text-amber-500 transition-transform group-hover:scale-110" />
          )}
          <span className="text-[12.5px] font-semibold text-foreground tracking-tight">
            {isDark ? "Dark Theme" : "Light Theme"}
          </span>
        </div>

        {/* Sleek Toggle Switch Pill */}
        <div
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out p-0.5 ${
            isDark ? "bg-forest dark:bg-mint/40" : "bg-sage/40"
          }`}
        >
          <span
            className={`inline-block size-4 transform rounded-full bg-white dark:bg-mint shadow-xs transition duration-200 ease-in-out ${
              isDark ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={`Switch to ${isDark ? "Light" : "Dark"} theme`}
      className={`size-9 rounded-xl border border-sage/30 bg-cream/50 hover:bg-cream dark:bg-zinc-800/60 dark:hover:bg-zinc-800 text-forest dark:text-mint flex items-center justify-center transition-colors cursor-pointer shrink-0 ${className}`}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
