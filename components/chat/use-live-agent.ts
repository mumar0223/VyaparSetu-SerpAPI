"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { PCMRecorder } from "@/lib/voice/pcm-recorder";
import { PCMPlayer } from "@/lib/voice/pcm-player";
import { CameraManager, type BurstCaptureResult } from "@/lib/voice/camera-manager";
import type { SupportedLanguageCode } from "@/lib/agent/chat-config";
import type { ArtifactPayload } from "./artifact-modal";
import type { ToolCallItem } from "./types";

const GEMINI_LIVE_INPUT_SAMPLE_RATE = 16000;

export interface VoiceAttachedDocument {
  id: string;
  name: string;
  size: number;
  type: "image" | "file";
  mimeType: string;
  previewUrl?: string;
  persistentUrl?: string;
  blob?: Blob;
  status: "uploading" | "completed" | "error";
  progress: number;
}

export interface TurnBuf {
  id: string;
  user: string;
  assistant: string;
  toolCalls: ToolCallItem[];
  files: string[];
  startedAt: number;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface LiveAgentOptions {
  activeChatId?: string | null;
  initialLanguage?: SupportedLanguageCode;
  appLanguage?: string;
  onTurnComplete?: (turn: {
    turnId: string;
    startedAt: number;
    userTranscript: string;
    assistantTranscript: string;
    files?: string[];
    toolCalls?: ToolCallItem[];
    thoughtDurationSeconds?: number;
    thinking?: string;
  }) => void;
  onError?: (error: Error) => void;
  onArtifactAction?: (artifact: ArtifactPayload) => void;
}

interface VoiceSessionConfig {
  accessToken: string;
  projectId?: string;
  location?: string;
  model: string;
  wsUrl?: string;
  voiceName: string;
  systemInstruction: string;
  sessionNote?: string | null;
  hasHistory?: boolean;
  tools: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters?: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
      };
    }>;
  }>;
  toolConfig?: Record<string, unknown>;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

interface VertexFunctionCall {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
}

interface VertexFunctionResponse {
  id?: string;
  name: string;
  response: { output: unknown };
}

function mergeTranscript(current: string, incoming: string) {
  const cleanCurrent = current.trim();
  const cleanIncoming = incoming.trim();
  if (!cleanCurrent) return cleanIncoming;
  if (!cleanIncoming) return cleanCurrent;
  if (cleanCurrent.endsWith(cleanIncoming)) return cleanCurrent;
  if (cleanIncoming.startsWith(cleanCurrent)) return cleanIncoming;
  return `${cleanCurrent} ${cleanIncoming}`;
}

function displayMicError(error: Error | string | null | undefined): string {
  if (!error) return "Microphone connection lost.";
  const msg = typeof error === "string" ? error : error.message;
  const lower = msg.toLowerCase();
  if (
    lower.includes("notallowederror") ||
    lower.includes("permission") ||
    lower.includes("not allowed") ||
    lower.includes("denied")
  ) {
    return "Microphone permission is blocked. Allow mic access in your browser site settings.";
  }
  if (lower.includes("notfounderror") || lower.includes("no microphone")) {
    return "No microphone found on this device.";
  }
  if (lower.includes("notreadableerror") || lower.includes("busy")) {
    return "Microphone is busy in another app. Please close other voice apps and retry.";
  }
  return msg;
}

export interface SubAgentTaskItem {
  id: string;
  chatId?: string;
  status: "working" | "completed" | "error" | "unclear";
  activeTool?: string;
  description?: string;
  spokenHint?: string;
  progressPhase?: string;
  artifact?: ArtifactPayload | null;
  startTime: number;
}

export interface CompletedTaskItem {
  id: string;
  completedAt: number;
  title: string;
  summary: string;
  artifact: ArtifactPayload;
  toolName?: string;
  query?: string;
  savedImageUrl?: string | null;
}

export interface BackgroundScreenTaskState {
  status: "idle" | "working" | "completed" | "error";
  activeTool?: string;
  description?: string;
  spokenHint?: string;
  progressPhase?: string;
  artifact?: ArtifactPayload | null;
}

export type LiveAgentStatus =
  | "initializing"
  | "connecting"
  | "ready"
  | "listening"
  | "speaking"
  | "thinking"
  | "disconnected"
  | "error";

