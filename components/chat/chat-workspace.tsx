"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter, usePathname } from "next/navigation";

import {
  PanelLeftOpen,
  PanelLeftClose,
  Plus,
  TrendingUp,
  Landmark,
  FileSpreadsheet,
  Coins,
  ArrowDown,
  Store,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import { FloatingInput } from "./floating-input";
import { HistorySidebar } from "./history-sidebar";
import { ChatMessageList } from "./chat-message-list";
import { VoiceAgentView, type VoiceAgentStatus } from "./voice-agent-view";
import { useLiveAgent } from "./use-live-agent";
import { ArtifactModal, type ArtifactPayload } from "./artifact-modal";
import { BusinessPersonaDialog } from "./business-persona-dialog";
import { EnterpriseHubView } from "../enterprise/enterprise-hub-view";
import type {
  ChatMessage,
  ConversationSummary,
  ToolCallItem,
  ChatAttachment,
} from "./types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import {
  getConversations as idbGetConversations,
  getConversation as idbGetConversation,
  saveConversation as idbSaveConversation,
  updateConversation as idbUpdateConversation,
  deleteConversation as idbDeleteConversation,
  getMessages as idbGetMessages,
  saveMessage as idbSaveMessage,
  getActiveBusinessProfile,
  saveBusinessProfile,
  clearBusinessProfile,
  saveEnterpriseIntelligence,
  type BusinessProfile,
} from "@/lib/storage/indexed-db";
import { MapPin, ChevronDown, Check, RefreshCw, Edit2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { SupportedLanguageCode } from "@/lib/agent/chat-config";

const LANGUAGE_TO_VOICE_CODE: Record<string, SupportedLanguageCode> = {
  en: "en-IN",
  hi: "hi-IN",
  hinglish: "hi-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  ta: "ta-IN",
  te: "te-IN",
  pa: "pa-IN",
  kn: "kn-IN",
  ml: "ml-IN",
};

interface ChatWorkspaceProps {
  initialChatId?: string;
}

export function ChatWorkspace({
  initialChatId,
}: ChatWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, language } = useTranslation();

  const [activeChatId, setActiveChatId] = useState<string | null>(
    initialChatId || null,
  );
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<"chat" | "enterprise">("chat");
  const [isPersonaDialogOpen, setIsPersonaDialogOpen] = useState(false);

  // Active Business Profile Persona & Location Memory (Dexie / IndexedDB)
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    getActiveBusinessProfile().then((p) => {
      if (p) setBusinessProfile(p);
    });

    const handleProfileUpdate = (e: any) => {
      if (e.detail) setBusinessProfile(e.detail);
    };
    const handleProfileClear = () => setBusinessProfile(null);

    window.addEventListener("vyaparsetu:profile-updated", handleProfileUpdate);
    window.addEventListener("vyaparsetu:profile-cleared", handleProfileClear);

    return () => {
      window.removeEventListener("vyaparsetu:profile-updated", handleProfileUpdate);
      window.removeEventListener("vyaparsetu:profile-cleared", handleProfileClear);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsSidebarOpen(window.innerWidth >= 1024);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobile = window.innerWidth < 1024;
      window.dispatchEvent(
        new CustomEvent("chat-sidebar-toggle", {
          detail: { isOpen: isMobile && isSidebarOpen },
        }),
      );
    }
  }, [isSidebarOpen]);

  const [isInitialLoading, setIsInitialLoading] = useState(
    Boolean(initialChatId),
  );
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactPayload | null>(
    null,
  );
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const savedScrollPositionRef = useRef<number>(0);

  // ── 1. Fetch Conversations from Client IndexedDB ──
  const fetchConversations = useCallback(async () => {
    try {
      const idbList = await idbGetConversations();
      if (idbList.length > 0) {
        setConversations(
          idbList.map((c) => ({
            id: c.id,
            title: c.title,
            pinned: c.pinned,
            createdAt: new Date(c.createdAt).toISOString(),
            updatedAt: new Date(c.updatedAt).toISOString(),
          })),
        );
      } else {
        // Fallback to in-memory server chatStore if present
        const res = await fetch("/api/chats").catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          const serverList = data.conversations || [];
          setConversations(serverList);
          for (const s of serverList) {
            await idbSaveConversation({
              id: s.id,
              title: s.title,
              pinned: s.pinned || false,
              createdAt: new Date(s.createdAt).getTime(),
              updatedAt: new Date(s.updatedAt).getTime(),
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── Voice Agent Mode State & Live Agent Orchestrator ──
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isEndingVoiceSession, setIsEndingVoiceSession] = useState(false);
  const [isStartingVoiceSession, setIsStartingVoiceSession] = useState(false);
  const voiceStartInFlightRef = useRef(false);
  const voiceTurnsRef = useRef<Array<{ user: string; assistant?: string }>>([]);

  const liveAgent = useLiveAgent({
    activeChatId,
    initialLanguage: LANGUAGE_TO_VOICE_CODE[language] || "en-IN",
    appLanguage: language,
    onTurnComplete: (turn) => {
      const userText = turn.userTranscript.trim();
      const asstText = turn.assistantTranscript.trim();
      if (userText) {
        voiceTurnsRef.current.push({
          user: userText,
          assistant: asstText,
        });
        const currentCount = voiceTurnsRef.current.length;
        const currentChatId = activeChatId;

        // On Turn 1 (instant title) or Turn 3 (refined multi-turn dialogue title)
        if (currentChatId && (currentCount === 1 || currentCount === 3)) {
          fetch(`/api/chats/${currentChatId}/title`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              turns: voiceTurnsRef.current.slice(0, 3),
            }),
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.title) {
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === currentChatId ? { ...c, title: data.title } : c,
                  ),
                );
              }
            })
            .catch((err) => console.warn("Voice title generation error:", err));
        }
      }

      const currentChatId = activeChatId;
      const turnId = turn.turnId || `turn_${Date.now()}`;
      const uId = `u_${turnId}`;
      const aId = `a_${turnId}`;
      const startedAt = turn.startedAt || Date.now();

      const trimmedUser = turn.userTranscript.trim();
      const turnFiles: string[] = (turn as any).files || [];
      const asstTranscript = turn.assistantTranscript.trim();

      // Use the conversational / spoken transcript for the message text.
      // Rich documents, tables, and graphs reside in turn.toolCalls and are rendered cleanly
      // by the artifact component (avoiding duplicate back-to-back markdown tables).
      const asstContent = asstTranscript;

      const userMsg: ChatMessage | null =
        trimmedUser || turnFiles.length > 0
          ? {
              id: uId,
              role: "user" as const,
              content: trimmedUser,
              files: turnFiles,
              createdAt: new Date(startedAt),
            }
          : null;

      const asstMsg: ChatMessage | null =
        asstContent || (turn.toolCalls && turn.toolCalls.length > 0)
          ? {
              id: aId,
              role: "assistant" as const,
              content: asstContent,
              thinking: turn.thinking,
              thoughtDurationSeconds: turn.thoughtDurationSeconds,
              toolCalls: turn.toolCalls,
              createdAt: new Date(startedAt + 1),
            }
          : null;

      // Pure state updater (NO side effects inside!)
      setMessages((prev) => {
        let next = prev;
        for (const m of [userMsg, asstMsg]) {
          if (!m) continue;
          const i = next.findIndex((x) => x.id === m.id);
          next = i < 0 ? [...next, m] : next.map((x, k) => (k === i ? { ...x, ...m } : x));
        }
        next = [...next].sort(
          (a, b) =>
            new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
        );
        if (currentChatId) {
          chatCache.current.set(currentChatId, next);
        }
        return next;
      });

      // Side effects (IndexedDB writes) placed strictly OUTSIDE the React updater
      if (currentChatId) {
        if (userMsg) {
          idbSaveMessage({
            id: userMsg.id,
            conversationId: currentChatId,
            role: "user",
            content: userMsg.content,
            files: userMsg.files,
            createdAt: startedAt,
          }).catch(() => {});
        }
        if (asstMsg) {
          idbSaveMessage({
            id: asstMsg.id,
            conversationId: currentChatId,
            role: "assistant",
            content: asstMsg.content,
            thinking: asstMsg.thinking,
            toolCalls: asstMsg.toolCalls,
            createdAt: startedAt + 1,
          }).catch(() => {});
        }
      }

      fetchConversations();
    },
  });

  // Sync liveAgent voice language with dropdown language
  const liveAgentSetLanguageRef = useRef(liveAgent.setLanguage);
  liveAgentSetLanguageRef.current = liveAgent.setLanguage;

  useEffect(() => {
    const targetCode = (language && LANGUAGE_TO_VOICE_CODE[language]) || "en-IN";
    liveAgentSetLanguageRef.current(targetCode);
  }, [language]);

  const chatCache = useRef<Map<string, ChatMessage[]>>(new Map());
  const showScrollBottomRef = useRef(showScrollBottom);
  showScrollBottomRef.current = showScrollBottom;

  // Auto-scroll to bottom on message add/complete if user hasn't scrolled up
  useEffect(() => {
    if (!showScrollBottomRef.current && !isVoiceMode) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages.length, isLoading, isVoiceMode]);

  // Synchronous pre-paint scroll restoration: Locks directly to bottom with ZERO jumping
  useLayoutEffect(() => {
    if (!isVoiceMode && scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop =
        scrollViewportRef.current.scrollHeight;
    }
  }, [isVoiceMode, activeChatId]);

  const handleScroll = () => {
    if (!scrollViewportRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current;
    const isFar = scrollHeight - scrollTop - clientHeight > 100;
    setShowScrollBottom((prev) => (prev !== isFar ? isFar : prev));
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBottom(false);
  };

  // ── 5. Delete Chat (IndexedDB + State) ──
  const handleDeleteChat = useCallback(
    async (id: string) => {
      try {
        chatCache.current.delete(id);
        await idbDeleteConversation(id);
        fetch(`/api/chats/${id}`, { method: "DELETE" }).catch(() => {});
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeChatId === id) {
          setActiveChatId(null);
          setMessages([]);
          router.push("/ai-saathi");
        }
      } catch (err) {
        console.error("Failed to delete chat:", err);
      }
    },
    [activeChatId, router],
  );

  // ── URL Search Parameters Sync for Voice Agent State ──
  const updateVoiceUrlParams = useCallback(
    (updates: {
      mode?: string | null;
      camera?: boolean | null;
      mic?: string | null;
    }) => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);

      if (updates.mode !== undefined) {
        if (updates.mode) {
          url.searchParams.set("mode", updates.mode);
        } else {
          url.searchParams.delete("mode");
        }
      }

      if (updates.camera !== undefined) {
        if (updates.camera) {
          url.searchParams.set("camera", "true");
        } else {
          url.searchParams.delete("camera");
        }
      }

      if (updates.mic !== undefined) {
        if (updates.mic) {
          url.searchParams.set("mic", updates.mic);
        } else {
          url.searchParams.delete("mic");
        }
      }

      window.history.replaceState(null, "", url.toString());
    },
    [],
  );

  // ── Start Live Voice Session ──
  const handleStartVoiceSession = useCallback(
    async (options?: { autoStartCamera?: boolean; initialMuted?: boolean }) => {
      if (isVoiceMode || voiceStartInFlightRef.current) return;
      voiceStartInFlightRef.current = true;
      voiceTurnsRef.current = [];
      setIsStartingVoiceSession(true);
      if (scrollViewportRef.current) {
        savedScrollPositionRef.current = scrollViewportRef.current.scrollTop;
      }
      setIsVoiceMode(true);
      // This screen is intentionally shown before any model/WebSocket work. It
      // represents only creation or resolution of the durable chat session.
      liveAgent.setStatus("initializing");

      try {
        let targetId = activeChatId;
        if (!targetId) {
          const res = await fetch("/api/chats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Live Voice Session" }),
          });
          if (!res.ok)
            throw new Error("Could not create a chat for this voice session.");
          const data = await res.json();
          targetId = data?.conversation?.id;
          if (!targetId)
            throw new Error("Voice session chat creation returned no chat ID.");
          setActiveChatId(targetId);
          await idbSaveConversation({
            id: targetId,
            title: "Live Voice Session",
            pinned: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }).catch(() => {});
          fetchConversations();
        }

        // Build URL parameters reflecting voice mode, camera, and mic
        const searchParams = new URLSearchParams();
        searchParams.set("mode", "voice");
        if (options?.autoStartCamera) {
          searchParams.set("camera", "true");
        }
        if (options?.initialMuted) {
          searchParams.set("mic", "off");
        }
        window.history.replaceState(
          null,
          "",
          `/c/${targetId}?${searchParams.toString()}`,
        );

        await liveAgent.connect(targetId, options);
      } catch (error) {
        console.error("Failed to initialize voice session:", error);
        liveAgent.reportError(
          error instanceof Error
            ? error.message
            : "Unable to start the voice session.",
        );
      } finally {
        voiceStartInFlightRef.current = false;
        setIsStartingVoiceSession(false);
      }
    },
    [activeChatId, liveAgent, fetchConversations, isVoiceMode],
  );

  const handleToggleMute = useCallback(() => {
    liveAgent.toggleMute();
    const nextMuted = !liveAgent.isMuted;
    updateVoiceUrlParams({ mic: nextMuted ? "off" : null });
  }, [liveAgent, updateVoiceUrlParams]);

  const handleToggleCamera = useCallback(async () => {
    const nextCamera = !liveAgent.isCameraActive;
    updateVoiceUrlParams({ camera: nextCamera });
    await liveAgent.toggleCamera();
  }, [liveAgent, updateVoiceUrlParams]);

  // ── End Live Voice Session (Auto-Delete Empty Voice Sessions) ──
  const handleEndVoiceSession = useCallback(async () => {
    setIsEndingVoiceSession(true);
    await liveAgent.disconnect();

    const currentChatId = activeChatId;
    if (currentChatId) {
      // Trigger background title generation if title is still default
      if (voiceTurnsRef.current.length > 0) {
        const existingConv = conversations.find((c) => c.id === currentChatId);
        if (
          existingConv &&
          (existingConv.title === "Live Voice Session" ||
            existingConv.title === "New Conversation")
        ) {
          fetch(`/api/chats/${currentChatId}/title`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              turns: voiceTurnsRef.current.slice(0, 3),
            }),
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.title) {
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === currentChatId ? { ...c, title: data.title } : c,
                  ),
                );
              }
            })
            .catch((err) =>
              console.warn("Voice session end title generation error:", err),
            );
        }
      }

      // Re-fetch persisted messages: check local Dexie IndexedDB first so messages are never wiped with empty server memory
      try {
        const localMessages = await idbGetMessages(currentChatId);
        if (localMessages && localMessages.length > 0) {
          const loaded: ChatMessage[] = localMessages.map((m: any) => {
            let duration: number | undefined =
              typeof m.thoughtDurationSeconds === "number" && m.thoughtDurationSeconds > 0
                ? m.thoughtDurationSeconds
                : undefined;
            if (duration === undefined && m.thinking) {
              try {
                const parsed = JSON.parse(m.thinking);
                if (typeof parsed?.durationSeconds === "number") {
                  duration = parsed.durationSeconds;
                }
              } catch {
                const num = Number(m.thinking);
                if (!isNaN(num) && num > 0) duration = num;
              }
            }
            return {
              id: m.id,
              role: m.role,
              content: m.content,
              thinking: m.thinking,
              toolCalls: m.toolCalls,
              files: Array.isArray(m.files) ? m.files : [],
              thoughtDurationSeconds: duration,
              createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            };
          });
          setMessages(loaded);
          chatCache.current.set(currentChatId, loaded);
        } else {
          const res = await fetch(`/api/chats/${currentChatId}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.conversation?.messages && data.conversation.messages.length > 0) {
              setMessages(data.conversation.messages);
              chatCache.current.set(currentChatId, data.conversation.messages);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to refresh messages after voice session:", err);
      }

      window.history.replaceState(null, "", `/c/${currentChatId}`);
    } else {
      window.history.replaceState(null, "", "/");
    }

    setIsVoiceMode(false);
    setIsEndingVoiceSession(false);
    fetchConversations();
  }, [activeChatId, liveAgent, fetchConversations, conversations]);

  // Check URL search parameter for initial mode=voice, camera, and mic (strictly once on mount)
  const hasCheckedUrlVoiceMode = useRef(false);
  useEffect(() => {
    if (typeof window !== "undefined" && !hasCheckedUrlVoiceMode.current) {
      hasCheckedUrlVoiceMode.current = true;
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "voice") {
        const autoStartCamera =
          params.get("camera") === "true" || params.get("camera") === "1";
        const initialMuted =
          params.get("mic") === "off" ||
          params.get("mic") === "muted" ||
          params.get("muted") === "true";
        handleStartVoiceSession({ autoStartCamera, initialMuted });
      }
    }
  }, [handleStartVoiceSession]);

  // 2. Load Active Conversation Messages if initialChatId provided
  useEffect(() => {
    if (!initialChatId) {
      setActiveChatId(null);
      setMessages([]);
      setIsInitialLoading(false);
      return;
    }

    if (chatCache.current.has(initialChatId)) {
      setActiveChatId(initialChatId);
      setMessages(chatCache.current.get(initialChatId)!);
      setIsInitialLoading(false);
      return;
    }

    let isMounted = true;
    const loadConversation = async () => {
      const chatId = decodeURIComponent(initialChatId).trim();
      setMessages([]);
      setIsInitialLoading(true);
      try {
        // 1. Check local Dexie IndexedDB first (0ms instant restore, zero 404 on server reboots)
        let localMessages = await idbGetMessages(chatId);
        if (!localMessages || localMessages.length === 0) {
          // Cold reload safety: small 80ms tick in case IndexedDB connection is opening
          await new Promise((r) => setTimeout(r, 80));
          localMessages = await idbGetMessages(chatId);
        }

        if (localMessages && localMessages.length > 0 && isMounted) {
          setActiveChatId(chatId);
          const loaded = localMessages.map((m: any) => {
            let duration: number | undefined =
              typeof m.thoughtDurationSeconds === "number" && m.thoughtDurationSeconds > 0
                ? m.thoughtDurationSeconds
                : undefined;
            if (duration === undefined && m.thinking) {
              try {
                const parsed = JSON.parse(m.thinking);
                if (typeof parsed?.durationSeconds === "number") {
                  duration = parsed.durationSeconds;
                }
              } catch {
                const num = Number(m.thinking);
                if (!isNaN(num) && num > 0) duration = num;
              }
            }
            return {
              id: m.id,
              role: m.role,
              content: m.content,
              thinking: m.thinking,
              toolCalls: m.toolCalls,
              files: Array.isArray(m.files) ? m.files : [],
              thoughtDurationSeconds: duration,
              createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            };
          });
          chatCache.current.set(chatId, loaded);
          setMessages(loaded);
          setIsInitialLoading(false);
          return;
        }

        // 2. Fallback to server API if local DB was empty
        const res = await fetch(`/api/chats/${chatId}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.conversation && Array.isArray(data.conversation.messages)) {
            setActiveChatId(data.conversation.id);
            const loaded = data.conversation.messages.map((m: any) => {
              let duration: number | undefined =
                typeof m.thoughtDurationSeconds === "number" && m.thoughtDurationSeconds > 0
                  ? m.thoughtDurationSeconds
                  : undefined;
              if (duration === undefined && m.thinking) {
                try {
                  const parsed = JSON.parse(m.thinking);
                  if (typeof parsed?.durationSeconds === "number") {
                    duration = parsed.durationSeconds;
                  }
                } catch {
                  const num = Number(m.thinking);
                  if (!isNaN(num) && num > 0) duration = num;
                }
              }
              const item = {
                id: m.id,
                role: m.role,
                content: m.content,
                thinking: m.thinking,
                toolCalls: m.toolCalls,
                files: Array.isArray(m.files) ? m.files : [],
                thoughtDurationSeconds: duration,
                createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
              };

              // Backfill local IndexedDB
              idbSaveMessage({
                id: m.id,
                conversationId: chatId,
                role: m.role,
                content: m.content,
                thinking: m.thinking,
                toolCalls: m.toolCalls,
                files: Array.isArray(m.files) ? m.files : [],
                createdAt: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
              }).catch(() => {});

              return item;
            });
            chatCache.current.set(data.conversation.id, loaded);
            setMessages(loaded);
            setIsInitialLoading(false);
            return;
          }
        }

        // 3. If neither local messages nor remote messages exist, verify if conversation itself exists
        const convExists = await idbGetConversation(chatId);
        if (!convExists && isMounted) {
          console.warn(`Conversation ${chatId} not found locally or remotely. Redirecting to home.`);
          router.replace("/");
        }
      } catch (err) {
        console.error("Failed to load conversation:", err);
      } finally {
        if (isMounted) setIsInitialLoading(false);
      }
    };

    loadConversation();
    return () => {
      isMounted = false;
    };
  }, [initialChatId, router]);

  // 3. Start New Chat (Instant 0ms in-memory state change, zero page reload)
  const handleNewChat = useCallback(() => {
    setActiveView("chat");
    if (isVoiceMode) {
      liveAgent.disconnect();
      if (activeChatId && messages.length === 0) {
        handleDeleteChat(activeChatId);
      }
      setIsVoiceMode(false);
    }
    liveAgent.setLiveArtifact(null);
    setActiveChatId(null);
    setMessages([]);
    setIsInitialLoading(false);
    window.history.pushState(null, "", "/");
  }, [isVoiceMode, liveAgent, activeChatId, messages.length, handleDeleteChat]);

  // 4. Select existing chat from history (Instant 0ms in-memory load, zero page reload)
  const handleSelectChat = useCallback(
    async (id: string) => {
      setActiveView("chat");
      // Allow re-selecting if messages are empty to recover from blank loads
      if (id === activeChatId && messages.length > 0 && !isVoiceMode) return;

      if (isVoiceMode) {
        liveAgent.disconnect();
        if (activeChatId && messages.length === 0) {
          handleDeleteChat(activeChatId);
        }
        setIsVoiceMode(false);
      }
      liveAgent.setLiveArtifact(null);

      setActiveChatId(id);
      window.history.pushState(null, "", `/c/${id}`);

      // If cached in RAM: Instant 0ms load!
      if (chatCache.current.has(id)) {
        setMessages(chatCache.current.get(id)!);
        return;
      }

      // Check Client IndexedDB first
      try {
        let idbMsgs = await idbGetMessages(id);
        if (idbMsgs.length === 0) {
          await new Promise((r) => setTimeout(r, 80));
          idbMsgs = await idbGetMessages(id);
        }
        if (idbMsgs.length > 0) {
          const loaded: ChatMessage[] = idbMsgs.map((m) => {
            let duration: number | undefined = undefined;
            if (m.thinking) {
              try {
                const parsed = JSON.parse(m.thinking);
                if (typeof parsed?.durationSeconds === "number") {
                  duration = parsed.durationSeconds;
                }
              } catch {
                const num = Number(m.thinking);
                if (!isNaN(num) && num > 0) duration = num;
              }
            }
            return {
              id: m.id,
              role: m.role,
              content: m.content,
              thinking: m.thinking,
              toolCalls: m.toolCalls,
              files: Array.isArray(m.files) ? m.files : [],
              thoughtDurationSeconds: duration,
              createdAt: new Date(m.createdAt),
            };
          });
          chatCache.current.set(id, loaded);
          setMessages(loaded);
          setIsInitialLoading(false);
          return;
        }
      } catch (e) {
        console.warn("IndexedDB load error:", e);
      }

      try {
        const res = await fetch(`/api/chats/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.conversation) {
            const loaded = (data.conversation.messages || []).map((m: any) => {
              let duration: number | undefined = undefined;
              if (m.thinking) {
                try {
                  const parsed = JSON.parse(m.thinking);
                  if (typeof parsed?.durationSeconds === "number") {
                    duration = parsed.durationSeconds;
                  }
                } catch {
                  const num = Number(m.thinking);
                  if (!isNaN(num) && num > 0) duration = num;
                }
              }
              if (duration === undefined && Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
                duration = 1;
              }
              const item = {
                id: m.id,
                role: m.role,
                content: m.content,
                thinking: m.thinking,
                toolCalls: m.toolCalls,
                files: Array.isArray(m.files) ? m.files : [],
                thoughtDurationSeconds: duration,
                createdAt: m.createdAt,
              };

              // Backfill local IndexedDB
              idbSaveMessage({
                id: m.id,
                conversationId: id,
                role: m.role,
                content: m.content,
                thinking: m.thinking,
                toolCalls: m.toolCalls,
                files: Array.isArray(m.files) ? m.files : [],
                createdAt: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
              }).catch(() => {});

              return item;
            });
            chatCache.current.set(data.conversation.id, loaded);
            setMessages(loaded);
          }
        }
      } catch (err) {
        console.error("Failed to select chat:", err);
      } finally {
        setIsInitialLoading(false);
      }
    },
    [activeChatId, isVoiceMode, liveAgent, messages.length, handleDeleteChat],
  );

  // ── Browser Back / Forward (popstate) Support ──
  useEffect(() => {
    const onPopState = () => {
      const currentPath = window.location.pathname;
      if (currentPath === "/" || currentPath === "/ai-saathi" || currentPath === "/dashboard") {
        if (isVoiceMode) {
          liveAgent.disconnect();
          setIsVoiceMode(false);
        }
        setActiveChatId(null);
        setMessages([]);
        setIsInitialLoading(false);
      } else if (
        currentPath.startsWith("/c/") ||
        currentPath.startsWith("/ai-saathi/c/") ||
        currentPath.startsWith("/dashboard/c/")
      ) {
        const id = currentPath
          .replace(/^\/(?:ai-saathi|dashboard)?\/?c\//, "")
          .split("?")[0];
        if (id) {
          if (chatCache.current.has(id)) {
            setActiveChatId(id);
            setMessages(chatCache.current.get(id)!);
          } else {
            handleSelectChat(id);
          }
        }
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isVoiceMode, liveAgent, handleSelectChat]);

  // ── Listen for custom reset event (e.g. clicking AI Saathi in sidebar) ──
  useEffect(() => {
    const handleReset = () => {
      handleNewChat();
    };
    window.addEventListener("reset-ai-saathi", handleReset);
    window.addEventListener("reset-dashboard", handleReset);
    return () => {
      window.removeEventListener("reset-ai-saathi", handleReset);
      window.removeEventListener("reset-dashboard", handleReset);
    };
  }, [handleNewChat]);

  // 6. Rename Chat (IndexedDB + State)
  const handleRenameChat = async (id: string, newTitle: string) => {
    try {
      await idbUpdateConversation(id, { title: newTitle });
      fetch(`/api/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      }).catch(() => {});
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)),
      );
    } catch (err) {
      console.error("Failed to rename chat:", err);
    }
  };

  // 7. Toggle Pin (IndexedDB + State)
  const handleTogglePin = async (id: string, pinned: boolean) => {
    try {
      await idbUpdateConversation(id, { pinned });
      fetch(`/api/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      }).catch(() => {});
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, pinned } : c)),
      );
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

function extractPartialJsonString(jsonStr: string, key: string): string | null {
  const keyPattern = `"${key}"`;
  const keyIdx = jsonStr.indexOf(keyPattern);
  if (keyIdx === -1) return null;
  const afterKey = jsonStr.slice(keyIdx + keyPattern.length);
  const colonIdx = afterKey.indexOf(":");
  if (colonIdx === -1) return null;
  const afterColon = afterKey.slice(colonIdx + 1).trimStart();
  if (!afterColon.startsWith('"')) return null;

  const rawContent = afterColon.slice(1);
  let result = "";
  let i = 0;
  while (i < rawContent.length) {
    const ch = rawContent[i];
    if (ch === "\\" && i + 1 < rawContent.length) {
      const next = rawContent[i + 1];
      if (next === "n") result += "\n";
      else if (next === "t") result += "\t";
      else if (next === '"') result += '"';
      else if (next === "\\") result += "\\";
      else if (next === "/") result += "/";
      else if (next === "r") result += "\r";
      else result += next;
      i += 2;
    } else if (ch === '"') {
      break;
    } else {
      result += ch;
      i++;
    }
  }
  return result;
}

function formatSmartChatTitle(rawText: string): string {
  if (!rawText || typeof rawText !== "string") return "New Conversation";
  let cleaned = rawText.trim();

  // 1. Remove [Captured Document ...] tags if present
  cleaned = cleaned.replace(/^\[Captured Document Image:\s*(.*?)\]$/i, "$1");

  // 2. Remove common conversational query prefixes
  cleaned = cleaned.replace(
    /^(?:can you (?:please )?|please (?:tell me |show me |give me |generate )?|could you (?:please )?|tell me (?:about )?|what (?:is|are) |how (?:to|do i|can i) |where (?:is|can i find) |i want to |i need to |help me (?:with )?|show me |give me |generate (?:me )?)/i,
    "",
  );

  // 3. Remove markdown symbols, quotes, excess symbols
  cleaned = cleaned
    .replace(/[*#`_~\[\]\(\)\{\}\"\'\:\;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "New Conversation";

  // 4. Clean capitalization
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // 5. Shorten to max 6 words or 38 chars
  const words = cleaned.split(" ");
  if (words.length > 6) {
    cleaned = words.slice(0, 6).join(" ");
  }
  if (cleaned.length > 38) {
    cleaned = cleaned.slice(0, 38).trim() + "...";
  }

  return cleaned || "New Conversation";
}

  // 8. Real-time Message Send with Silent URL Update
  const handleSendMessage = async (
    text: string,
    attachments?: ChatAttachment[],
  ) => {
    if (
      (!text.trim() && (!attachments || attachments.length === 0)) ||
      isLoading
    )
      return;

    const userMessageId = `user_${Date.now()}`;
    const assistantMessageId = `asst_${Date.now()}`;

    // Guarantee durable 1:1 conversation ID upfront on client (matches ArchiText Dexie pattern)
    const currentConvId =
      activeChatId ||
      `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const isFirstMessage = !activeChatId;

    if (isFirstMessage) {
      setActiveChatId(currentConvId);
      window.history.replaceState(null, "", `/c/${currentConvId}`);
      const initialTitle = formatSmartChatTitle(text);
      setConversations((prev) => [
        {
          id: currentConvId,
          title: initialTitle,
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev.filter((c) => c.id !== currentConvId),
      ]);
      idbSaveConversation({
        id: currentConvId,
        title: initialTitle,
        pinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }).catch((e) => console.warn("idbSaveConversation error", e));
    }

    const newUserMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: text.trim(),
      attachments: attachments || [],
      files: attachments?.map((a) => JSON.stringify(a)) || [],
      createdAt: new Date(),
    };

    const newAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      thinking: t(
        "chat.thinkingDefault",
        "Synthesizing market context & evaluating trade queries...",
      ),
      toolCalls: [],
      createdAt: new Date(),
      isStreaming: true,
    };

    // Optimistic UI state update
    const previousMessages = [...messages];
    setMessages((prev) => [...prev, newUserMessage, newAssistantMessage]);
    setIsLoading(true);
    setShowScrollBottom(false);

    // Scroll the page to bottom on send
    requestAnimationFrame(() => {
      if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop =
          scrollViewportRef.current.scrollHeight;
      }
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      if (typeof window !== "undefined") {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
      }
    });
    setTimeout(() => {
      if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop =
          scrollViewportRef.current.scrollHeight;
      }
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);

    // Persist User Message to Client Dexie / IndexedDB with guaranteed matching conversationId
    idbSaveMessage({
      id: userMessageId,
      conversationId: currentConvId,
      role: "user",
      content: text.trim(),
      files: attachments?.map((a) => JSON.stringify(a)) || [],
      createdAt: Date.now(),
    }).catch((e) => console.warn("idbSaveMessage user error", e));

    let streamedContent = "";
    let streamedThinking = t(
      "chat.thinkingDefault",
      "Synthesizing market context & evaluating trade queries...",
    );
    let streamedToolCalls: ToolCallItem[] = [];
    let isStreamDone = false;
    let thoughtDuration: number | undefined = undefined;
    const rawJsonBuffer: Record<string, string> = {};

    let rafId: number | null = null;
    let isFlushScheduled = false;

    const scheduleFlush = () => {
      if (isFlushScheduled) return;
      isFlushScheduled = true;
      rafId = requestAnimationFrame(() => {
        isFlushScheduled = false;
        flushToState();
      });
    };

    const flushToState = () => {
      setMessages((prev) => {
        return prev.map((m) => {
          if (m.id !== assistantMessageId) return m;
          return {
            ...m,
            content: streamedContent,
            thinking: streamedThinking,
            isStreaming: !isStreamDone,
            thoughtDurationSeconds: thoughtDuration,
            toolCalls: [...streamedToolCalls],
          };
        });
      });

      if (scrollViewportRef.current && !showScrollBottomRef.current) {
        scrollViewportRef.current.scrollTop =
          scrollViewportRef.current.scrollHeight;
      }
    };

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          attachments: attachments || [],
          conversationId: currentConvId,
          language,
          businessProfile,
          history: previousMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Streaming connection failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          if (!block.trim()) continue;
          let eventType = "message";
          let dataStr = "";

          const lines = block.split("\n");
          for (const rawLine of lines) {
            if (rawLine.startsWith("event:")) {
              eventType = rawLine.slice(6).trim();
            } else if (rawLine.startsWith("data:")) {
              const val = rawLine.slice(5).trim();
              dataStr = dataStr ? dataStr + "\n" + val : val;
            }
          }

          if (!dataStr) continue;
          let data: any = {};
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (eventType === "conversation_init") {
            const { conversationId } = data;
            if (isFirstMessage && !activeChatId) {
              setActiveChatId(conversationId);
              window.history.replaceState(null, "", `/c/${conversationId}`);
            }
          } else if (eventType === "profile_update") {
            if (data && typeof data === "object") {
              saveBusinessProfile(data).then((p) => {
                setBusinessProfile(p);
              });
            }
          } else if (eventType === "chunk") {
            streamedContent += data.text || "";
            scheduleFlush();
          } else if (eventType === "thinking") {
            if (data.text || data.step) {
              streamedThinking = data.text || data.step;
              scheduleFlush();
            }
          } else if (eventType === "tool_call_delta") {
            // Real-time token streaming of tool call arguments directly from the LLM
            const toolCallId = data.toolCallId || "stageDocument";
            rawJsonBuffer[toolCallId] = (rawJsonBuffer[toolCallId] || "") + (data.argsTextDelta || "");

            if (data.toolName === "stageDocument" || !data.toolName) {
              const partialContent = extractPartialJsonString(rawJsonBuffer[toolCallId], "content");
              const partialTitle =
                extractPartialJsonString(rawJsonBuffer[toolCallId], "title") ||
                "Market Intelligence Report";

              const idx = streamedToolCalls.findIndex(
                (t) => t.toolCallId === toolCallId || t.toolName === "stageDocument",
              );

              const streamedPayload = {
                isArtifact: true,
                artifactType: "document",
                title: partialTitle,
                summary: partialTitle,
                data: {
                  artifactId: toolCallId,
                  title: partialTitle,
                  content: partialContent || "",
                },
              };

              if (idx >= 0) {
                streamedToolCalls[idx] = {
                  ...streamedToolCalls[idx],
                  status: "calling",
                  result: streamedPayload,
                };
              } else {
                streamedToolCalls.push({
                  toolName: "stageDocument",
                  toolCallId,
                  icon: "file-text",
                  status: "calling",
                  summary: "Synthesizing comprehensive intelligence dossier...",
                  result: streamedPayload,
                });
              }
              scheduleFlush();
            }
          } else if (eventType === "artifact_start") {
            const toolCallId = data.toolCallId || "stageDocument";
            const currentTitle = data.title || "Market Intelligence Report";
            const idx = streamedToolCalls.findIndex(
              (t) => t.toolCallId === toolCallId || t.toolName === "stageDocument",
            );
            const initialPayload = {
              isArtifact: true,
              artifactType: "document",
              title: currentTitle,
              summary: currentTitle,
              data: {
                artifactId: toolCallId,
                title: currentTitle,
                content: "",
              },
            };
            if (idx >= 0) {
              streamedToolCalls[idx] = {
                ...streamedToolCalls[idx],
                status: "calling",
                result: initialPayload,
              };
            } else {
              streamedToolCalls.push({
                toolName: "stageDocument",
                toolCallId,
                icon: "file-text",
                status: "calling",
                summary: "Synthesizing comprehensive intelligence dossier...",
                result: initialPayload,
              });
            }
            scheduleFlush();
          } else if (eventType === "tool_call") {
            const idx = streamedToolCalls.findIndex((t) => t.toolCallId === data.toolCallId);
            if (idx >= 0) {
              streamedToolCalls[idx] = {
                ...streamedToolCalls[idx],
                args: data.args,
                summary: data.summary,
                status: "calling",
              };
            } else {
              streamedToolCalls.push({
                toolName: data.toolName,
                toolCallId: data.toolCallId,
                icon: data.icon,
                args: data.args,
                summary: data.summary,
                status: data.status || "calling",
              });
            }
            scheduleFlush();
          } else if (eventType === "tool_result") {
            if (data.toolName === "runSWOTScan" && data.result) {
              const swot = data.result.swot || data.result.data || data.result;
              saveEnterpriseIntelligence({ swot, awakenedDomains: ["swot"] }).catch(() => {});
            } else if (data.toolName === "evaluateGovtSchemes" && data.result) {
              const schemes = data.result.schemes || data.result.data || data.result;
              saveEnterpriseIntelligence({ schemes, awakenedDomains: ["schemes"] }).catch(() => {});
            } else if (data.toolName === "getMandiArbitrage" && data.result) {
              const mandi = data.result.mandi || data.result.commodities || data.result.data || data.result;
              saveEnterpriseIntelligence({ mandi, awakenedDomains: ["mandi"] }).catch(() => {});
            } else if (data.toolName === "scanCatchmentRadar" && data.result) {
              const competitors = data.result.competitors || data.result.data || data.result;
              saveEnterpriseIntelligence({ competitors, awakenedDomains: ["competitors"] }).catch(() => {});
            } else if (data.toolName === "evaluateCreditAndEMI" && data.result) {
              const credit = data.result.credit || data.result.data || data.result;
              saveEnterpriseIntelligence({ credit, awakenedDomains: ["credit"] }).catch(() => {});
            }

            const isUpdated = data.result?.isUpdated;
            const targetId = data.result?.targetArtifactId || data.result?.artifactId;

            streamedToolCalls = streamedToolCalls.map((t) => {
              const matchesCall =
                t.toolCallId && data.toolCallId
                  ? t.toolCallId === data.toolCallId
                  : t.toolName === data.toolName;

              if (matchesCall) {
                return {
                  ...t,
                  icon: data.icon || t.icon,
                  result: data.result,
                  summary: data.summary || t.summary,
                  status: "completed",
                };
              }

              if (isUpdated && targetId) {
                const res = t.result as any;
                const match =
                  res?.artifactId === targetId ||
                  res?.data?.artifactId === targetId ||
                  (targetId === "1" && res?.isArtifact) ||
                  (targetId === "art_1" && res?.isArtifact);
                if (match) {
                  return {
                    ...t,
                    result: {
                      ...res,
                      title: data.result.title || res.title,
                      summary: data.result.summary || res.summary,
                      data: data.result.data || data.result,
                    },
                  };
                }
              }

              return t;
            });

            if (isUpdated && data.result?.data) {
              setActiveArtifact((curr) => {
                if (!curr) return null;
                return {
                  ...curr,
                  title: data.result.title || curr.title,
                  summary: data.result.summary || curr.summary,
                  data: data.result.data,
                };
              });
            }

            scheduleFlush();
          } else if (eventType === "done") {
            const elapsed =
              typeof data?.thoughtDurationSeconds === "number"
                ? data.thoughtDurationSeconds
                : Math.max(
                    1,
                    Math.round(
                      (Date.now() -
                        (newUserMessage.createdAt as any).getTime()) /
                        1000,
                    ),
                  );
            isStreamDone = true;
            thoughtDuration = elapsed;
            if (data?.text) {
              streamedContent = data.text;
            }

            if (rafId) cancelAnimationFrame(rafId);
            flushToState();

            idbSaveMessage({
              id: assistantMessageId,
              conversationId: currentConvId,
              role: "assistant",
              content: streamedContent || "",
              thinking: JSON.stringify({ durationSeconds: elapsed }),
              thoughtDurationSeconds: elapsed,
              toolCalls: streamedToolCalls,
              createdAt: Date.now(),
            }).catch(() => {});

            // If this was the first turn of a new conversation, refine title in background without blocking stream:
            if (isFirstMessage) {
              fetch(`/api/chats/${currentConvId}/title`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
              })
                .then((res) => (res && res.ok ? res.json() : null))
                .then((titleData) => {
                  if (titleData?.title) {
                    idbUpdateConversation(currentConvId, {
                      title: titleData.title,
                    }).catch(() => {});
                    setConversations((prev) =>
                      prev.map((c) =>
                        c.id === currentConvId
                          ? { ...c, title: titleData.title }
                          : c,
                      ),
                    );
                  }
                })
                .catch(() => {});
            }
          }
        }
      }

      if (rafId) cancelAnimationFrame(rafId);
      flushToState();
    } catch (err) {
      if (rafId) cancelAnimationFrame(rafId);
      console.error("Stream execution error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content:
                  m.content ||
                  "I encountered a temporary connection issue. Please try again.",
                isStreaming: false,
              }
            : m,
        ),
      );
    } finally {
      if (rafId) cancelAnimationFrame(rafId);
      setIsLoading(false);
      fetchConversations();
      setMessages((current) => {
        chatCache.current.set(currentConvId, current);
        return current;
      });
    }
  };

  const isNewChatView = !activeChatId && messages.length === 0;
  const activeConversation = conversations.find((c) => c.id === activeChatId);

  // Derive artifact strictly scoped to the current active chat
  const currentChatArtifact = useMemo(() => {
    // If user is on a brand new chat, NEVER leak old artifacts!
    if (!activeChatId) return null;

    // If an artifact was generated live in this voice turn, only show if it belongs to this active chat
    if (
      liveAgent.liveArtifact &&
      (!liveAgent.liveArtifactChatId ||
        liveAgent.liveArtifactChatId === activeChatId)
    ) {
      return liveAgent.liveArtifact;
    }

    // Otherwise, find the latest artifact from the CURRENT chat's messages
    if (activeChatId && messages.length > 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === "assistant") {
          // 1. Check tool calls (from latest to earliest within the message)
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            for (let j = msg.toolCalls.length - 1; j >= 0; j--) {
              const tc = msg.toolCalls[j];
              const res = tc.result as any;
              if (
                (res?.isArtifact || Boolean(res?.artifactType)) &&
                (res?.data || res?.content || res?.rates || res?.schemes || res?.swot || res?.competitors)
              ) {
                return {
                  artifactId: res.artifactId || res.data?.artifactId || tc.toolCallId || `art_${tc.toolName}_${i}`,
                  targetArtifactId: res.targetArtifactId,
                  isUpdated: res.isUpdated,
                  artifactType: res.artifactType || (tc.toolName === "stageDocument" ? "document" : tc.toolName === "stageChart" ? "chart" : "document"),
                  title: res.title || res.data?.title || tc.summary || "Interactive Intelligence",
                  summary: res.summary || res.data?.summary || "Draft prepared • Tap to review & edit",
                  data: res.data || res,
                } as ArtifactPayload;
              }
            }
          }
          // 2. Also check if message has an artifact property directly
          const directArt = (msg as any).artifact || (Array.isArray((msg as any).artifacts) && (msg as any).artifacts[0]);
          if (directArt && directArt.artifactType) {
            return directArt as ArtifactPayload;
          }
        }
      }
    }
    return null;
  }, [
    liveAgent.liveArtifact,
    liveAgent.liveArtifactChatId,
    activeChatId,
    messages,
  ]);

  // Synchronize active on-screen artifact overview with Live Voice Agent
  useEffect(() => {
    if (currentChatArtifact) {
      liveAgent.setActiveArtifactOverview({
        type: currentChatArtifact.artifactType,
        title: currentChatArtifact.title,
        summary: currentChatArtifact.summary,
      });
    } else {
      liveAgent.setActiveArtifactOverview(null);
    }
  }, [currentChatArtifact, liveAgent.setActiveArtifactOverview]);

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-transparent text-foreground font-sans">
      {/* ── Left-Side History Sidebar (Width = 260px) ── */}
      <HistorySidebar
        conversations={conversations}
        activeChatId={activeChatId}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onSelectChat={(id) => {
          setActiveView("chat");
          handleSelectChat(id);
        }}
        onNewChat={() => {
          setActiveView("chat");
          handleNewChat();
        }}
        onStartVoiceSession={handleStartVoiceSession}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onTogglePin={handleTogglePin}
        activeView={activeView}
        onOpenEnterprise={() => setActiveView("enterprise")}
      />

      {/* ── Top-Left Floating Controls (When Sidebar is Collapsed) ── */}
      {!isSidebarOpen && (
        <div
          className={cn(
            "fixed top-3 left-3 z-30 items-center pointer-events-auto select-none",
            isVoiceMode ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="h-10 px-1.5 flex items-center gap-1 bg-white/90 dark:bg-card/90 backdrop-blur-md border border-sage/40 dark:border-border rounded-2xl shadow-xs">
            <button
              onClick={() => setIsSidebarOpen(true)}
              title="Show chat history"
              className="size-8 rounded-xl flex items-center justify-center text-ink-muted hover:text-forest dark:hover:text-mint hover:bg-cream dark:hover:bg-muted transition-colors cursor-pointer"
            >
              <PanelLeftOpen className="size-4" />
            </button>

            <button
              onClick={() => {
                setActiveView("chat");
                handleNewChat();
              }}
              title="New chat"
              className="size-8 rounded-xl flex items-center justify-center text-ink-muted hover:text-forest dark:hover:text-mint hover:bg-cream dark:hover:bg-muted transition-colors cursor-pointer"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Top-Right Header: Language Dropdown + User Profile Button ── */}
      <div className="fixed top-3 right-3 md:right-6 z-30 flex items-center gap-2 pointer-events-auto select-none">
        {/* Language Dropdown */}
        <LanguageSwitcher variant="brand" />

        {/* Single User Profile Button (Opens Profile Dialog) */}
        <button
          onClick={() => setIsPersonaDialogOpen(true)}
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

      {/* ── Main Workspace Area (Edge-to-Edge Full Width) ── */}
      <div className="relative flex flex-1 flex-col h-full overflow-hidden min-w-0 transition-all duration-300 ease-in-out">
        {activeView === "enterprise" ? (
          <EnterpriseHubView
            businessProfile={businessProfile}
            onAskAi={(prompt) => {
              setActiveView("chat");
              handleSendMessage(prompt);
            }}
            onOpenPersonaDialog={() => setIsPersonaDialogOpen(true)}
          />
        ) : isVoiceMode ? (
          /* ── LIVE VOICE AGENT MODE (In-Place Ambient Viewport) ── */
          <VoiceAgentView
            status={liveAgent.status}
            isMuted={liveAgent.isMuted}
            micVolume={liveAgent.micVolume}
            isUserSpeaking={liveAgent.isUserSpeaking}
            isHoldingToSpeak={liveAgent.isHoldingToSpeak}
            isEnding={isEndingVoiceSession}
            errorMessage={liveAgent.errorMessage}
            selectedLanguage={liveAgent.selectedLanguage}
            onSelectLanguage={liveAgent.setLanguage}
            onToggleMute={handleToggleMute}
            onStartSpeaking={liveAgent.startSpeaking}
            onStopSpeaking={liveAgent.stopSpeaking}
            onEndSession={handleEndVoiceSession}
            onRetry={() => liveAgent.connect()}
            liveTranscript={liveAgent.liveUserTranscript}
            assistantTranscript={liveAgent.liveAssistantTranscript}
            activeToolName={liveAgent.activeToolName}
            activeArtifact={currentChatArtifact}
            onOpenArtifact={(art) => setActiveArtifact(art)}
            backgroundTask={liveAgent.backgroundTask}
            activeTasks={liveAgent.activeTasks}
            sessionCompletedTasks={liveAgent.sessionCompletedTasks}
            isCameraActive={liveAgent.isCameraActive}
            cameraFacingMode={liveAgent.cameraFacingMode}
            cameraError={liveAgent.cameraError}
            onClearCameraError={liveAgent.clearCameraError}
            onToggleCamera={handleToggleCamera}
            onSwitchCameraFacing={liveAgent.switchCameraFacing}
            onAttachCameraVideoElement={liveAgent.attachCameraVideoElement}
            isSidebarOpen={isSidebarOpen}
            attachedDocuments={liveAgent.attachedDocuments}
            attachedDocument={liveAgent.attachedDocument}
            onAttachDocuments={liveAgent.attachDocuments}
            onAttachDocument={liveAgent.attachDocument}
            onRemoveAttachedDocument={liveAgent.removeAttachedDocument}
          />
        ) : isNewChatView ? (
          /* NEW CHAT (Centered Hero View - only for blank /dashboard page) */
          <div className="w-full h-full overflow-y-auto flex flex-col justify-start sm:justify-center items-center px-4 pt-28 pb-12 md:py-10">
            <div className="w-full max-w-3xl text-center mb-8 animate-in fade-in-50 duration-300">
              <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-forest dark:text-foreground mb-2">
                {t("chat.agendaTitle", "What's on the agenda today?")}
              </h1>
              <p className="text-xs sm:text-sm text-ink-muted dark:text-muted-foreground">
                {t(
                  "chat.agendaSubtitle",
                  "Hyper-local mandi intelligence, financial structuring, and government credit scheme advisor",
                )}
              </p>
            </div>

            {/* Vertically Centered Input Bar */}
            <div className="w-full max-w-3xl px-4 md:px-6">
              <FloatingInput
                onSend={handleSendMessage}
                onStartVoiceMode={handleStartVoiceSession}
                isLoading={isLoading}
                isCentered={true}
              />
            </div>

            {/* Suggested Quick Prompt Chips */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 w-full max-w-4xl px-4 md:px-6">
              {[
                {
                  label: t(
                    "chat.promptCompetitorsTitle",
                    "Hyper-Local Competitors",
                  ),
                  desc: t(
                    "chat.promptCompetitorsDesc",
                    "Scan nearby rival businesses, prices & threat ratings",
                  ),
                  icon: Store,
                  prompt: t(
                    "chat.promptCompetitorsPrompt",
                    "Scan and analyze real nearby competitors, pricing, and market saturation for my business in my area.",
                  ),
                },
                {
                  label: t(
                    "chat.promptOndcWholesaleTitle",
                    "ONDC Wholesale Sourcing",
                  ),
                  desc: t(
                    "chat.promptOndcWholesaleDesc",
                    "Source inventory & raw materials 8-12% cheaper on B2B",
                  ),
                  icon: PackageCheck,
                  prompt: t(
                    "chat.promptOndcWholesalePrompt",
                    "How can I use ONDC B2B to source wholesale inventory and materials 8-12% cheaper for my business?",
                  ),
                },
                {
                  label: t("chat.promptOndcSellTitle", "ONDC Digital Selling"),
                  desc: t(
                    "chat.promptOndcSellDesc",
                    "Sell online at 3% commission vs 25% on legacy apps",
                  ),
                  icon: ShoppingBag,
                  prompt: t(
                    "chat.promptOndcSellPrompt",
                    "How can I list my shop on ONDC via Mystore or Magicpin to sell online with only 3% commission compared to legacy aggregators?",
                  ),
                },
                {
                  label: t("chat.prompt1Title", "Live APMC Mandi Rates"),
                  desc: t(
                    "chat.prompt1Desc",
                    "Current onion, wheat & commodity price arrivals",
                  ),
                  icon: TrendingUp,
                  prompt: t(
                    "chat.prompt1Prompt",
                    "Show me the latest regional mandi rates and APMC trends for Onion and Wheat.",
                  ),
                },
                {
                  label: t("chat.prompt2Title", "PM Mudra & SVANidhi Loan"),
                  desc: t(
                    "chat.prompt2Desc",
                    "Check zero-collateral credit eligibility",
                  ),
                  icon: Landmark,
                  prompt: t(
                    "chat.prompt2Prompt",
                    "Evaluate my eligibility for PM Mudra Kishore and PM SVANidhi loans.",
                  ),
                },
                {
                  label: t("chat.prompt3Title", "Working Capital Optimization"),
                  desc: t(
                    "chat.prompt3Desc",
                    "Analyze 14-day cash flow & stock buffer",
                  ),
                  icon: Coins,
                  prompt: t(
                    "chat.prompt3Prompt",
                    "Give me advice on optimizing my micro-enterprise working capital and inventory buffer.",
                  ),
                },
              ].map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(chip.prompt)}
                  className="p-3.5 rounded-2xl border border-sage/20 dark:border-border bg-white/40 dark:bg-card/40 hover:bg-white/65 dark:hover:bg-card/65 hover:border-mint backdrop-blur-md transition-all shadow-xs hover:shadow-md text-left group flex items-start gap-3.5 cursor-pointer"
                >
                  <div className="size-9 rounded-xl bg-mint-pale dark:bg-mint/10 text-forest dark:text-mint flex items-center justify-center shrink-0 group-hover:bg-mint group-hover:text-black transition-colors">
                    <chip.icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-serif font-bold text-forest dark:text-foreground group-hover:text-mint transition-colors truncate">
                      {chip.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {chip.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ACTIVE CHAT THREAD (Unified Viewport with 1:1 Horizontally Aligned Sticky Floating Input) */
          <div
            ref={scrollViewportRef}
            onScroll={handleScroll}
            className="relative flex-1 flex flex-col h-full overflow-y-auto w-full overscroll-y-contain"
          >
            {/* Top Sentinel for future-proof infinite scroll */}
            <div
              id="top-scroll-sentinel"
              className="h-1 w-full shrink-0 pointer-events-none"
            />

            {/* Scrollable Message List: pt-20 on mobile & desktop clears floating buttons; pb-6 bottom spacing */}
            <div className="flex-1 w-full max-w-3xl mx-auto px-4 md:px-6 pt-20 md:pt-20 pb-6">
              <ChatMessageList
                messages={messages}
                isLoading={isLoading}
                onOpenArtifact={(art) => setActiveArtifact(art)}
              />
              <div ref={bottomRef} className="h-6" />
            </div>

            {/* Sticky Floating Glass Input Bar: Sticks to bottom of scroll viewport, perfectly 1:1 aligned with message column */}
            <div
              style={{
                paddingBottom:
                  "max(0.875rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))",
              }}
              className="sticky bottom-0 w-full pointer-events-none z-20 pt-6 bg-gradient-to-t from-cream via-cream/90 to-transparent dark:from-background dark:via-background/90"
            >
              <div className="w-full max-w-3xl mx-auto px-4 md:px-6">
                <div className="relative pointer-events-auto">
                  {/* Dynamic Scroll to Bottom Button anchored directly above the input */}
                  {showScrollBottom && (
                    <button
                      type="button"
                      onClick={scrollToBottom}
                      title="Scroll to bottom"
                      className="absolute -top-11 left-1/2 -translate-x-1/2 z-30 size-8 rounded-full bg-white dark:bg-card hover:bg-cream dark:hover:bg-muted border border-sage/40 dark:border-border shadow-lg flex items-center justify-center text-forest dark:text-mint transition-all cursor-pointer backdrop-blur animate-in fade-in-0 zoom-in-90 duration-150 group"
                    >
                      <ArrowDown className="size-4 text-forest dark:text-mint group-hover:translate-y-0.5 transition-transform duration-150" />
                    </button>
                  )}

                  <FloatingInput
                    onSend={handleSendMessage}
                    onStartVoiceMode={handleStartVoiceSession}
                    isLoading={isLoading}
                    isCentered={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>



      {/* ── Interactive Artifact Review & Approval Modal ── */}
      <ArtifactModal
        isOpen={Boolean(activeArtifact)}
        onClose={() => setActiveArtifact(null)}
        artifact={activeArtifact}
        isVoiceMode={isVoiceMode}
        onVoiceHoldStart={liveAgent.startSpeaking}
        onVoiceHoldEnd={liveAgent.stopSpeaking}
        isUserSpeaking={liveAgent.isUserSpeaking}
        isHoldingToSpeak={liveAgent.isHoldingToSpeak}
      />

      {/* ── Custom Business Persona Dialog Box ── */}
      <BusinessPersonaDialog
        isOpen={isPersonaDialogOpen}
        onClose={() => setIsPersonaDialogOpen(false)}
        currentProfile={businessProfile}
        onProfileSaved={(p) => setBusinessProfile(p)}
        onProfileCleared={() => setBusinessProfile(null)}
      />
    </div>
  );
}
