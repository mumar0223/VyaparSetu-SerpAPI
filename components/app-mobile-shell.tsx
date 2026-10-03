"use client";

import React from "react";
import { AppBackground } from "@/components/app-background";

interface AppMobileShellProps {
  children: React.ReactNode;
}

export function AppMobileShell({ children }: AppMobileShellProps) {
  return (
    <div className="fixed inset-0 flex h-dvh w-full overflow-hidden bg-cream dark:bg-background font-sans antialiased text-foreground">
      {/* ── Fixed Animated Hexagonal Grid Background ── */}
      <AppBackground />

      {/* Main Content (Edge to Edge Full Viewport) */}
      <main className="flex-1 h-full w-full overflow-hidden bg-transparent text-foreground relative z-10 flex flex-col">
        {children}
      </main>
    </div>
  );
}
