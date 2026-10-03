"use client";

import { useState, useEffect, useCallback } from "react";
import { HistorySidebar } from "@/components/chat/history-sidebar";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UserProfileDialog } from "@/components/profile/user-profile-dialog";
import {
  getActiveBusinessProfile,
  getAllConversations,
  deleteConversation as idbDeleteConversation,
  updateConversation as idbUpdateConversation,
  type BusinessProfile,
  type ConversationRecord,
} from "@/lib/db";
import { PanelLeftOpen, Store, Edit2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ConversationSummary } from "@/components/chat/types";

interface AppShellProps {
  children: React.ReactNode;
  activeView?: "chat" | "enterprise" | "credit" | "emi";
  activeChatId?: string | null;
}

export function AppShell({
  children,
  activeView = "enterprise",
  activeChatId = null,
}: AppShellProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsSidebarOpen(window.innerWidth >= 1024);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const list = await getAllConversations();
      setConversations(
        list.map((c) => ({
          id: c.id,
          title: c.title,
          pinned: c.pinned,
          createdAt: new Date(c.createdAt).toISOString(),
          updatedAt: new Date(c.updatedAt).toISOString(),
        }))
      );
      const profile = await getActiveBusinessProfile();
      setBusinessProfile(profile);
    } catch (err) {
      console.error("[AppShell] loadData error:", err);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleProfileUpdate = (e: any) => {
      setBusinessProfile(e.detail);
    };
    const handleProfileClear = () => {
      setBusinessProfile(null);
    };

    window.addEventListener("vyaparsetu:profile-updated", handleProfileUpdate);
    window.addEventListener("vyaparsetu:profile-cleared", handleProfileClear);

    return () => {
      window.removeEventListener("vyaparsetu:profile-updated", handleProfileUpdate);
      window.removeEventListener("vyaparsetu:profile-cleared", handleProfileClear);
    };
  }, [loadData]);

  const handleDeleteChat = async (id: string) => {
    await idbDeleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    await idbUpdateConversation(id, { title: newTitle });
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    await idbUpdateConversation(id, { pinned });
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned } : c))
    );
  };

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-transparent text-foreground font-sans">
      {/* ── Left-Side History Sidebar ── */}
      <HistorySidebar
        conversations={conversations}
        activeChatId={activeChatId}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onSelectChat={(id) => {
          router.push(`/c/${id}`);
        }}
        onNewChat={() => {
          router.push("/");
        }}
        onStartVoiceSession={() => {
          router.push("/?mode=voice");
        }}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onTogglePin={handleTogglePin}
        activeView={activeView as any}
      />

      {/* ── Top-Left Floating Controls (When Sidebar is Collapsed) ── */}
      {!isSidebarOpen && (
        <div className="fixed top-3 left-3 z-30 flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setIsSidebarOpen(true)}
            title="Open chat history"
            className="h-9 px-2.5 rounded-xl flex items-center gap-1.5 bg-white/80 dark:bg-card/80 backdrop-blur-md border border-sage/40 dark:border-border text-forest dark:text-foreground hover:bg-cream dark:hover:bg-muted shadow-xs transition-all cursor-pointer"
          >
            <PanelLeftOpen className="size-4 text-forest dark:text-mint" />
            <span className="text-xs font-semibold hidden sm:inline">Menu</span>
          </button>
        </div>
      )}

      {/* ── Top-Right Header: Language Dropdown + User Profile Button ── */}
      <div className="fixed top-3 right-3 md:right-6 z-30 flex items-center gap-2 pointer-events-auto select-none">
        <LanguageSwitcher variant="brand" />

        <button
          onClick={() => setIsProfileDialogOpen(true)}
          className="h-10 px-3.5 flex items-center gap-2 bg-white/90 dark:bg-card/90 backdrop-blur-md border border-sage/40 dark:border-border hover:border-mint rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer text-left group outline-hidden"
          title="Edit MSME Profile (व्यापार प्रोफ़ाइल)"
        >
          <div className="size-2 rounded-full bg-mint animate-pulse shrink-0" />
          <Store className="size-3.5 text-forest dark:text-mint shrink-0" />
          <span className="text-xs font-semibold text-forest dark:text-foreground max-w-[130px] sm:max-w-[220px] truncate">
            {businessProfile?.businessName
              ? `${businessProfile.businessName} • ${businessProfile.city || businessProfile.district}`
              : "Set MSME Profile"}
          </span>
          <Edit2 className="size-3 text-muted-foreground group-hover:text-forest dark:group-hover:text-mint transition-colors shrink-0" />
        </button>
      </div>

      {/* ── Main Page Viewport ── */}
      <div className="relative flex flex-1 flex-col h-full overflow-hidden min-w-0">
        {children}
      </div>

      {/* ── Single User Profile Dialog ── */}
      <UserProfileDialog
        isOpen={isProfileDialogOpen}
        onClose={() => setIsProfileDialogOpen(false)}
        currentProfile={businessProfile}
        onProfileSaved={(p) => setBusinessProfile(p)}
        onProfileCleared={() => setBusinessProfile(null)}
      />
    </div>
  );
}
