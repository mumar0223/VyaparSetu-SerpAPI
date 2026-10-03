/**
 * PCM Audio Player (24kHz 16-bit Mono Linear PCM)
 * Plays Base64 PCM audio chunks with smooth buffer queue scheduling and instant interruption.
 */

export interface PCMPlayerOptions {
  sampleRate?: number;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

export class PCMPlayer {
  private audioContext: AudioContext | null = null;
  private nextPlayTime = 0;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private isPlaying = false;
  private sampleRate: number;
  private onPlaybackStateChange?: (isPlaying: boolean) => void;
  /** Timer to debounce the "stopped playing" signal so we don't flicker between chunks */
  private pendingEndTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: PCMPlayerOptions) {
    this.sampleRate = options?.sampleRate || 24000;
    this.onPlaybackStateChange = options?.onPlaybackStateChange;
  }

  public async init(): Promise<void> {
    this.ensureAudioSessionPlayback();
    const ctx = this.initAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  public async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn("[PCMPlayer] AudioContext resume failed:", e);
      }
    }
  }

  /**
   * Ensures mobile browsers (especially iOS Safari / WebKit) route audio
   * through the device's main loudspeaker instead of defaulting to the
   * earpiece receiver.
   */
  private ensureAudioSessionPlayback(): void {
    if (typeof navigator !== "undefined" && "audioSession" in navigator) {
      try {
        (navigator as any).audioSession.type = "playback";
      } catch (e) {}
    }
  }

  private initAudioContext(): AudioContext {
    this.ensureAudioSessionPlayback();
    if (!this.audioContext || this.audioContext.state === "closed") {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({
        sampleRate: this.sampleRate,
      });
      this.nextPlayTime = 0;
    }
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  private clearPendingEnd(): void {
    if (this.pendingEndTimer) {
      clearTimeout(this.pendingEndTimer);
      this.pendingEndTimer = null;
    }
  }

  /**
   * Queue and play incoming base64 PCM chunk
   */
  public playChunk(base64Data: string): void {
    this.ensureAudioSessionPlayback();
    const ctx = this.initAudioContext();
    const float32Array = this.base64ToFloat32(base64Data);

    if (float32Array.length === 0) return;

    // A new chunk arrived — cancel any pending "stopped" signal
    this.clearPendingEnd();

    const audioBuffer = ctx.createBuffer(
      1,
      float32Array.length,
      this.sampleRate,
    );
    audioBuffer.getChannelData(0).set(float32Array);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const currentTime = ctx.currentTime;
    // Schedule next chunk seamlessly
    const startTime = Math.max(currentTime, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + audioBuffer.duration;

    this.activeSourceNodes.push(source);

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.onPlaybackStateChange?.(true);
    }

    source.onended = () => {
      const index = this.activeSourceNodes.indexOf(source);
      if (index > -1) {
        this.activeSourceNodes.splice(index, 1);
      }
      if (this.activeSourceNodes.length === 0) {
        // Don't fire "stopped" immediately — wait a short window for the next
        // chunk to arrive from Vertex. If no chunk comes, THEN report stopped.
        this.clearPendingEnd();
        this.pendingEndTimer = setTimeout(() => {
          this.pendingEndTimer = null;
          if (this.activeSourceNodes.length === 0 && this.isPlaying) {
            this.isPlaying = false;
            this.onPlaybackStateChange?.(false);
          }
        }, 600);
      }
    };
  }

  public hasActiveAudio(): boolean {
    return this.isPlaying || this.activeSourceNodes.length > 0 || this.pendingEndTimer !== null;
  }

  /**
   * Instantly stops audio playback upon barge-in / user interruption
   */
  public interrupt(): void {
    this.clearPendingEnd();
    for (const node of this.activeSourceNodes) {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {}
    }
    this.activeSourceNodes = [];
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    }
    if (this.isPlaying) {
      this.isPlaying = false;
      this.onPlaybackStateChange?.(false);
    }
  }

  /**
   * Flush all queued/playing audio and reset state WITHOUT closing the
   * AudioContext.  Use this between conversation turns so the player stays
   * alive for the next AI response.
   */
  public flush(): void {
    this.clearPendingEnd();
    for (const node of this.activeSourceNodes) {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {}
    }
    this.activeSourceNodes = [];
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    }
    if (this.isPlaying) {
      this.isPlaying = false;
      // Deliberately do NOT fire onPlaybackStateChange here — the caller
      // (startSpeaking) manages the state transition itself.
    }
  }

  public stop(): void {
    this.clearPendingEnd();
    this.interrupt();
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  // Convert Base64 16-bit Little-Endian PCM to Float32Array (-1.0 to +1.0)
  private base64ToFloat32(base64: string): Float32Array {
    try {
      const binary = window.atob(base64);
      const len = binary.length;
      const int16Count = Math.floor(len / 2);
      if (int16Count === 0) return new Float32Array(0);

      const float32 = new Float32Array(int16Count);
      const buffer = new ArrayBuffer(int16Count * 2);
      const uint8 = new Uint8Array(buffer);

      for (let i = 0; i < int16Count * 2; i++) {
        uint8[i] = binary.charCodeAt(i);
      }

      const view = new DataView(buffer);
      for (let i = 0; i < int16Count; i++) {
        const int16 = view.getInt16(i * 2, true); // true = Little-Endian
        float32[i] = int16 / 32768.0;
      }
      return float32;
    } catch (e) {
      return new Float32Array(0);
    }
  }
}
