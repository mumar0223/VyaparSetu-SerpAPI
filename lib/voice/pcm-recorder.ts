/**
 * RAW PCM MICROPHONE RECORDER
 *
 * Microphone -> browser resampler -> AudioWorklet -> 16-bit mono PCM -> onChunk()
 *
 * Capture is deliberately left to the browser's platform audio stack for
 * echo cancellation, noise suppression, and gain control. This is much more
 * reliable on desktop devices than a hand-rolled noise gate.
 *
 * Gemini Live expects 16-bit mono PCM at 16 kHz. Chrome's Web Audio engine
 * performs the high-quality resampling when the MediaStream is attached to an
 * AudioContext configured at 16 kHz. This is streaming DSP, not a lossy file
 * conversion: it preserves the speech band while avoiding an ambiguous sample
 * rate at the Live API boundary.
 */

export const GEMINI_LIVE_INPUT_SAMPLE_RATE = 16_000;
const DEFAULT_CHUNK_FRAMES = 640; // 40 ms at 16 kHz: responsive without packet spam.
const DEV_WAV_MAX_SECONDS = 20;

export interface PCMRecorderOptions {
  /** @deprecated Audio is always emitted at Gemini's required 16 kHz. */
  targetSampleRate?: number;
  bufferSize?: number;
  noiseGateThreshold?: number; // API compatibility; NOT USED
  gainBoost?: number; // API compatibility; NOT USED
  onChunk: (base64Chunk: string) => void;
  onVolume?: (volume: number) => void;
  onAudioLevel?: (rms: number) => void;
  onError?: (err: Error) => void;
}