export function useLiveAgent(options: LiveAgentOptions = {}) {
  const [status, setStatusState] = useState<LiveAgentStatus>("disconnected");
  const statusRef = useRef<LiveAgentStatus>("disconnected");
  const setStatus = useCallback((s: LiveAgentStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const [isMuted, setIsMuted] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isHoldingToSpeak, setIsHoldingToSpeak] = useState(false);
  const [errorMessage, setErrorMessageState] = useState<string | null>(null);
  const errorMessageRef = useRef<string | null>(null);
  const setErrorMessage = useCallback((msg: string | null) => {
    errorMessageRef.current = msg;
    setErrorMessageState(msg);
  }, []);

  const [liveUserTranscript, setLiveUserTranscript] = useState("");
  const [liveAssistantTranscript, setLiveAssistantTranscript] = useState("");
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [liveArtifact, setLiveArtifact] = useState<ArtifactPayload | null>(null);
  const [liveArtifactChatId, setLiveArtifactChatId] = useState<string | null>(null);
  const defaultLang: SupportedLanguageCode = options.initialLanguage || "en-IN";
  const [selectedLanguage, setSelectedLanguage] =
    useState<SupportedLanguageCode>(defaultLang);

  const [activeArtifactOverview, setActiveArtifactOverview] = useState<{
    type?: string;
    title?: string;
    summary?: string;
  } | null>(null);
  const activeArtifactOverviewRef = useRef(activeArtifactOverview);
  useEffect(() => {
    activeArtifactOverviewRef.current = activeArtifactOverview;
  }, [activeArtifactOverview]);

  const [activeTasks, setActiveTasks] = useState<SubAgentTaskItem[]>([]);
  const activeTasksRef = useRef<Map<string, SubAgentTaskItem>>(new Map());

  const [sessionCompletedTasks, setSessionCompletedTasks] = useState<CompletedTaskItem[]>([]);
  const sessionCompletedTasksRef = useRef<CompletedTaskItem[]>([]);

  const [backgroundTask, setBackgroundTask] = useState<BackgroundScreenTaskState>({
    status: "idle",
  });
  const backgroundTaskRef = useRef<BackgroundScreenTaskState>({
    status: "idle",
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<"denied" | null>(null);
  const cameraManagerRef = useRef<CameraManager | null>(null);
  const cameraPreviewIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sendCameraPreviewFrameRef = useRef<(() => void) | null>(null);
  const pendingAutoStartCameraRef = useRef(false);

  const [attachedDocuments, setAttachedDocuments] = useState<VoiceAttachedDocument[]>([]);
  const attachedDocumentsRef = useRef<VoiceAttachedDocument[]>([]);
  useEffect(() => {
    attachedDocumentsRef.current = attachedDocuments;
  }, [attachedDocuments]);

  const clearCameraError = useCallback(() => {
    setCameraError(null);
  }, []);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<PCMRecorder | null>(null);
  const playerRef = useRef<PCMPlayer | null>(null);

  const connectedRef = useRef(false);
  const setupCompleteRef = useRef(false);
  const micInitPromiseRef = useRef<Promise<boolean> | null>(null);
  const mutedRef = useRef(false);
  const assistantSpeakingRef = useRef(false);
  const playbackActiveRef = useRef(false);
  const isHoldingRef = useRef(false);
  const userSpeakingRef = useRef(false);
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeChatIdRef = useRef<string | null>(options.activeChatId || null);
  const turnsRef = useRef(new Map<string, TurnBuf>());
  const userTurnIdRef = useRef<string | null>(null);
  const modelTurnIdRef = useRef<string | null>(null);
  const toolsInFlightRef = useRef(0);
  const sessionConfigRef = useRef<VoiceSessionConfig | null>(null);
  const modelTurnDoneRef = useRef(false);
  const pendingResultRef = useRef<string | null>(null);

  const nativeCaptionFinalRef = useRef("");
  const pendingCloudUploadsRef = useRef<Array<Promise<void>>>([]);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const turnStartTimeRef = useRef<number>(0);

  const pendingMicVolumeRef = useRef(0);
  const displayedMicVolumeRef = useRef(0);
  const micVolumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const selectedLanguageRef = useRef<SupportedLanguageCode>(defaultLang);

  useEffect(() => {
    if (options.initialLanguage) {
      selectedLanguageRef.current = options.initialLanguage;
      setSelectedLanguage(options.initialLanguage);
    }
  }, [options.initialLanguage]);

  useEffect(() => {
    activeChatIdRef.current = options.activeChatId || null;
    // Clear live artifact when activeChatId changes so artifacts never leak across chats
    setLiveArtifact(null);
    setLiveArtifactChatId(null);
  }, [options.activeChatId]);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }, []);

  const clearThinkingTimeout = useCallback(() => {
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }
  }, []);

  const waitForAnnouncementDone = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const t0 = Date.now();
        let heardAudio = false;
        const iv = setInterval(() => {
          const active =
            playbackActiveRef.current ||
            Boolean(playerRef.current?.hasActiveAudio());
          if (active) heardAudio = true;
          const elapsed = Date.now() - t0;
          const finished = heardAudio && !active && modelTurnDoneRef.current;
          const neverStarted = !heardAudio && elapsed > 2500; // model stayed silent
          if (finished || neverStarted || elapsed > 9000) {
            clearInterval(iv);
            resolve();
          }
        }, 60);
      }),
    [],
  );

  const sendToolResult = useCallback(
    (socket: WebSocket, text: string) => {
      if (isHoldingRef.current) {
        pendingResultRef.current = text;
        return;
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text }] }],
              turnComplete: true,
            },
          }),
        );
      }
    },
    [],
  );

  const newTurn = useCallback((): TurnBuf => {
    const t: TurnBuf = {
      id: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user: "",
      assistant: "",
      toolCalls: [],
      files: [],
      startedAt: Date.now(),
    };
    turnsRef.current.set(t.id, t);
    return t;
  }, []);

  const persistTurn = useCallback(async (turnId: string) => {
    const t = turnsRef.current.get(turnId);
    if (!t) return;
    const user = t.user.trim();
    const assistant = t.assistant.trim();
    if (!user && !assistant && t.toolCalls.length === 0 && t.files.length === 0) return;

    if (pendingCloudUploadsRef.current.length > 0) {
      const activeUploads = [...pendingCloudUploadsRef.current];
      pendingCloudUploadsRef.current = [];
      await Promise.allSettled(activeUploads);
    }

    const turnDuration = Math.max(1, Math.round((Date.now() - t.startedAt) / 1000));
    const thinkingPayload = JSON.stringify({ durationSeconds: turnDuration });

    const payload = {
      turnId: t.id,
      startedAt: t.startedAt,
      userTranscript: user,
      assistantTranscript: assistant,
      files: [...t.files],
      toolCalls: [...t.toolCalls],
      thoughtDurationSeconds: turnDuration,
      thinking: thinkingPayload,
    };

    console.log("[voice] Persisting turn snapshot by ID:", {
      turnId: t.id,
      user,
      assistant,
      tools: t.toolCalls.length,
      files: t.files.length,
    });

    optionsRef.current.onTurnComplete?.(payload);

    const chatId = activeChatIdRef.current;
    if (chatId) {
      try {
        await fetch(`/api/chats/${chatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn("[voice] Error persisting turn to server:", err);
      }
    }
  }, []);

  const schedulePersist = useCallback(
    (turnId: string, ms = 400) => {
      clearFlushTimer();
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        void persistTurn(turnId);
      }, ms);
    },
    [clearFlushTimer, persistTurn],
  );

  const startSpeaking = useCallback(() => {
    if (mutedRef.current || !connectedRef.current) return;

    playerRef.current?.flush();
    assistantSpeakingRef.current = false;
    playbackActiveRef.current = false;
    clearThinkingTimeout();
    clearFlushTimer();

    const prevId = modelTurnIdRef.current;
    if (prevId) {
      void persistTurn(prevId);
    }

    const t = newTurn();
    userTurnIdRef.current = t.id;
    modelTurnIdRef.current = t.id;
    turnStartTimeRef.current = t.startedAt;

    setLiveUserTranscript("");
    setLiveAssistantTranscript("");
    setStatus("listening");

    if (recorderRef.current) {
      recorderRef.current.setMuted(false);
      void recorderRef.current.resume();
      recorderRef.current.startTurn();
    }
    void playerRef.current?.resume();
    isHoldingRef.current = true;
    setIsHoldingToSpeak(true);
    userSpeakingRef.current = true;
    setIsUserSpeaking(true);

    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          realtimeInput: { activityStart: {} },
        }),
      );
      sendCameraPreviewFrameRef.current?.();
    }
  }, [newTurn, persistTurn, clearThinkingTimeout, clearFlushTimer]);

  const stopSpeaking = useCallback(() => {
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;
    setIsHoldingToSpeak(false);
    userSpeakingRef.current = false;
    setIsUserSpeaking(false);

    recorderRef.current?.flush();

    const socket = socketRef.current;
    setTimeout(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            realtimeInput: { activityEnd: {} },
          }),
        );
        if (pendingResultRef.current) {
          const text = pendingResultRef.current;
          pendingResultRef.current = null;
          sendToolResult(socket, text);
        }
      }
      if (connectedRef.current && !assistantSpeakingRef.current) {
        setStatus("thinking");
        turnStartTimeRef.current = Date.now();
        clearThinkingTimeout();
        thinkingTimeoutRef.current = setTimeout(() => {
          thinkingTimeoutRef.current = null;
          if (
            !assistantSpeakingRef.current &&
            !isHoldingRef.current &&
            connectedRef.current
          ) {
            console.warn(
              "[voice] thinking timeout — auto-recovering to ready state",
            );
            setStatus("ready");
          }
        }, 20_000);
      }
    }, 100);
  }, [clearThinkingTimeout]);

  const setAssistantSpeaking = useCallback((speaking: boolean) => {
    if (speaking) {
      if (assistantSpeakingRef.current) return;
      assistantSpeakingRef.current = true;
      recorderRef.current?.setMuted(true);
      nativeCaptionFinalRef.current = "";
      setLiveUserTranscript("");
      if (micVolumeTimerRef.current) {
        clearTimeout(micVolumeTimerRef.current);
        micVolumeTimerRef.current = null;
      }
      displayedMicVolumeRef.current = 0;
      pendingMicVolumeRef.current = 0;
      setMicVolume(0);
      userSpeakingRef.current = false;
      setIsUserSpeaking(false);
      isHoldingRef.current = false;
      setIsHoldingToSpeak(false);
      setStatus("speaking");
    } else {
      assistantSpeakingRef.current = false;
      playbackActiveRef.current = false;
      recorderRef.current?.setMuted(mutedRef.current);
      if (connectedRef.current && !mutedRef.current) {
        setStatus("ready");
      }
    }
  }, []);

  const handleAudioLevel = useCallback((rms: number) => {
    if (
      mutedRef.current ||
      assistantSpeakingRef.current ||
      !connectedRef.current
    )
      return;
  }, []);

  const handleMicVolume = useCallback((volume: number) => {
    if (
      !isHoldingRef.current ||
      mutedRef.current ||
      assistantSpeakingRef.current ||
      !connectedRef.current
    ) {
      return;
    }

    pendingMicVolumeRef.current = volume;
    if (micVolumeTimerRef.current) return;

    micVolumeTimerRef.current = setTimeout(() => {
      micVolumeTimerRef.current = null;
      if (
        !isHoldingRef.current ||
        mutedRef.current ||
        assistantSpeakingRef.current ||
        !connectedRef.current
      ) {
        return;
      }

      const next = pendingMicVolumeRef.current;
      if (Math.abs(next - displayedMicVolumeRef.current) < 0.04) return;
      displayedMicVolumeRef.current = next;
      setMicVolume(next);
    }, 120);
  }, []);

  const startMicrophone = useCallback(async (): Promise<boolean> => {
    if (recorderRef.current) return true;
    if (micInitPromiseRef.current) return micInitPromiseRef.current;

    const promise = (async () => {
      try {
        const recorder = new PCMRecorder({
          onChunk: (data) => {
            if (
              setupCompleteRef.current &&
              isHoldingRef.current &&
              !mutedRef.current &&
              !assistantSpeakingRef.current &&
              socketRef.current &&
              socketRef.current.readyState === WebSocket.OPEN
            ) {
              socketRef.current.send(
                JSON.stringify({
                  realtimeInput: {
                    mediaChunks: [
                      {
                        mimeType: `audio/pcm;rate=${GEMINI_LIVE_INPUT_SAMPLE_RATE}`,
                        data,
                      },
                    ],
                  },
                }),
              );
            }
          },
          onVolume: handleMicVolume,
          onAudioLevel: handleAudioLevel,
          onError: (error) => {
            setStatus("error");
            setErrorMessage(displayMicError(error));
          },
        });

        recorderRef.current = recorder;
        const started = await recorder.start();
        if (!started) return false;
        if (mutedRef.current) {
          recorder.setMuted(true);
        }
        console.log(
          "[voice] Gemini input sample rate:",
          recorder.getNativeSampleRate(),
        );
        console.log("[voice] mic input info:", recorder.getInputInfo());
        return true;
      } catch (err: any) {
        console.error("[voice] mic start failed", err);
        setStatus("error");
        setErrorMessage(displayMicError(err));
        return false;
      } finally {
        micInitPromiseRef.current = null;
      }
    })();

    micInitPromiseRef.current = promise;
    return promise;
  }, [handleAudioLevel, handleMicVolume]);

  const stopCameraPreviewLoop = useCallback(() => {
    if (cameraPreviewIntervalRef.current) {
      clearInterval(cameraPreviewIntervalRef.current);
      cameraPreviewIntervalRef.current = null;
    }
  }, []);

  const sendCameraPreviewFrame = useCallback(() => {
    const socket = socketRef.current;
    const camera = cameraManagerRef.current;
    if (
      !camera ||
      !camera.isActive() ||
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      !connectedRef.current ||
      !isHoldingRef.current || // STRICT: Only stream camera frames when user is speaking!
      assistantSpeakingRef.current || // Never stream when AI is speaking
      thinkingTimeoutRef.current !== null // Never stream when AI is thinking/generating
    ) {
      return;
    }

    const frameBase64 = camera.capturePreviewFrameBase64(768, 0.65);
    if (frameBase64) {
      try {
        socket.send(
          JSON.stringify({
            clientContent: {
              turns: [
                {
                  role: "user",
                  parts: [
                    {
                      inlineData: {
                        mimeType: "image/jpeg",
                        data: frameBase64,
                      },
                    },
                  ],
                },
              ],
              turnComplete: false,
            },
          }),
        );
      } catch (e) {
        console.warn("[voice] preview frame send error", e);
      }
    }
  }, []);

  useEffect(() => {
    sendCameraPreviewFrameRef.current = sendCameraPreviewFrame;
  }, [sendCameraPreviewFrame]);

  const startCameraPreviewLoop = useCallback(() => {
    stopCameraPreviewLoop();
    cameraPreviewIntervalRef.current = setInterval(() => {
      sendCameraPreviewFrame();
    }, 1500);
  }, [stopCameraPreviewLoop, sendCameraPreviewFrame]);

  const startCamera = useCallback(async () => {
    if (isCameraActive || cameraManagerRef.current?.isActive()) return;
    setCameraError(null);
    try {
      if (!cameraManagerRef.current) {
        cameraManagerRef.current = new CameraManager();
      }
      await cameraManagerRef.current.start(cameraFacingMode);
      setIsCameraActive(true);
      startCameraPreviewLoop();

      // Silently notify Gemini Live that camera is active and frames are streaming
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            clientContent: {
              turns: [
                {
                  role: "user",
                  parts: [
                    {
                      text: "[System note: User turned ON camera. Video frames are now streaming in real time.]",
                    },
                  ],
                },
              ],
              turnComplete: false,
            },
          }),
        );
      }
    } catch (err: any) {
      // Permission denied or dismissed by user: do NOT console.error or abort active voice call
      const isPermissionDenied =
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError" ||
        err?.message?.toLowerCase().includes("permission denied") ||
        err?.message?.toLowerCase().includes("not allowed");

      if (isPermissionDenied) {
        setCameraError("denied");
      } else {
        console.warn("[voice] Camera unavailable:", err?.message || err);
        setCameraError("denied");
      }
    }
  }, [isCameraActive, cameraFacingMode, startCameraPreviewLoop]);

  const stopCamera = useCallback(() => {
    stopCameraPreviewLoop();
    cameraManagerRef.current?.stop();
    setIsCameraActive(false);
    setCameraError(null);

    // Silently notify Gemini Live that camera is closed
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          clientContent: {
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text: "[System note: User turned OFF camera. Camera is closed; no video frames are streaming.]",
                  },
                ],
              },
            ],
            turnComplete: false,
          },
        }),
      );
    }
  }, [stopCameraPreviewLoop]);

  const toggleCamera = useCallback(async () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  }, [isCameraActive, startCamera, stopCamera]);

  const switchCameraFacing = useCallback(async () => {
    if (!cameraManagerRef.current || !isCameraActive) return;
    try {
      await cameraManagerRef.current.switchFacingMode();
      setCameraFacingMode(cameraManagerRef.current.getFacingMode());
    } catch (err) {
      console.warn("[voice] Failed to switch camera facing:", err);
    }
  }, [isCameraActive]);

  const attachDocuments = useCallback(async (filesInput: FileList | File[]) => {
    const rawFiles = Array.from(filesInput);
    if (!rawFiles.length) return;

    const currentCount = attachedDocumentsRef.current.length;
    if (currentCount >= 5) return;

    const availableSlots = 5 - currentCount;
    const filesToProcess = rawFiles.slice(0, availableSlots);

    const newDocs: VoiceAttachedDocument[] = filesToProcess.map((f, i) => {
      const isImg = f.type.startsWith("image/");
      return {
        id: `att_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size: f.size,
        type: isImg ? "image" : "file",
        mimeType: f.type || "application/octet-stream",
        previewUrl: isImg ? URL.createObjectURL(f) : undefined,
        blob: f,
        status: "uploading",
        progress: 25,
      };
    });

    setAttachedDocuments((prev) => [...prev, ...newDocs]);

    // ── Concurrent Track 1: Stream images into Gemini Live WebSocket immediately ──
    for (const f of filesToProcess) {
      if (f.type.startsWith("image/")) {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            const resultStr = reader.result as string;
            const base64 = resultStr.split(",")[1];
            const socket = socketRef.current;
            if (socket && socket.readyState === WebSocket.OPEN && base64) {
              socket.send(
                JSON.stringify({
                  clientContent: {
                    turns: [
                      {
                        role: "user",
                        parts: [
                          {
                            inlineData: {
                              mimeType: f.type || "image/jpeg",
                              data: base64,
                            },
                          },
                        ],
                      },
                    ],
                    turnComplete: false,
                  },
                }),
              );
            }
          };
          reader.readAsDataURL(f);
        } catch (e) {
          console.warn("[voice] Error streaming media chunk:", e);
        }
      }
    }

    // Proactively inform Gemini Live to acknowledge out loud
    // ── Upload to persistent storage first, then persist user turn and trigger Gemini Live response ──
    try {
      const uploadedSerializedFiles: string[] = [];

      await Promise.all(
        filesToProcess.map((file) => {
          return new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              const mimeType = file.type || "application/octet-stream";
              const isImg =
                mimeType.startsWith("image/") ||
                /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(file.name);
              const isPdf =
                mimeType === "application/pdf" ||
                file.name.toLowerCase().endsWith(".pdf");
              const isSheet =
                mimeType.includes("sheet") ||
                mimeType.includes("csv") ||
                /\.(xlsx|xls|csv)$/i.test(file.name);
              const type = isImg
                ? "IMAGE"
                : isPdf
                  ? "PDF"
                  : isSheet
                    ? "SHEET"
                    : "DOCUMENT";

              const filePayload = JSON.stringify({
                url: dataUrl,
                name: file.name,
                type,
                mimeType,
                size: file.size,
              });

              uploadedSerializedFiles.push(filePayload);

              setAttachedDocuments((prev) =>
                prev.map((doc) =>
                  doc.name === file.name
                    ? {
                        ...doc,
                        persistentUrl: dataUrl,
                        status: "completed",
                        progress: 100,
                      }
                    : doc,
                ),
              );
              resolve();
            };

            reader.onerror = () => {
              setAttachedDocuments((prev) =>
                prev.map((doc) =>
                  doc.name === file.name
                    ? { ...doc, status: "error", progress: 0 }
                    : doc,
                ),
              );
              resolve();
            };

            reader.readAsDataURL(file);
          });
        }),
      );

      // Persist the user message with the uploaded files BEFORE assistant response
      if (uploadedSerializedFiles.length > 0) {
        const docTurn = newTurn();
        docTurn.files = uploadedSerializedFiles;
        void persistTurn(docTurn.id);
      }

      // Then inform Gemini Live to acknowledge receipt orally
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            clientContent: {
              turns: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `The user has just uploaded ${filesToProcess.length} document(s): "${filesToProcess.map((f) => f.name).join(", ")}". Speak out loud to acknowledge receipt in a short friendly spoken sentence, and ask how they would like to proceed with the document(s).`,
                    },
                  ],
                },
              ],
              turnComplete: true,
            },
          }),
        );
      }
    } catch (uploadErr) {
      console.warn("[voice] Background upload error:", uploadErr);
      setAttachedDocuments((prev) =>
        prev.map((doc) => ({ ...doc, status: "completed", progress: 100 })),
      );
    }
  }, []);

  const removeAttachedDocument = useCallback((id?: string) => {
    setAttachedDocuments((prev) => {
      if (!id) {
        const last = prev[prev.length - 1];
        if (last?.previewUrl) URL.revokeObjectURL(last.previewUrl);
        return prev.slice(0, -1);
      }
      const target = prev.find((d) => d.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  const attachCameraVideoElement = useCallback((videoEl: HTMLVideoElement | null) => {
    cameraManagerRef.current?.attachToVideoElement(videoEl);
  }, []);

  const launchBackgroundScreenTask = useCallback(
    (
      args: any,
      audioBase64?: string,
      imageBlob?: Blob,
      isCameraActive?: boolean,
    ): Promise<{
      finalAssistant: string;
      artifact: ArtifactPayload | null;
      toolCalls: ToolCallItem[];
      savedImageUrl: string | null;
      query: string;
      thoughtDurationSeconds?: number;
    }> => {
      return new Promise((resolve) => {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const currentChatId =
          typeof activeChatIdRef.current === "string" &&
          activeChatIdRef.current.trim()
            ? activeChatIdRef.current.trim()
            : undefined;

        const initialTask: SubAgentTaskItem = {
          id: taskId,
          chatId: currentChatId,
          status: "working",
          activeTool: imageBlob ? "document_ocr" : "research",
          description: imageBlob
            ? "Analyzing document..."
            : `Starting task for: "${args?.query || "on-screen action"}"`,
          spokenHint: imageBlob
            ? "Main aapke document ko check aur process kar raha hoon, bas thoda sa intezar kijiye."
            : "Main aapki request par kaam kar raha hoon, bas thoda sa intezar kijiye.",
          progressPhase: "starting",
          artifact: null,
          startTime: Date.now(),
        };

        activeTasksRef.current.set(taskId, initialTask);
        const initialActive = Array.from(activeTasksRef.current.values());
        setActiveTasks(initialActive);

        const syncLegacyBackgroundTask = () => {
          const running = Array.from(activeTasksRef.current.values()).filter(
            (t) => t.status === "working",
          );
          if (running.length === 1) {
            backgroundTaskRef.current = {
              status: "working",
              activeTool: running[0].activeTool,
              description: running[0].description,
              spokenHint: running[0].spokenHint,
              progressPhase: running[0].progressPhase,
              artifact: running[0].artifact || null,
            };
          } else if (running.length >= 2) {
            backgroundTaskRef.current = {
              status: "working",
              description: `${running.length} Agents Working in Parallel...`,
            };
          }
          setBackgroundTask({ ...backgroundTaskRef.current });
        };

        syncLegacyBackgroundTask();

        let capturedImageUrl: string | null = null;
        let collectedToolCalls: ToolCallItem[] = [];
        let accumulatedAssistantText = "";
        let taskThoughtDurationSeconds: number | undefined = undefined;

        (async () => {
          try {
            const chatId = currentChatId;

            let res: Response;
            if (imageBlob) {
              const formData = new FormData();
              formData.append(
                "query",
                args?.query || "Inspect and assist with captured document",
              );
              if (args?.actionType)
                formData.append("actionType", args.actionType);
              if (chatId) formData.append("conversationId", chatId);
              if (audioBase64) formData.append("audioBase64", audioBase64);
              formData.append("image", imageBlob, "captured-document.jpg");
              formData.append("isCameraActive", String(isCameraActive ?? true));
              formData.append("language", selectedLanguageRef.current);

              res = await fetch("/api/voice/subagent-stream", {
                method: "POST",
                body: formData,
              });
            } else {
              res = await fetch("/api/voice/subagent-stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  query: args?.query,
                  actionType: args?.actionType,
                  conversationId: chatId,
                  audioBase64,
                  isCameraActive: Boolean(isCameraActive),
                  language: selectedLanguageRef.current,
                }),
              });
            }

            if (!res.ok || !res.body) {
              const errText = await res.text().catch(() => "");
              console.error(`[voice/subagent-stream failed HTTP ${res.status}]:`, errText);
              throw new Error(`Subagent stream connection failed: ${res.status} ${errText}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              const lines = buffer.split("\n\n");
              buffer = lines.pop() || "";

              for (const block of lines) {
                if (!block.trim()) continue;
                let event = "message";
                let dataStr = "";

                for (const line of block.split("\n")) {
                  if (line.startsWith("event: ")) {
                    event = line.replace("event: ", "").trim();
                  } else if (line.startsWith("data: ")) {
                    dataStr = line.replace("data: ", "").trim();
                  }
                }

                if (!dataStr) continue;

                try {
                  const data = JSON.parse(dataStr);
                  if (event === "document_captured") {
                    if (data.url) {
                      capturedImageUrl = data.url;
                      const activeTurn = (modelTurnIdRef.current ? turnsRef.current.get(modelTurnIdRef.current) : null) || null;
                      if (activeTurn && !activeTurn.files.includes(data.url)) {
                        activeTurn.files.push(data.url);
                      }
                    }
                  } else if (event === "status") {
                    const cur = activeTasksRef.current.get(taskId);
                    if (cur) {
                      cur.status = data.status || "working";
                      cur.activeTool = data.activeTool;
                      cur.description = data.description;
                      cur.spokenHint = data.spokenHint;
                      cur.progressPhase = data.progressPhase;
                      if (data.artifact) cur.artifact = data.artifact;
                      activeTasksRef.current.set(taskId, cur);
                      setActiveTasks(Array.from(activeTasksRef.current.values()));
                      syncLegacyBackgroundTask();
                    }
                  } else if (event === "chunk") {
                    if (data.text) accumulatedAssistantText += data.text;
                  } else if (event === "tool_call") {
                    const cur = activeTasksRef.current.get(taskId);
                    if (cur) {
                      cur.activeTool = data.toolName;
                      cur.description = data.summary;
                      activeTasksRef.current.set(taskId, cur);
                      setActiveTasks(Array.from(activeTasksRef.current.values()));
                      syncLegacyBackgroundTask();
                    }
                    collectedToolCalls.push({
                      toolName: data.toolName,
                      toolCallId: data.toolCallId,
                      summary: data.summary,
                      status: "calling",
                    });
                  } else if (event === "tool_result_delta") {
                    const toolCallId = data.toolCallId;
                    const idx = collectedToolCalls.findIndex((t) =>
                      toolCallId
                        ? t.toolCallId === toolCallId
                        : data.toolName
                        ? t.toolName === data.toolName
                        : false,
                    );
                    const incomingContent = data.replace
                      ? (data.content ?? "")
                      : (data.delta || data.content || "");

                    if (idx >= 0) {
                      const existing = collectedToolCalls[idx];
                      const prevRes = (existing.result as any) || {};
                      const prevData = prevRes.data || {};
                      const prevContent = prevData.content || prevRes.content || "";
                      const newContent = data.replace
                        ? incomingContent
                        : prevContent + incomingContent;

                      collectedToolCalls[idx] = {
                        ...existing,
                        args: data.args || existing.args,
                        status: "calling",
                        result: {
                          ...prevRes,
                          isArtifact: true,
                          content: newContent,
                          data: {
                            ...prevData,
                            content: newContent,
                          },
                        },
                      };
                    } else {
                      collectedToolCalls.push({
                        toolName: data.toolName || "subagent",
                        toolCallId,
                        args: data.args,
                        status: "calling",
                        summary: `Generating ${data.toolName || "intelligence"}...`,
                        result: {
                          isArtifact: true,
                          content: incomingContent,
                          data: {
                            content: incomingContent,
                          },
                        },
                      });
                    }
                  } else if (event === "tool_result") {
                    const toolCallId = data.toolCallId;
                    const idx = collectedToolCalls.findIndex((t) =>
                      toolCallId
                        ? t.toolCallId === toolCallId
                        : data.toolName
                        ? t.toolName === data.toolName
                        : false,
                    );
                    const item: ToolCallItem = {
                      toolName: data.toolName,
                      toolCallId,
                      args: data.args || (idx >= 0 ? collectedToolCalls[idx].args : undefined),
                      summary: data.summary,
                      status: "completed",
                      result: data.result,
                    };
                    if (idx >= 0) {
                      collectedToolCalls[idx] = item;
                    } else {
                      collectedToolCalls.push(item);
                    }
                  } else if (event === "artifact") {
                    const art: ArtifactPayload = {
                      artifactId: data.artifactId,
                      targetArtifactId: data.targetArtifactId,
                      isUpdated: data.isUpdated,
                      artifactType: data.artifactType,
                      title: data.title,
                      summary: data.summary,
                      data: data.data,
                    };
                    setLiveArtifact(art);
                    setLiveArtifactChatId(chatId || null);
                    optionsRef.current.onArtifactAction?.(art);

                    const appropriateToolName =
                      art.artifactType === "document"
                        ? "stageDocument"
                        : art.artifactType === "chart"
                          ? "stageChart"
                          : art.artifactType === "budget"
                            ? "stageBudget"
                            : art.artifactType === "expense"
                              ? "stageExpense"
                              : "stageForm";

                    // Prepend into sessionCompletedTasks (latest first)
                    const compItem: CompletedTaskItem = {
                      id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      completedAt: Date.now(),
                      title: art.title || "Ready on Screen",
                      summary: art.summary || "Draft prepared • Tap to review",
                      artifact: art,
                      toolName: appropriateToolName,
                      query: args?.query,
                    };
                    sessionCompletedTasksRef.current = [
                      compItem,
                      ...sessionCompletedTasksRef.current.filter(
                        (c) => c.artifact.artifactId !== art.artifactId,
                      ),
                    ];
                    setSessionCompletedTasks([...sessionCompletedTasksRef.current]);

                    const cur = activeTasksRef.current.get(taskId);
                    if (cur) {
                      cur.artifact = art;
                      activeTasksRef.current.set(taskId, cur);
                      setActiveTasks(Array.from(activeTasksRef.current.values()));
                      syncLegacyBackgroundTask();
                    }

                    const existingIdx = collectedToolCalls.findIndex(
                      (tc) =>
                        (tc.result as any)?.artifactId === art.artifactId ||
                        tc.toolName === appropriateToolName ||
                        tc.toolName === "stageForm" ||
                        tc.toolName === "stageDocument",
                    );
                    const artifactToolCall: ToolCallItem = {
                      toolName: appropriateToolName,
                      summary: art.summary || art.title,
                      status: "completed",
                      result: {
                        isArtifact: true,
                        ...art,
                      },
                    };
                    if (existingIdx >= 0) {
                      collectedToolCalls[existingIdx] = artifactToolCall;
                    } else {
                      collectedToolCalls.push(artifactToolCall);
                    }
                  } else if (event === "done") {
                    if (data.savedImageUrl) {
                      capturedImageUrl = data.savedImageUrl;
                      const activeTurn = (modelTurnIdRef.current ? turnsRef.current.get(modelTurnIdRef.current) : null) || null;
                      if (activeTurn && !activeTurn.files.includes(data.savedImageUrl)) {
                        activeTurn.files.push(data.savedImageUrl);
                      }
                    }
                    if (
                      Array.isArray(data.toolCalls) &&
                      data.toolCalls.length > 0
                    ) {
                      collectedToolCalls = data.toolCalls;
                    }
                    if (data.assistantContent) {
                      accumulatedAssistantText = data.assistantContent;
                    }
                    if (typeof data.thoughtDurationSeconds === "number") {
                      taskThoughtDurationSeconds = data.thoughtDurationSeconds;
                    }

                    const finalUserQuery =
                      data.query ||
                      args?.query ||
                      (capturedImageUrl ? "Scanned Document" : "Screen Task");
                    const finalAssistant =
                      accumulatedAssistantText ||
                      "Maine aapka request process kar diya hai.";

                    // Task finished: remove from activeTasks
                    activeTasksRef.current.delete(taskId);
                    const remaining = Array.from(activeTasksRef.current.values());
                    setActiveTasks(remaining);

                    const remainingRunning = remaining.filter(
                      (t) => t.status === "working",
                    );
                    if (remainingRunning.length === 1) {
                      backgroundTaskRef.current = {
                        status: "working",
                        activeTool: remainingRunning[0].activeTool,
                        description: remainingRunning[0].description,
                        spokenHint: remainingRunning[0].spokenHint,
                        progressPhase: remainingRunning[0].progressPhase,
                        artifact: remainingRunning[0].artifact || null,
                      };
                    } else if (remainingRunning.length >= 2) {
                      backgroundTaskRef.current = {
                        status: "working",
                        description: `${remainingRunning.length} Agents Working in Parallel...`,
                      };
                    } else {
                      backgroundTaskRef.current = {
                        status: "completed",
                        artifact: backgroundTaskRef.current.artifact || null,
                      };
                    }
                    setBackgroundTask({ ...backgroundTaskRef.current });
                    if (backgroundTaskRef.current.artifact) {
                      setActiveArtifactOverview({
                        type: backgroundTaskRef.current.artifact.artifactType,
                        title: backgroundTaskRef.current.artifact.title,
                        summary: backgroundTaskRef.current.artifact.summary,
                      });
                    }

                    resolve({
                      finalAssistant,
                      artifact: backgroundTaskRef.current.artifact || null,
                      toolCalls: collectedToolCalls,
                      savedImageUrl: capturedImageUrl,
                      query: finalUserQuery,
                      thoughtDurationSeconds: taskThoughtDurationSeconds,
                    });
                  }
                } catch (parseErr) {
                  console.warn("[voice/subagent-stream] parse error:", parseErr);
                }
              }
            }
          } catch (err: any) {
            console.error("[voice/subagent-stream error]:", err);
            activeTasksRef.current.delete(taskId);
            const remaining = Array.from(activeTasksRef.current.values());
            setActiveTasks(remaining);

            const remainingRunning = remaining.filter(
              (t) => t.status === "working",
            );
            if (remainingRunning.length === 1) {
              backgroundTaskRef.current = {
                status: "working",
                activeTool: remainingRunning[0].activeTool,
                description: remainingRunning[0].description,
                spokenHint: remainingRunning[0].spokenHint,
                progressPhase: remainingRunning[0].progressPhase,
                artifact: remainingRunning[0].artifact || null,
              };
            } else if (remainingRunning.length >= 2) {
              backgroundTaskRef.current = {
                status: "working",
                description: `${remainingRunning.length} Agents Working in Parallel...`,
              };
            } else {
              backgroundTaskRef.current = {
                status: "error",
                description: "Subagent encountered an error",
                spokenHint: "Task me dikkat aayi.",
              };
            }
            setBackgroundTask({ ...backgroundTaskRef.current });

            resolve({
              finalAssistant: "Task execute karne me dikkat aayi.",
              artifact: null,
              toolCalls: collectedToolCalls,
              savedImageUrl: capturedImageUrl,
              query: args?.query || "Screen action",
            });
          }
        })();
      });
    },
    [],
  );

  const captureDocumentManual = useCallback(
    async (overrideQuery?: string) => {
      if (!cameraManagerRef.current || !cameraManagerRef.current.isActive())
        return;
      const captureStartTime = Date.now();

      backgroundTaskRef.current = {
        status: "working",
        activeTool: "camera",
        description: "Capturing 3-frame burst...",
        progressPhase: "capturing",
      };
      setBackgroundTask({ ...backgroundTaskRef.current });

      const burst = await cameraManagerRef.current.captureBestFrameBlob();
      if (!burst || !burst.blob) {
        backgroundTaskRef.current = { status: "idle" };
        setBackgroundTask({ ...backgroundTaskRef.current });
        return;
      }

      const scoreDisplay = burst.sharpnessScore ? ` (Sharpness: ${burst.sharpnessScore})` : "";
      backgroundTaskRef.current = {
        status: "working",
        activeTool: "camera",
        description: `Optimal frame selected${scoreDisplay}`,
        progressPhase: "evaluating",
      };
      setBackgroundTask({ ...backgroundTaskRef.current });

      const query =
        overrideQuery ||
        (userTurnIdRef.current ? turnsRef.current.get(userTurnIdRef.current)?.user.trim() : "") ||
        nativeCaptionFinalRef.current.trim() ||
        "Inspect and process captured document";

      const dataUrl = await blobToDataUrl(burst.blob);

      const subResult = await launchBackgroundScreenTask(
        { query },
        undefined,
        burst.blob,
      );

      const filePayload = JSON.stringify({
        id: `cam_${Date.now()}`,
        name: `Captured Document ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.jpg`,
        url: dataUrl,
        type: "IMAGE",
        mimeType: "image/jpeg",
      });

      const t = newTurn();
      t.user = query;
      t.assistant = subResult.finalAssistant;
      t.files = [filePayload];
      t.toolCalls = subResult.toolCalls.length > 0 ? subResult.toolCalls : [];
      void persistTurn(t.id);
    },
    [launchBackgroundScreenTask, newTurn, persistTurn],
  );

  const handleToolCalls = useCallback(
    async (calls: VertexFunctionCall[], socket: WebSocket) => {
      let turn = (modelTurnIdRef.current ? turnsRef.current.get(modelTurnIdRef.current) : null) || newTurn();
      const currentTurnId = turn.id;
      modelTurnIdRef.current = currentTurnId;

      // 1. Camera-off check: answer immediately if required camera is closed
      const isCameraOn = Boolean(
        cameraManagerRef.current && cameraManagerRef.current.isActive()
      );
      const needsCamera = calls.some((c) => Boolean(c.args?.captureImage));
      if (needsCamera && !isCameraOn) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              toolResponse: {
                functionResponses: calls.map((c) => ({
                  id: c.id,
                  name: c.name,
                  response: {
                    output: {
                      status: "error",
                      error: "CAMERA_OFF",
                      findings:
                        "Camera is currently turned off. Please ask the user out loud to open or turn on their camera so you can view and capture the document.",
                    },
                  },
                })),
              },
            }),
          );
        }
        return;
      }

      clearThinkingTimeout();
      setStatus("thinking");
      toolsInFlightRef.current += calls.length;

      // 2. Run all sub-agents in parallel
      const runOneCall = async (call: VertexFunctionCall) => {
        setActiveToolName(call.name);
        const audioBase64 = recorderRef.current?.getLastTurnWavBase64() || undefined;

        if (call.name === "triggerScreenAction" || call.name === "captureDocument") {
          const announcement =
            String(call.args?.spokenAnnouncement || "").trim() ||
            "Main aapka kaam shuru kar raha hoon.";

          // 1) ACK IMMEDIATELY so the model starts synthesizing audio now
          modelTurnDoneRef.current = false;
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                toolResponse: {
                  functionResponses: [
                    {
                      id: call.id,
                      name: call.name,
                      response: {
                        output: {
                          status: "executing",
                          instruction: `Say exactly this one sentence now, then stop and wait: "${announcement}"`,
                        },
                      },
                    },
                  ],
                },
              }),
            );
          }
          clearThinkingTimeout();
          setStatus("thinking");

          // 2) Start sub-agent in parallel (camera burst runs after ack)
          const subPromise = (async () => {
            let imageBlob: Blob | undefined = undefined;

            if (Boolean(call.args?.captureImage) && cameraManagerRef.current && isCameraOn) {
              try {
                backgroundTaskRef.current = {
                  status: "working",
                  activeTool: "camera",
                  description: "Capturing 3-frame burst...",
                  progressPhase: "capturing",
                };
                setBackgroundTask({ ...backgroundTaskRef.current });

                const burst = await cameraManagerRef.current.captureBestFrameBlob();
                if (burst?.blob) {
                  imageBlob = burst.blob;
                  const scoreDisplay = burst.sharpnessScore ? ` (Sharpness: ${burst.sharpnessScore})` : "";
                  backgroundTaskRef.current = {
                    status: "working",
                    activeTool: "camera",
                    description: `Optimal frame selected${scoreDisplay}`,
                    progressPhase: "evaluating",
                  };
                  setBackgroundTask({ ...backgroundTaskRef.current });

                  // Store as permanent data URL so it never breaks across reloads
                  const dataUrl = await blobToDataUrl(burst.blob);
                  const filePayload = JSON.stringify({
                    id: `cam_${Date.now()}`,
                    name: `Captured Document ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.jpg`,
                    url: dataUrl,
                    type: "IMAGE",
                    mimeType: "image/jpeg",
                  });
                  turn!.files.push(filePayload);
                }
              } catch (e) {
                console.warn("[voice] Error capturing camera frame for screen task:", e);
              }
            }

            return await launchBackgroundScreenTask(
              call.args,
              audioBase64,
              imageBlob,
              isCameraOn,
            );
          })();

          // 3) When both the announcement audio and the sub-agent are done, deliver the result
          const [subResult] = await Promise.all([subPromise, waitForAnnouncementDone()]);

          if (subResult.toolCalls && subResult.toolCalls.length > 0) {
            turn!.toolCalls.push(...subResult.toolCalls);
          } else {
            turn!.toolCalls.push({
              toolName: call.name,
              args: call.args,
              result: {
                status: "completed",
                findings: subResult.finalAssistant,
              },
              status: "completed",
            });
          }

          sendToolResult(
            socket,
            `[TOOL RESULT] ${subResult.finalAssistant}` +
              (subResult.artifact ? ` (Screen now shows: ${subResult.artifact.title})` : "") +
              `\nSpeak this result now in 1-2 short sentences, in the user's current language. Do not repeat the announcement.`,
          );
          modelTurnDoneRef.current = false;

          return {
            call,
            finalAssistant: subResult.finalAssistant,
            artifact: subResult.artifact,
          };
        } else if (call.name === "checkScreenActionStatus") {
          const cur = backgroundTaskRef.current;
          const isAnyDocUploading = attachedDocumentsRef.current.some((d) => d.status === "uploading");
          const firstUploading = attachedDocumentsRef.current.find((d) => d.status === "uploading");
          const result = {
            status: isAnyDocUploading ? "uploading" : cur.status,
            activeTool: isAnyDocUploading ? "document_upload" : (cur.activeTool || "none"),
            description: isAnyDocUploading
              ? `Uploading document ${firstUploading?.name} (${firstUploading?.progress}%)`
              : (cur.description || (cur.status === "completed" ? "Completed on screen" : "No active task")),
            spokenHint: isAnyDocUploading
              ? "Aapka document upload ho raha hai, bas thoda sa intezar kijiye."
              : (cur.spokenHint || (cur.status === "completed" ? "Form screen par taiyar ho chuka hai, aap ise dekh sakte hain." : "Abhi koi screen action active nahi hai.")),
            title: cur.artifact?.title || firstUploading?.name,
          };

          turn!.toolCalls.push({
            toolName: call.name,
            args: call.args,
            result,
            status: "completed",
          });

          return {
            call,
            finalAssistant: result.description,
            artifact: null,
          };
        } else {
          // Fallback legacy tool execution
          try {
            const response = await fetch("/api/voice/execute-tool", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                toolName: call.name,
                args: {
                  ...(call.args || {}),
                  audioBase64,
                  userTranscript: turn!.user || undefined,
                },
                conversationId:
                  typeof activeChatIdRef.current === "string" && activeChatIdRef.current.trim()
                    ? activeChatIdRef.current.trim()
                    : undefined,
              }),
            });
            const data = (await response.json()) as { result?: unknown };
            const result = data.result ?? { success: true };
            const toolSummary = (result as any).summary || (result as any).title;
            turn!.toolCalls.push({
              toolName: call.name,
              args: call.args,
              result,
              summary: toolSummary,
              status: "completed",
            });
            return {
              call,
              finalAssistant: toolSummary || "Completed",
              artifact: (result as any)?.isArtifact ? (result as any) : null,
            };
          } catch {
            turn!.toolCalls.push({
              toolName: call.name,
              args: call.args,
              result: { error: "Execution failed" },
              status: "error",
            });
            return { call, finalAssistant: "Execution failed", artifact: null };
          }
        }
      };

      const results = await Promise.all(calls.map((c) => runOneCall(c)));

      toolsInFlightRef.current = Math.max(0, toolsInFlightRef.current - calls.length);
      setActiveToolName(null);
      schedulePersist(currentTurnId);

      const otherCalls = results.filter(
        (r) => r.call.name !== "triggerScreenAction" && r.call.name !== "captureDocument",
      );

      if (otherCalls.length > 0 && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            toolResponse: {
              functionResponses: otherCalls.map((r) => ({
                id: r.call.id,
                name: r.call.name,
                response: {
                  output: {
                    status: "completed",
                    findings: r.finalAssistant,
                    artifact: r.artifact
                      ? {
                          title: r.artifact.title,
                          summary: r.artifact.summary,
                          type: r.artifact.artifactType,
                        }
                      : null,
                  },
                },
              })),
            },
          }),
        );
      }
    },
    [
      launchBackgroundScreenTask,
      newTurn,
      schedulePersist,
      clearThinkingTimeout,
      waitForAnnouncementDone,
      sendToolResult,
    ],
  );

  const disconnect = useCallback(async () => {
    connectedRef.current = false;
    assistantSpeakingRef.current = false;
    playbackActiveRef.current = false;
    isHoldingRef.current = false;
    setIsHoldingToSpeak(false);
    clearThinkingTimeout();
    clearFlushTimer();
    if (micVolumeTimerRef.current) {
      clearTimeout(micVolumeTimerRef.current);
      micVolumeTimerRef.current = null;
    }

    if (modelTurnIdRef.current) {
      await persistTurn(modelTurnIdRef.current);
    }

    stopCameraPreviewLoop();
    cameraManagerRef.current?.stop();
    setIsCameraActive(false);

    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      )
        socket.close();
    }
    recorderRef.current?.stop();
    recorderRef.current = null;
    setupCompleteRef.current = false;
    micInitPromiseRef.current = null;
    playerRef.current?.stop();
    playerRef.current = null;

    pendingAutoStartCameraRef.current = false;
    userSpeakingRef.current = false;
    setIsUserSpeaking(false);
    displayedMicVolumeRef.current = 0;
    pendingMicVolumeRef.current = 0;
    setMicVolume(0);
    setStatus("disconnected");
    setLiveUserTranscript("");
    setLiveAssistantTranscript("");
    setActiveToolName(null);
    setLiveArtifact(null);
    setLiveArtifactChatId(null);
    sessionCompletedTasksRef.current = [];
    setSessionCompletedTasks([]);
    activeTasksRef.current.clear();
    setActiveTasks([]);
    backgroundTaskRef.current = { status: "idle" };
    setBackgroundTask({ status: "idle" });
  }, [clearThinkingTimeout, clearFlushTimer, persistTurn]);

  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  const connect = useCallback(
    async (
      conversationIdOverride?: string,
      initialOptions?: { autoStartCamera?: boolean; initialMuted?: boolean },
    ) => {
      const validOverride =
        typeof conversationIdOverride === "string" && conversationIdOverride.trim()
          ? conversationIdOverride.trim()
          : undefined;
      if (validOverride) {
        activeChatIdRef.current = validOverride;
      }
      clearThinkingTimeout();
      clearFlushTimer();
      if (modelTurnIdRef.current) {
        void persistTurn(modelTurnIdRef.current);
      }

      // Cleanly terminate any prior websocket without destroying the pre-warmed active microphone!
      const prevSocket = socketRef.current;
      socketRef.current = null;
      if (prevSocket) {
        prevSocket.onopen = null;
        prevSocket.onmessage = null;
        prevSocket.onerror = null;
        prevSocket.onclose = null;
        if (
          prevSocket.readyState === WebSocket.OPEN ||
          prevSocket.readyState === WebSocket.CONNECTING
        ) {
          prevSocket.close();
        }
      }

      // 1. Strict Prerequisite: Microphone access must be granted before proceeding to session setup
      const micReady = await startMicrophone();
      if (!micReady) {
        console.warn("[voice] Cannot connect: microphone permission blocked or unavailable.");
        return;
      }

      setStatus("connecting");
      setErrorMessage(null);
      connectedRef.current = true;
      const willBeMuted = Boolean(initialOptions?.initialMuted);
      mutedRef.current = willBeMuted;
      setIsMuted(willBeMuted);
      if (initialOptions?.autoStartCamera) {
        pendingAutoStartCameraRef.current = true;
      }
      assistantSpeakingRef.current = false;
      playbackActiveRef.current = false;
      isHoldingRef.current = false;
      setIsHoldingToSpeak(false);
      setupCompleteRef.current = false;

      try {
        const currentChatId =
          typeof activeChatIdRef.current === "string" && activeChatIdRef.current.trim()
            ? activeChatIdRef.current.trim()
            : undefined;

        const response = await fetch("/api/voice/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: currentChatId,
            language: optionsRef.current.appLanguage || selectedLanguageRef.current,
            activeArtifactOverview: activeArtifactOverviewRef.current || undefined,
            isCameraActive: Boolean(cameraManagerRef.current && cameraManagerRef.current.isActive()),
          }),
        });
        const session = (await response.json()) as VoiceSessionConfig & {
          error?: string;
        };
        sessionConfigRef.current = session;

        if (!response.ok || !session.accessToken)
          throw new Error(
            session.error || "Unable to create a Vertex voice session.",
          );

        const player = new PCMPlayer({
          sampleRate: 24000,
          onPlaybackStateChange: (playing) => {
            if (!connectedRef.current) return;
            playbackActiveRef.current = playing;
            if (playing) {
              setAssistantSpeaking(true);
            } else {
              setAssistantSpeaking(false);
              if (toolsInFlightRef.current === 0 && modelTurnIdRef.current) {
                schedulePersist(modelTurnIdRef.current, 300);
              }
            }
          },
        });
        await player.init();
        playerRef.current = player;

        const wsHost = session.location ? `${session.location}-aiplatform.googleapis.com` : "us-central1-aiplatform.googleapis.com";
        const wsUrl =
          session.wsUrl ||
          `wss://${wsHost}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent?access_token=${session.accessToken}`;
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          socket.send(
            JSON.stringify({
              setup: {
                model: session.model,
                generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: session.voiceName },
                    },
                  },
                  mediaResolution: "MEDIA_RESOLUTION_LOW",
                },
                safetySettings: session.safetySettings || [
                  {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_LOW_AND_ABOVE",
                  },
                  {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_LOW_AND_ABOVE",
                  },
                  {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_LOW_AND_ABOVE",
                  },
                  {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_LOW_AND_ABOVE",
                  },
                ],
                realtimeInputConfig: {
                  automaticActivityDetection: {
                    disabled: true,
                  },
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: {
                  parts: [{ text: session.systemInstruction }],
                },
                tools: session.tools,
                toolConfig: session.toolConfig || {
                  functionCallingConfig: {
                    mode: "AUTO",
                  },
                },
              },
            }),
          );
        };

        socket.onmessage = async (event) => {
          try {
            const raw =
              typeof event.data === "string"
                ? event.data
                : event.data instanceof Blob
                  ? await event.data.text()
                  : new TextDecoder().decode(event.data as ArrayBuffer);
            const message = JSON.parse(raw);
            if (message.setupComplete) {
              setupCompleteRef.current = true;
              if (sessionConfigRef.current?.sessionNote && socket.readyState === WebSocket.OPEN) {
                socket.send(
                  JSON.stringify({
                    clientContent: {
                      turns: [{ role: "user", parts: [{ text: sessionConfigRef.current.sessionNote }] }],
                      turnComplete: false,
                    },
                  }),
                );
              }
              const micReady = await startMicrophone();
              if (!micReady) return;
              if (mutedRef.current) {
                recorderRef.current?.setMuted(true);
              }
              setStatus("ready");
              if (pendingAutoStartCameraRef.current) {
                pendingAutoStartCameraRef.current = false;
                void startCamera();
              }
              return;
            }

            const serverContent = message.serverContent;

            if (serverContent) {
              clearThinkingTimeout();
              if (!turnStartTimeRef.current) {
                turnStartTimeRef.current = Date.now();
              }
            }

            if (serverContent?.inputTranscription?.text) {
              const vertexText = serverContent.inputTranscription.text.trim();
              if (vertexText) {
                let t = userTurnIdRef.current ? turnsRef.current.get(userTurnIdRef.current) : null;
                if (!t) {
                  t = newTurn();
                  userTurnIdRef.current = t.id;
                  modelTurnIdRef.current = t.id;
                }
                t.user = mergeTranscript(t.user, vertexText);
                setLiveUserTranscript(t.user);
              }
            }

            if (serverContent?.outputTranscription?.text) {
              let t = modelTurnIdRef.current ? turnsRef.current.get(modelTurnIdRef.current) : null;
              if (!t) {
                t = newTurn();
                modelTurnIdRef.current = t.id;
              }
              t.assistant = mergeTranscript(
                t.assistant,
                serverContent.outputTranscription.text,
              );
              setLiveAssistantTranscript(t.assistant);
            }

            for (const part of serverContent?.modelTurn?.parts || []) {
              if (part.inlineData?.data) {
                if (isHoldingRef.current) continue;
                playbackActiveRef.current = true;
                playerRef.current?.playChunk(part.inlineData.data);
              }
              if (part.text) {
                let t = modelTurnIdRef.current ? turnsRef.current.get(modelTurnIdRef.current) : null;
                if (!t) {
                  t = newTurn();
                  modelTurnIdRef.current = t.id;
                }
                t.assistant = mergeTranscript(
                  t.assistant,
                  part.text,
                );
                setLiveAssistantTranscript(t.assistant);
                if (assistantSpeakingRef.current) {
                  setStatus("speaking");
                }
              }
            }

            if (serverContent?.interrupted) {
              playerRef.current?.interrupt();
            }

            const calls: VertexFunctionCall[] = [
              ...((message.toolCall?.functionCalls ||
                []) as VertexFunctionCall[]),
              ...((serverContent?.modelTurn?.parts || [])
                .filter((p: any) => p.functionCall)
                .map((p: any) => p.functionCall) as VertexFunctionCall[]),
            ];
            if (calls.length) {
              clearFlushTimer();
              void handleToolCalls(calls, socket);
            }

            if (serverContent?.turnComplete) {
              modelTurnDoneRef.current = true;
              if (!calls.length && toolsInFlightRef.current === 0) {
                const isAudioActive = playbackActiveRef.current || Boolean(playerRef.current?.hasActiveAudio());
                if (!isAudioActive) {
                  setAssistantSpeaking(false);
                  if (modelTurnIdRef.current) {
                    schedulePersist(modelTurnIdRef.current, 400);
                  }
                } else {
                  clearFlushTimer();
                }
              }
            }
          } catch (error) {
            console.error("[voice] message processing failed", error);
          }
        };

        socket.onerror = () => {
          setStatus("error");
          setErrorMessage(
            "The voice connection failed. Please check your internet connection and try again.",
          );
        };

        socket.onclose = (event) => {
          console.warn("[voice] WebSocket closed:", event.code, event.reason);
          clearThinkingTimeout();
          if (connectedRef.current && statusRef.current !== "error") {
            setStatus("disconnected");
            if (event.code !== 1000) {
              setErrorMessage(
                `Voice session disconnected (${event.code}): ${event.reason || "Connection ended"}`,
              );
            }
          }
        };
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Voice agent connection error.",
        );
      }
    },
    [
      clearThinkingTimeout,
      clearFlushTimer,
      disconnect,
      handleAudioLevel,
      handleMicVolume,
      handleToolCalls,
      newTurn,
      persistTurn,
      schedulePersist,
      setAssistantSpeaking,
      startCamera,
      startMicrophone,
    ],
  );

  const setLanguage = useCallback(
    (lang: SupportedLanguageCode) => {
      if (selectedLanguageRef.current === lang) return;
      selectedLanguageRef.current = lang;
      setSelectedLanguage(lang);
      if (connectedRef.current) {
        // Reconnect with new language session instructions immediately
        void connect();
      }
    },
    [connect],
  );

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setIsMuted(next);
    recorderRef.current?.setMuted(next);
    if (next) {
      if (micVolumeTimerRef.current) {
        clearTimeout(micVolumeTimerRef.current);
        micVolumeTimerRef.current = null;
      }
      displayedMicVolumeRef.current = 0;
      pendingMicVolumeRef.current = 0;
      setMicVolume(0);
    }
  }, []);

  const reportError = useCallback((msg: string) => {
    setStatus("error");
    setErrorMessage(msg);
  }, []);

  return {
    status,
    setStatus,
    reportError,
    isMuted,
    micVolume,
    isUserSpeaking,
    isHoldingToSpeak,
    errorMessage,
    liveUserTranscript,
    liveAssistantTranscript,
    activeToolName,
    liveArtifact,
    setLiveArtifact,
    activeArtifact: liveArtifact,
    activeArtifactOverview,
    setActiveArtifactOverview,
    selectedLanguage,
    setLanguage,
    connect,
    disconnect,
    startMicrophone,
    toggleMute,
    startSpeaking,
    stopSpeaking,
    backgroundTask,
    activeTasks,
    sessionCompletedTasks,
    liveArtifactChatId,
    isCameraActive,
    cameraFacingMode,
    cameraError,
    clearCameraError,
    startCamera,
    stopCamera,
    toggleCamera,
    switchCameraFacing,
    attachCameraVideoElement,
    captureDocumentManual,
    attachedDocuments,
    attachedDocument: attachedDocuments[0] || null,
    attachDocuments,
    attachDocument: (file: File) => attachDocuments([file]),
    removeAttachedDocument,
  };
}
