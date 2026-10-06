"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MessageSquare,
  Plus,
  Pin,
  PinOff,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  PanelLeftClose,
  MoreHorizontal,
  AudioLines,
  Building2,
  CreditCard,
  Calculator,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "./types";
import { useTranslation } from "@/lib/i18n";

interface HistorySidebarProps {
  conversations: ConversationSummary[];
  activeChatId?: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onStartVoiceSession?: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  activeView?: "chat" | "enterprise";
  onOpenEnterprise?: () => void;
}

export function HistorySidebar({
  conversations,
  activeChatId,
  isOpen,
  onToggle,
  onSelectChat,
  onNewChat,
  onStartVoiceSession,
  onDeleteChat,
  onRenameChat,
  onTogglePin,
  activeView = "chat",
  onOpenEnterprise,
}: HistorySidebarProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const startRename = (conv: ConversationSummary, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editTitle.trim()) {
      onRenameChat(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  // Filter conversations by search query
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedChats = filtered.filter((c) => c.pinned);
  const recentChats = filtered.filter((c) => !c.pinned);

  const pathname = usePathname();
  const isEnterpriseActive = pathname === "/enterprise" || activeView === "enterprise";
  const isCreditActive = pathname === "/credit";
  const isEmiActive = pathname === "/emi";

  const renderContent = (isMobileSheet: boolean = false) => (
    <div className="w-full h-full flex flex-col shrink-0">
      {/* Top Header */}
      <div className="flex flex-col gap-2 p-3 border-b border-sage/20 dark:border-border">
        <div className="flex h-9 items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              if (isMobileSheet) onToggle();
            }}
            className={cn(
              "flex flex-1 h-9 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition-colors cursor-pointer border shadow-2xs",
              pathname === "/" && !activeChatId && activeView !== "enterprise"
                ? "bg-mint-pale dark:bg-mint/15 text-forest dark:text-mint border-mint/40"
                : "bg-cream dark:bg-muted hover:bg-mint-pale dark:hover:bg-muted/80 text-forest dark:text-foreground border-sage/40 dark:border-border"
            )}
          >
            <Plus className="size-4 text-forest dark:text-mint" />
            <span>{t("history.newChat", "New chat")}</span>
          </button>

          <button
            onClick={onToggle}
            title={t("history.closeHistory", "Close chat history")}
            className="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-cream dark:hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-sage/30"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        {/* Navigation Hub Links */}
        <div className="space-y-1 pt-0.5">
          {/* 1. Enterprise Hub Link */}
          <Link
            href="/enterprise"
            onClick={() => {
              if (onOpenEnterprise) onOpenEnterprise();
              if (isMobileSheet) onToggle();
            }}
            className={cn(
              "flex items-center gap-2.5 w-full h-9 px-3 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer border select-none",
              isEnterpriseActive
                ? "bg-forest dark:bg-mint text-white dark:text-black border-transparent font-bold shadow-xs"
                : "bg-white/70 dark:bg-card/70 hover:bg-cream dark:hover:bg-muted text-forest dark:text-foreground border-sage/30 dark:border-border shadow-2xs"
            )}
          >
            <Building2 className={cn("size-3.5 shrink-0", isEnterpriseActive ? "text-mint dark:text-black" : "text-mint")} />
            <span className="truncate">Enterprise Hub (व्यापार हब)</span>
          </Link>

          {/* 2. Dedicated Credit Score Advisor Link */}
          <Link
            href="/credit"
            onClick={() => {
              if (isMobileSheet) onToggle();
            }}
            className={cn(
              "flex items-center gap-2.5 w-full h-9 px-3 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer border select-none",
              isCreditActive
                ? "bg-forest dark:bg-mint text-white dark:text-black border-transparent font-bold shadow-xs"
                : "bg-white/70 dark:bg-card/70 hover:bg-cream dark:hover:bg-muted text-forest dark:text-foreground border-sage/30 dark:border-border shadow-2xs"
            )}
          >
            <CreditCard className={cn("size-3.5 shrink-0", isCreditActive ? "text-mint dark:text-black" : "text-forest dark:text-mint")} />
            <span className="truncate">Credit Score & CIBIL (क्रेडिट)</span>
          </Link>

          {/* 3. Dedicated EMI & Loan Simulator Link */}
          <Link
            href="/emi"
            onClick={() => {
              if (isMobileSheet) onToggle();
            }}
            className={cn(
              "flex items-center gap-2.5 w-full h-9 px-3 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer border select-none",
              isEmiActive
                ? "bg-forest dark:bg-mint text-white dark:text-black border-transparent font-bold shadow-xs"
                : "bg-white/70 dark:bg-card/70 hover:bg-cream dark:hover:bg-muted text-forest dark:text-foreground border-sage/30 dark:border-border shadow-2xs"
            )}
          >
            <Calculator className={cn("size-3.5 shrink-0", isEmiActive ? "text-mint dark:text-black" : "text-orange")} />
            <span className="truncate">EMI & Loan Simulator (ईएमआई)</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 pt-2.5 pb-1">
        <div
          className={cn(
            "flex h-9 items-center gap-2 rounded-xl border border-sage/20 dark:border-border px-2.5 text-[12.5px] text-foreground",
            isMobileSheet
              ? "bg-cream dark:bg-muted/70"
              : "bg-white/40 dark:bg-card/40"
          )}
        >
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("history.searchPlaceholder", "Search chats...")}
            className="w-full bg-transparent focus:outline-hidden text-[12.5px] text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Gemini Live Voice Session Trigger */}
      <div className="px-3 pt-1 pb-1">
        <button
          onClick={() => {
            onStartVoiceSession?.();
            if (isMobileSheet) onToggle();
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-mint-pale dark:bg-mint/10 hover:bg-mint/20 border border-mint/30 dark:border-mint/25 text-forest dark:text-mint transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center gap-2">
            <AudioLines className="size-4 text-mint group-hover:scale-110 transition-transform animate-pulse" />
            <span className="text-[12.5px] font-semibold">{t("history.voiceAgent", "Voice Agent OS")}</span>
          </div>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-mint/20 text-forest dark:text-mint border border-mint/30">
            {t("history.liveBadge", "Live")}
          </span>
        </button>
      </div>

      {/* Scrollable Conversation List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-4">
        {/* Pinned Section */}
        {pinnedChats.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Pin className="size-3 text-mint" />
              <span>{t("history.pinned", "Pinned")}</span>
            </div>
            <ul className="flex flex-col gap-0.5">
              {pinnedChats.map((c) => (
                <ChatItem
                  key={c.id}
                  conversation={c}
                  isActive={c.id === activeChatId}
                  isEditing={editingId === c.id}
                  editTitle={editTitle}
                  setEditTitle={setEditTitle}
                  onSelect={() => {
                    onSelectChat(c.id);
                    if (isMobileSheet) onToggle();
                  }}
                  onStartRename={(e) => startRename(c, e)}
                  onSaveRename={(e) => saveRename(c.id, e)}
                  onCancelRename={cancelRename}
                  onDelete={() => onDeleteChat(c.id)}
                  onTogglePin={() => onTogglePin(c.id, !c.pinned)}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Recents Section */}
        <div>
          <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("history.recents", "Recents")}
          </div>
          {recentChats.length === 0 && pinnedChats.length === 0 ? (
            <div className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">
              {t("history.noHistory", "No chat history yet")}
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {recentChats.map((c) => (
                <ChatItem
                  key={c.id}
                  conversation={c}
                  isActive={c.id === activeChatId}
                  isEditing={editingId === c.id}
                  editTitle={editTitle}
                  setEditTitle={setEditTitle}
                  onSelect={() => {
                    onSelectChat(c.id);
                    if (isMobileSheet) onToggle();
                  }}
                  onStartRename={(e) => startRename(c, e)}
                  onSaveRename={(e) => saveRename(c.id, e)}
                  onCancelRename={cancelRename}
                  onDelete={() => onDeleteChat(c.id)}
                  onTogglePin={() => onTogglePin(c.id, !c.pinned)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop Inline Collapsible History Sidebar (>= 1024px, Left-Docked) ── */}
      <aside
        className={cn(
          "hidden lg:flex shrink-0 flex-col border-r border-sage/20 dark:border-border bg-white/35 dark:bg-card/35 h-full select-none overflow-hidden font-sans",
          mounted && "transition-[width] duration-300 ease-in-out",
          isOpen ? "w-[260px]" : "w-0 border-r-0"
        )}
      >
        <div className="w-[260px] h-full flex flex-col shrink-0">
          {renderContent(false)}
        </div>
      </aside>

      {/* ── Mobile & Tablet Slide-Over Sheet (< 1024px, Slide from Left) ── */}
      {isOpen &&
        mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden font-sans select-none animate-in fade-in-0 duration-200">
            {/* Frosted Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity cursor-pointer"
              onClick={onToggle}
            />

            {/* Sliding Sheet Drawer */}
            <aside className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] h-full h-[100dvh] bg-white dark:bg-zinc-950 border-r border-sage/30 dark:border-border shadow-2xl flex flex-col animate-in slide-in-from-left duration-250 z-10">
              {renderContent(true)}
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}

interface ChatItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (val: string) => void;
  onSelect: () => void;
  onStartRename: (e?: React.MouseEvent) => void;
  onSaveRename: (e?: React.MouseEvent) => void;
  onCancelRename: (e?: React.MouseEvent) => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

function ChatItem({
  conversation,
  isActive,
  isEditing,
  editTitle,
  setEditTitle,
  onSelect,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
  onTogglePin,
}: ChatItemProps) {
  const { t } = useTranslation();
  return (
    <li className="relative group">
      {isEditing ? (
        <div className="flex items-center gap-1 px-2.5 py-1.5 bg-cream dark:bg-muted rounded-lg border border-sage/40">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full bg-transparent text-[13px] text-foreground focus:outline-hidden"
            autoFocus
          />
          <button
            onClick={onSaveRename}
            className="size-5 rounded flex items-center justify-center text-forest dark:text-mint hover:bg-mint-pale cursor-pointer"
          >
            <Check className="size-3.5" />
          </button>
          <button
            onClick={onCancelRename}
            className="size-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div
          onClick={onSelect}
          className={cn(
            "flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-[13px] transition-colors cursor-pointer leading-tight",
            isActive
              ? "bg-cream dark:bg-muted text-forest dark:text-mint font-semibold"
              : "text-muted-foreground hover:bg-cream/60 dark:hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <MessageSquare className="size-3.5 shrink-0 opacity-60" />
            <span className="truncate text-[13px]">{conversation.title}</span>
          </div>

          {/* Right Action Icons */}
          <div
            className={cn(
              "flex items-center gap-1 shrink-0",
              isActive || conversation.pinned
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pin Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              title={conversation.pinned ? "Unpin chat" : "Pin chat"}
              className={cn(
                "size-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-cream dark:hover:bg-muted cursor-pointer transition-colors",
                conversation.pinned && "text-mint font-bold"
              )}
            >
              <Pin className="size-3.5" />
            </button>

            {/* Shadcn Dropdown Menu for More Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="size-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-cream dark:hover:bg-muted cursor-pointer transition-colors outline-hidden"
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={4}
                className="w-38 rounded-xl bg-white dark:bg-card border border-sage/30 dark:border-border p-1 text-foreground shadow-xl z-50"
              >
                <DropdownMenuItem
                  onClick={onStartRename}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-foreground rounded-lg hover:bg-cream dark:hover:bg-muted cursor-pointer"
                >
                  <Edit2 className="size-3.5 text-muted-foreground" />
                  <span>{t("history.rename", "Rename")}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-sage/20 dark:bg-border my-1 -mx-1" />

                <DropdownMenuItem
                  onClick={onTogglePin}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-foreground rounded-lg hover:bg-cream dark:hover:bg-muted cursor-pointer"
                >
                  {conversation.pinned ? (
                    <>
                      <PinOff className="size-3.5 text-muted-foreground" />
                      <span>{t("history.unpin", "Unpin chat")}</span>
                    </>
                  ) : (
                    <>
                      <Pin className="size-3.5 text-muted-foreground" />
                      <span>{t("history.pin", "Pin chat")}</span>
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onDelete}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 className="size-3.5 text-rose-500" />
                  <span>{t("history.delete", "Delete")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </li>
  );
}
