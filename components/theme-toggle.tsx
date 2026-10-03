"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Laptop } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`size-9 rounded-xl border border-sage/30 bg-cream/40 ${className}`} />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={`Switch to ${isDark ? "Light" : "Dark"} theme`}
      className={`size-9 rounded-xl border border-sage/30 bg-cream/50 hover:bg-cream dark:bg-zinc-800/60 dark:hover:bg-zinc-800 text-forest dark:text-mint flex items-center justify-center transition-colors cursor-pointer shrink-0 ${className}`}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
