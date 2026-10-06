"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AppBackgroundProps {
  className?: string;
}

interface HexCell {
  x: number;
  y: number;
  col: number;
  row: number;
  intensity: number;
  targetIntensity: number;
  pulseSpeed: number;
  colorIndex: number;
}

export function AppBackground({ className }: AppBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const isDark = () =>
      document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const HEX_RADIUS = 34; // Hexagon radius in px
    const HEX_HEIGHT = Math.sqrt(3) * HEX_RADIUS;
    const HORIZ_SPACING = HEX_RADIUS * 1.5;
    const VERT_SPACING = HEX_HEIGHT;

    let hexCells: HexCell[] = [];

    const initHexagons = () => {
      hexCells = [];
      const cols = Math.ceil(width / HORIZ_SPACING) + 2;
      const rows = Math.ceil(height / VERT_SPACING) + 2;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * HORIZ_SPACING;
          const y = r * VERT_SPACING + (c % 2 === 1 ? VERT_SPACING / 2 : 0);

          hexCells.push({
            x,
            y,
            col: c,
            row: r,
            intensity: Math.random() * 0.08,
            targetIntensity: Math.random() > 0.88 ? Math.random() * 0.38 + 0.12 : 0,
            pulseSpeed: Math.random() * 0.015 + 0.005,
            colorIndex: Math.floor(Math.random() * 3),
          });
        }
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      initHexagons();
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Mouse tracking for reactive illumination
    const mouse = { x: width / 2, y: height * 0.4, targetX: width / 2, targetY: height * 0.4 };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Draw single flat-topped hexagon path
    const drawHexPath = (cx: number, cy: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60 * Math.PI) / 180;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      const darkMode = isDark();

      // Palette definitions
      const baseBorder = darkMode
        ? "rgba(52, 211, 153, 0.07)"
        : "rgba(27, 67, 50, 0.055)";

      const glowTints = darkMode
        ? [
            { border: "rgba(52, 211, 153, ", fill: "rgba(16, 185, 129, " }, // Mint
            { border: "rgba(245, 158, 11, ", fill: "rgba(217, 119, 6, " },  // Amber
            { border: "rgba(6, 182, 212, ", fill: "rgba(14, 165, 233, " },  // Cyan
          ]
        : [
            { border: "rgba(45, 138, 98, ", fill: "rgba(45, 138, 98, " },   // Sage
            { border: "rgba(217, 119, 6, ", fill: "rgba(245, 158, 11, " },  // Amber
            { border: "rgba(124, 63, 29, ", fill: "rgba(180, 83, 9, " },    // Sandalwood
          ];

      // ── 1. DRAW BASE HEXAGON GRID ──
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = baseBorder;

      for (let i = 0; i < hexCells.length; i++) {
        const hex = hexCells[i];
        drawHexPath(hex.x, hex.y, HEX_RADIUS - 1.5);
        ctx.stroke();
      }

      // ── 2. DRAW ACTIVE & INTERACTIVE GLOWING HEXAGONS ──
      for (let i = 0; i < hexCells.length; i++) {
        const hex = hexCells[i];

        // Mouse proximity boost
        const dx = mouse.x - hex.x;
        const dy = mouse.y - hex.y;
        const mouseDist = Math.sqrt(dx * dx + dy * dy);
        let mouseBoost = 0;
        if (mouseDist < 160) {
          mouseBoost = (1 - mouseDist / 160) * 0.55;
        }

        // Random pulse evolution
        if (Math.abs(hex.intensity - hex.targetIntensity) < 0.02) {
          hex.targetIntensity =
            Math.random() > 0.88 ? Math.random() * 0.38 + 0.12 : 0;
        }
        hex.intensity += (hex.targetIntensity - hex.intensity) * hex.pulseSpeed;

        const effectiveIntensity = Math.min(1, hex.intensity + mouseBoost);

        if (effectiveIntensity > 0.05) {
          const tint = glowTints[hex.colorIndex % glowTints.length];

          // Balanced Soft Fill
          drawHexPath(hex.x, hex.y, HEX_RADIUS - 1.5);
          ctx.fillStyle = `${tint.fill}${effectiveIntensity * (darkMode ? 0.11 : 0.085)})`;
          ctx.fill();

          // Refined Border Glow
          ctx.strokeStyle = `${tint.border}${effectiveIntensity * (darkMode ? 0.38 : 0.28)})`;
          ctx.lineWidth = effectiveIntensity > 0.4 ? 1.2 : 0.85;
          ctx.stroke();

          // Center micro node on active cells
          if (effectiveIntensity > 0.35) {
            ctx.beginPath();
            ctx.arc(hex.x, hex.y, 1.6, 0, Math.PI * 2);
            ctx.fillStyle = `${tint.border}${effectiveIntensity * 0.55})`;
            ctx.fill();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 overflow-hidden pointer-events-none select-none z-0",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* ── Soft Ambient Center Halo ── */}
      <div className="absolute inset-0 bg-radial-[circle_at_50%_40%,rgba(45,138,98,0.06),transparent_70%] dark:bg-radial-[circle_at_50%_40%,rgba(16,185,129,0.08),transparent_70%] pointer-events-none" />

      {/* ── Radial Vignette (Keeps Content Pristine & Clean) ── */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_40%,var(--color-cream)_92%] dark:bg-radial-[circle_at_center,transparent_40%,var(--color-background)_92%] opacity-65 pointer-events-none" />
    </div>
  );
}

// Alias export for flexibility
export const HexagonalGridBackground = AppBackground;
