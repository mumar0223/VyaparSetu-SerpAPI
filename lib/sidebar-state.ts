/**
 * Shared Sidebar & Chat Cache State Module
 *
 * Persists sidebar open/close state in localStorage and caches the
 * conversation list and message threads in module-level variables so
 * they survive React component unmounts / remounts during page navigation.
 *
 * Both ChatWorkspace and AppShell import from here so every page
 * shares the exact same state without re-fetching, re-animating, or flickering.
 */

import type { ConversationSummary, ChatMessage } from "@/components/chat/types";

const SIDEBAR_OPEN_KEY = "vyaparsetu:sidebar-open";
export const CONVERSATIONS_UPDATED_EVENT = "vyaparsetu:conversations-updated";

// ── Module-level cache (survives component unmount/remount) ──

let _cachedConversations: ConversationSummary[] | null = null;
const _chatMessageCache = new Map<string, ChatMessage[]>();
let _sidebarOpenRead = false;
let _sidebarOpen = true; // default until localStorage is read

/**
 * Read the persisted sidebar open/close state.
 * Returns `true` (open) on desktop, `false` on mobile by default.
 */
export function getPersistedSidebarOpen(): boolean {
  if (typeof window === "undefined") return true;

  if (window.innerWidth < 1024) {
    return false; // Mobile always defaults to closed drawer
  }

  if (!_sidebarOpenRead) {
    _sidebarOpenRead = true;
    const stored = localStorage.getItem(SIDEBAR_OPEN_KEY);
    if (stored !== null) {
      _sidebarOpen = stored === "true";
    } else {
      _sidebarOpen = true;
    }
  }
  return _sidebarOpen;
}

/**
 * Persist the sidebar open/close state to localStorage (desktop only).
 */
export function persistSidebarOpen(open: boolean): void {
  _sidebarOpen = open;
  if (typeof window !== "undefined" && window.innerWidth >= 1024) {
    localStorage.setItem(SIDEBAR_OPEN_KEY, String(open));
  }
}

/**
 * Get the cached conversation list (instant, synchronous).
 * Returns `null` if no cache exists yet.
 */
export function getCachedConversations(): ConversationSummary[] | null {
  return _cachedConversations;
}

/**
 * Update the module-level conversation cache and broadcast change.
 * Call this after every IndexedDB fetch/mutation so the next mount is instant.
 */
export function setCachedConversations(list: ConversationSummary[]): void {
  _cachedConversations = list;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CONVERSATIONS_UPDATED_EVENT, { detail: list }),
    );
  }
}

/**
 * Get cached messages for a given chat ID (0ms instant return).
 */
export function getCachedMessages(chatId: string): ChatMessage[] | undefined {
  return _chatMessageCache.get(chatId);
}

/**
 * Cache messages for a given chat ID so back/forward navigation is instant.
 */
export function setCachedMessages(chatId: string, messages: ChatMessage[]): void {
  _chatMessageCache.set(chatId, messages);
}

/**
 * Invalidate cached messages for a specific chat or all chats.
 */
export function clearCachedMessages(chatId?: string): void {
  if (chatId) {
    _chatMessageCache.delete(chatId);
  } else {
    _chatMessageCache.clear();
  }
}