export class PCMRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private silentGainNode: GainNode | null = null;
  private isRecording = false;
  private isMuted = false;
  private isAssistantSpeaking = false;
  private options: PCMRecorderOptions;
  /** The actual rate after Chrome's MediaStream-to-AudioContext resampling. */
  private nativeSampleRate: number = GEMINI_LIVE_INPUT_SAMPLE_RATE;
  private currentTurnPcmChunks: Int16Array[] = [];
  private currentTurnBytes = 0;
  private debugPcmChunks: Int16Array[] = [];
  private debugPcmBytes = 0;
  private debugClipCount = 0;
  private debugLastReportAt = 0;

  constructor(options: PCMRecorderOptions) {
    this.options = {
      bufferSize: DEFAULT_CHUNK_FRAMES,
      ...options,
    };
  }

  public async start(): Promise<boolean> {
    if (this.isRecording) return true;

    try {
      // Detect mobile / touch devices.
      // On mobile devices, requesting echoCancellation forces Android into
      // MODE_IN_COMMUNICATION (telephony call mode) and iOS into earpiece routing.
      // Since VyaparSetu uses Push-To-Talk (Hold-To-Speak), the mic is muted
      // during assistant playback, so avoiding hardware AEC on mobile keeps audio
      // in standard media mode and routes output through the main loudspeaker.
      const isMobile =
        typeof navigator !== "undefined" &&
        (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
          (Boolean(navigator.maxTouchPoints) && navigator.maxTouchPoints > 1));

      const audioConstraints: MediaTrackConstraints = isMobile
        ? {
            channelCount: { ideal: 1 },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
          }
        : {
            channelCount: { exact: 1 },
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
          };

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      const track = this.mediaStream.getAudioTracks()[0];
      if (!track) {
        throw new Error("No microphone audio track was returned.");
      }

      // ── Log actual mic settings for diagnostics ──
      const actualSettings = track.getSettings();
      console.log("[PCMRecorder] Microphone granted:", {
        label: track.label,
        sampleRate: actualSettings.sampleRate ?? "unknown",
        channelCount: actualSettings.channelCount ?? "unknown",
        echoCancellation: actualSettings.echoCancellation ?? "unknown",
        noiseSuppression: actualSettings.noiseSuppression ?? "unknown",
        autoGainControl: actualSettings.autoGainControl ?? "unknown",
        deviceId: actualSettings.deviceId ?? "unknown",
      });

      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioCtx) {
        throw new Error("Web Audio API is not supported in this browser.");
      }

      // Chrome resamples the microphone stream into this context. Requesting
      // 16 kHz here is safer and more predictable than asking Gemini to infer
      // the source rate from arbitrary desktop hardware (typically 48 kHz).
      this.audioContext = new AudioCtx({
        sampleRate: GEMINI_LIVE_INPUT_SAMPLE_RATE,
      });

      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }

      this.nativeSampleRate = this.audioContext.sampleRate;
      console.log(
        "[PCMRecorder] AudioContext sample rate:",
        this.nativeSampleRate,
      );
      if (this.nativeSampleRate !== GEMINI_LIVE_INPUT_SAMPLE_RATE) {
        throw new Error(
          `Chrome did not provide the required ${GEMINI_LIVE_INPUT_SAMPLE_RATE} Hz audio context (received ${this.nativeSampleRate} Hz).`,
        );
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(
        this.mediaStream,
      );

      const bufferSize = this.options.bufferSize ?? 2048;

      // The worklet performs NO resampling. It simply collects Float32 samples
      // into fixed-size chunks and posts them to the main thread.
      // It also supports a "flush" command to emit any partial buffer.
      const workletCode = `
        class RawPCMProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.bufferSize = ${bufferSize};
            this.outputBuffer = new Float32Array(this.bufferSize);
            this.outputIndex = 0;

            // Listen for flush commands from the main thread.
            this.port.onmessage = (event) => {
              if (event.data && event.data.type === 'flush') {
                this._flushPartial();
              }
            };
          }

          _flushPartial() {
            if (this.outputIndex > 0) {
              this.port.postMessage({
                type: 'chunk',
                buffer: this.outputBuffer.slice(0, this.outputIndex),
              });
              this.outputIndex = 0;
            }
          }

          process(inputs) {
            const input = inputs[0];
            if (!input || !input[0] || input[0].length === 0) return true;

            const inputChannel = input[0];

            for (let i = 0; i < inputChannel.length; i++) {
              this.outputBuffer[this.outputIndex++] = inputChannel[i];

              if (this.outputIndex >= this.bufferSize) {
                this.port.postMessage({
                  type: 'chunk',
                  buffer: this.outputBuffer.slice(0, this.bufferSize),
                });
                this.outputIndex = 0;
              }
            }
            return true;
          }
        }

        registerProcessor('raw-pcm-processor', RawPCMProcessor);
      `;

      const blob = new Blob([workletCode], {
        type: "application/javascript",
      });
      const workletUrl = URL.createObjectURL(blob);

      try {
        await this.audioContext.audioWorklet.addModule(workletUrl);
      } finally {
        URL.revokeObjectURL(workletUrl);
      }

      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        "raw-pcm-processor",
      );

      this.workletNode.port.onmessage = (
        event: MessageEvent<{ type?: string; buffer?: Float32Array }>,
      ) => {
        if (!this.isRecording || this.isMuted) return;

        const data = event.data;
        if (!data || data.type !== "chunk" || !data.buffer) return;

        const float32Data = data.buffer as Float32Array;
        const pcm16Data = this.floatTo16BitPCM(float32Data);
        this.inspectDevAudio(pcm16Data);

        // Retain turn audio for the Sub-Agent raw voice processing (capped at 30 seconds)
        const turnCopy = pcm16Data.slice();
        this.currentTurnPcmChunks.push(turnCopy);
        this.currentTurnBytes += turnCopy.byteLength;
        const maxTurnBytes = GEMINI_LIVE_INPUT_SAMPLE_RATE * 2 * 30;
        while (
          this.currentTurnBytes > maxTurnBytes &&
          this.currentTurnPcmChunks.length > 1
        ) {
          const removed = this.currentTurnPcmChunks.shift();
          if (removed) this.currentTurnBytes -= removed.byteLength;
        }

        const base64Chunk = this.arrayBufferToBase64(pcm16Data.buffer);

        if (base64Chunk) {
          this.options.onChunk(base64Chunk);
        }

        // Meter only. This never changes the audio sent to onChunk().
        if (this.options.onVolume && float32Data.length > 0) {
          let sumSquares = 0;
          for (let i = 0; i < float32Data.length; i++) {
            sumSquares += float32Data[i] * float32Data[i];
          }
          const rms = Math.sqrt(sumSquares / float32Data.length);
          this.options.onVolume(Math.min(1, rms * 6));
          this.options.onAudioLevel?.(rms);
        }
      };

      // The graph must be connected to keep the worklet processing.
      // Route through a silent gain node into a dummy MediaStreamDestination
      // rather than audioContext.destination to avoid locking hardware output in call mode.
      this.silentGainNode = this.audioContext.createGain();
      this.silentGainNode.gain.value = 0;
      const dummyDestination = this.audioContext.createMediaStreamDestination();

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.silentGainNode);
      this.silentGainNode.connect(dummyDestination);

      this.isRecording = true;
      return true;
    } catch (err: unknown) {
      this.stop();

      const error =
        err instanceof Error ? err : new Error(String(err ?? "Unknown error"));

      this.options.onError?.(error);
      return false;
    }
  }

  /**
   * Flush any partial buffer remaining in the AudioWorklet.
   * last few milliseconds of audio are not silently discarded.  Without
   * this, up to `bufferSize` samples (~42 ms at 48 kHz with 2048) could be
   * lost at the tail of each utterance.
   */
  public flush(): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: "flush" });
    }
  }

  public setAssistantSpeaking(speaking: boolean): void {
    // Kept for API compatibility. RAW mode does not suppress microphone audio.
    this.isAssistantSpeaking = speaking;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    // NOTE: We deliberately do NOT toggle track.enabled here.
    // On mobile browsers (Chrome Android, iOS Safari), toggling
    // track.enabled causes the OS to re-initialize the microphone
    // hardware, creating audio pops, gaps, and frame corruption.
    // Instead, the isMuted flag is checked in the onmessage handler
    // which silently discards chunks while muted.
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Returns the sample rate of the PCM stream sent to Gemini Live.
   */
  public getNativeSampleRate(): number {
    return this.nativeSampleRate;
  }

  public async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn("[PCMRecorder] AudioContext resume failed:", e);
      }
    }
  }

  /** Returns the actual microphone settings reported by the browser. */
  public getInputInfo(): Record<string, unknown> | null {
    const track = this.mediaStream?.getAudioTracks()[0];
    if (!track) return null;

    const settings = track.getSettings();
    return {
      label: track.label,
      deviceId: settings.deviceId ?? null,
      groupId: settings.groupId ?? null,
      sampleRate: settings.sampleRate ?? this.audioContext?.sampleRate ?? null,
      sampleSize: settings.sampleSize ?? null,
      channelCount: settings.channelCount ?? null,
      echoCancellation: settings.echoCancellation ?? null,
      noiseSuppression: settings.noiseSuppression ?? null,
      autoGainControl: settings.autoGainControl ?? null,
    };
  }

  /**
   * Resets the turn-scoped audio buffer at the start of a user speaking turn.
   */
  public startTurn(): void {
    this.currentTurnPcmChunks = [];
    this.currentTurnBytes = 0;
  }

  /**
   * Returns the user's authentic spoken audio for the current/latest turn as a
   * standard 16kHz mono WAV Base64 string for direct processing by the Sub-Agent.
   */
  public getLastTurnWavBase64(): string | null {
    if (!this.currentTurnPcmChunks.length || this.currentTurnBytes === 0) {
      return null;
    }

    const wav = new ArrayBuffer(44 + this.currentTurnBytes);
    const view = new DataView(wav);
    const bytes = new Uint8Array(wav);
    const writeText = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++)
        view.setUint8(offset + i, value.charCodeAt(i));
    };

    writeText(0, "RIFF");
    view.setUint32(4, 36 + this.currentTurnBytes, true);
    writeText(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono channel
    view.setUint32(24, GEMINI_LIVE_INPUT_SAMPLE_RATE, true);
    view.setUint32(28, GEMINI_LIVE_INPUT_SAMPLE_RATE * 2, true); // Byte rate (16000 * 2)
    view.setUint16(32, 2, true); // Block align (16-bit mono)
    view.setUint16(34, 16, true); // Bits per sample
    writeText(36, "data");
    view.setUint32(40, this.currentTurnBytes, true);

    let offset = 44;
    for (const chunk of this.currentTurnPcmChunks) {
      const chunkBytes = new Uint8Array(
        chunk.buffer,
        chunk.byteOffset,
        chunk.byteLength,
      );
      bytes.set(chunkBytes, offset);
      offset += chunkBytes.byteLength;
    }

    return this.arrayBufferToBase64(wav);
  }

  /**
   * Development-only local capture for diagnosing audio before it reaches
   * Gemini. It never uploads or persists microphone data.
   */
  public downloadDebugWav(): boolean {
    if (process.env.NODE_ENV !== "development" || !this.debugPcmChunks.length) {
      return false;
    }

    const wav = new ArrayBuffer(44 + this.debugPcmBytes);
    const view = new DataView(wav);
    const bytes = new Uint8Array(wav);
    const writeText = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++)
        view.setUint8(offset + i, value.charCodeAt(i));
    };
    writeText(0, "RIFF");
    view.setUint32(4, 36 + this.debugPcmBytes, true);
    writeText(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, GEMINI_LIVE_INPUT_SAMPLE_RATE, true);
    view.setUint32(28, GEMINI_LIVE_INPUT_SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, "data");
    view.setUint32(40, this.debugPcmBytes, true);

    let offset = 44;
    for (const chunk of this.debugPcmChunks) {
      const chunkBytes = new Uint8Array(
        chunk.buffer,
        chunk.byteOffset,
        chunk.byteLength,
      );
      bytes.set(chunkBytes, offset);
      offset += chunkBytes.byteLength;
    }

    const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "vyaparsetu-live-input-16khz.wav";
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }

  public stop(): void {
    this.isRecording = false;
    this.isAssistantSpeaking = false;

    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.silentGainNode) {
      this.silentGainNode.disconnect();
      this.silentGainNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);

    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    return output;
  }

  private inspectDevAudio(pcm: Int16Array): void {
    if (process.env.NODE_ENV !== "development") return;

    const copy = pcm.slice();
    this.debugPcmChunks.push(copy);
    this.debugPcmBytes += copy.byteLength;
    for (const sample of copy) {
      if (Math.abs(sample) >= 32_700) this.debugClipCount++;
    }

    const maxBytes = GEMINI_LIVE_INPUT_SAMPLE_RATE * 2 * DEV_WAV_MAX_SECONDS;
    while (this.debugPcmBytes > maxBytes && this.debugPcmChunks.length > 1) {
      const oldest = this.debugPcmChunks.shift();
      if (oldest) this.debugPcmBytes -= oldest.byteLength;
    }

    const now = performance.now();
    if (now - this.debugLastReportAt < 1_000) return;
    this.debugLastReportAt = now;
    console.debug("[PCMRecorder diagnostic]", {
      pcm: "signed 16-bit little-endian mono",
      sampleRate: GEMINI_LIVE_INPUT_SAMPLE_RATE,
      bytesPerSecond: GEMINI_LIVE_INPUT_SAMPLE_RATE * 2,
      chunkFrames: pcm.length,
      chunkMilliseconds: (pcm.length / GEMINI_LIVE_INPUT_SAMPLE_RATE) * 1_000,
      retainedMilliseconds:
        (this.debugPcmBytes / 2 / GEMINI_LIVE_INPUT_SAMPLE_RATE) * 1_000,
      clippedSamples: this.debugClipCount,
    });
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = "";
    const bytes = new Uint8Array(buffer as ArrayBuffer);
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }

    return window.btoa(binary);
  }
}
