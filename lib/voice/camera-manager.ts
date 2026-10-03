/**
 * CameraManager
 * Manages the live video stream, 1 FPS preview frame capture for Gemini Live,
 * and Apple/Samsung-style 3-frame burst capture with Laplacian variance sharpness selection.
 */

export interface BurstCaptureResult {
  blob: Blob;
  sharpnessScore: number;
  dimensions: { width: number; height: number };
  burstIndex: number;
}

export class CameraManager {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private renderedVideoElement: HTMLVideoElement | null = null;
  private facingMode: "environment" | "user" = "environment";
  private isRunning = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.videoElement = document.createElement("video");
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
    }
  }

  public async start(facingMode?: "environment" | "user"): Promise<MediaStream> {
    if (facingMode) {
      this.facingMode = facingMode;
    }

    this.stop();

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera API is not supported on this device/browser.");
    }

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.mediaStream = stream;
    this.isRunning = true;

    if (this.videoElement) {
      this.videoElement.srcObject = stream;
      await this.videoElement.play().catch(() => {});
    }

    return stream;
  }

  public stop(): void {
    this.isRunning = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    if (this.renderedVideoElement) {
      this.renderedVideoElement.srcObject = null;
      this.renderedVideoElement = null;
    }
  }

  public async switchFacingMode(): Promise<MediaStream> {
    this.facingMode = this.facingMode === "environment" ? "user" : "environment";
    return this.start(this.facingMode);
  }

  public getStream(): MediaStream | null {
    return this.mediaStream;
  }

  public getFacingMode(): "environment" | "user" {
    return this.facingMode;
  }

  public isActive(): boolean {
    return this.isRunning && this.mediaStream !== null && this.mediaStream.active;
  }

  /**
   * Attaches the stream to a rendered React <video> element
   */
  public attachToVideoElement(el: HTMLVideoElement | null): void {
    this.renderedVideoElement = el;
    if (!el || !this.mediaStream) return;
    if (el.srcObject !== this.mediaStream) {
      el.srcObject = this.mediaStream;
      el.play().catch(() => {});
    }
  }

  private getActiveVideoElement(): HTMLVideoElement | null {
    if (this.renderedVideoElement && this.renderedVideoElement.videoWidth > 0) {
      return this.renderedVideoElement;
    }
    if (this.videoElement && this.videoElement.videoWidth > 0) {
      return this.videoElement;
    }
    return null;
  }

  /**
   * Captures an optimized preview frame for Gemini 3.8 Live realtime streaming
   * (e.g. 768px long edge at quality 0.65, ~35-45KB per frame).
   * Returns base64 JPEG without the data URL prefix.
   */
  public capturePreviewFrameBase64(maxLongEdge = 768, quality = 0.65): string | null {
    const video = this.getActiveVideoElement();
    if (!video || !this.isRunning) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw <= 0 || vh <= 0) return null;

    const isLandscape = vw >= vh;
    let targetW = vw;
    let targetH = vh;

    if (isLandscape && vw > maxLongEdge) {
      targetW = maxLongEdge;
      targetH = Math.round((vh * maxLongEdge) / vw);
    } else if (!isLandscape && vh > maxLongEdge) {
      targetH = maxLongEdge;
      targetW = Math.round((vw * maxLongEdge) / vh);
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, targetW, targetH);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const commaIdx = dataUrl.indexOf(",");
    return commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : null;
  }

  /**
   * Apple / Samsung style 3-Frame Rapid Burst with Laplacian Variance Sharpness Picker.
   * Takes 3 consecutive frames across ~160ms, measures edge sharpness on each frame,
   * selects the sharpest/in-focus frame, and exports it as a high-quality binary Blob.
   */
  public async captureBestFrameBlob(): Promise<BurstCaptureResult | null> {
    const video = this.getActiveVideoElement();
    if (!video || !this.isRunning) return null;

    const fullW = video.videoWidth;
    const fullH = video.videoHeight;
    if (fullW <= 0 || fullH <= 0) return null;

    const burstFrames: Array<{
      canvas: HTMLCanvasElement;
      score: number;
      index: number;
    }> = [];

    // Take 3 rapid frames spaced 80ms apart
    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 80));
      }

      const canvas = document.createElement("canvas");
      canvas.width = fullW;
      canvas.height = fullH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;

      ctx.drawImage(video, 0, 0, fullW, fullH);
      const score = this.calculateLaplacianVariance(ctx, fullW, fullH);

      burstFrames.push({ canvas, score, index: i + 1 });
    }

    if (burstFrames.length === 0) {
      // Fallback: direct single frame capture
      const fallbackCanvas = document.createElement("canvas");
      fallbackCanvas.width = fullW;
      fallbackCanvas.height = fullH;
      const ctx = fallbackCanvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, fullW, fullH);
      return new Promise((resolve) => {
        fallbackCanvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            resolve({
              blob,
              sharpnessScore: 0,
              dimensions: { width: fullW, height: fullH },
              burstIndex: 1,
            });
          },
          "image/jpeg",
          0.92,
        );
      });
    }

    // Pick the frame with highest sharpness variance score
    burstFrames.sort((a, b) => b.score - a.score);
    const best = burstFrames[0];

    return new Promise((resolve) => {
      best.canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          resolve({
            blob,
            sharpnessScore: Math.round(best.score),
            dimensions: { width: fullW, height: fullH },
            burstIndex: best.index,
          });
        },
        "image/jpeg",
        0.92,
      );
    });
  }

  /**
   * Laplacian Variance Metric (Edge Sharpness / Focus Detection).
   * Measures the variance of high-frequency spatial gradients.
   * Higher score = in-focus text & sharp borders; Lower score = motion blur / out-of-focus.
   */
  private calculateLaplacianVariance(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): number {
    const sampleW = 320;
    const sampleH = Math.round((height / width) * sampleW);

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sampleW;
    sampleCanvas.height = sampleH;
    const sCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sCtx) return 0;

    sCtx.drawImage(ctx.canvas, 0, 0, sampleW, sampleH);
    const imgData = sCtx.getImageData(0, 0, sampleW, sampleH);
    const d = imgData.data;

    const gray = new Float32Array(sampleW * sampleH);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      gray[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }

    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < sampleH - 1; y++) {
      const rowOffset = y * sampleW;
      for (let x = 1; x < sampleW - 1; x++) {
        const idx = rowOffset + x;
        const lap =
          gray[idx - sampleW] +
          gray[idx + sampleW] +
          gray[idx - 1] +
          gray[idx + 1] -
          4 * gray[idx];
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }

    if (count === 0) return 0;
    const mean = sum / count;
    return Math.max(0, sumSq / count - mean * mean);
  }
}
