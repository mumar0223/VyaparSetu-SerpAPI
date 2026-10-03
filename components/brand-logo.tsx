"use client";

import { cn } from "@/lib/utils";

export interface VyaparSetuIconProps {
  className?: string;
  size?: number | string;
  color?: string;
}

export function VyaparSetuIcon({
  className,
  size = 32,
  color = "#00C26F",
}: VyaparSetuIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Top Finial Orb */}
      <circle cx="50" cy="14" r="5.5" fill={color} />

      {/* Central Mast */}
      <line
        x1="50"
        y1="19"
        x2="50"
        y2="64"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Left Stay Cables */}
      <line
        x1="50"
        y1="21"
        x2="8"
        y2="64"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="50"
        y1="21"
        x2="22"
        y2="64"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="50"
        y1="21"
        x2="36"
        y2="64"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Right Stay Cables */}
      <line
        x1="50"
        y1="21"
        x2="64"
        y2="64"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="50"
        y1="21"
        x2="78"
        y2="64"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="50"
        y1="21"
        x2="92"
        y2="64"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Horizontal Bridge Deck */}
      <rect
        x="4"
        y="64"
        width="92"
        height="6.5"
        rx="3.25"
        className="fill-zinc-200/80 stroke-zinc-400/70 dark:fill-white/20 dark:stroke-white/50"
        strokeWidth="1.2"
      />

      {/* Pier Supports (Inverted V Trusses) */}
      <path
        d="M 12 86 L 24 71 L 36 86"
        className="stroke-zinc-400/80 dark:stroke-white/50"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M 64 86 L 76 71 L 88 86"
        className="stroke-zinc-400/80 dark:stroke-white/50"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Base Foundation Line */}
      <line
        x1="4"
        y1="87"
        x2="96"
        y2="87"
        className="stroke-zinc-300/80 dark:stroke-white/30"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface BrandLogoProps {
  className?: string;
  iconSize?: number | string;
  showText?: boolean;
  textClassName?: string;
  vyaparClassName?: string;
  setuClassName?: string;
  text?: string;
  iconColor?: string;
}

export function BrandLogo({
  className,
  iconSize = 32,
  showText = true,
  textClassName,
  vyaparClassName,
  setuClassName,
  text = "VyaparSetu",
  iconColor = "#00C26F",
}: BrandLogoProps) {
  // If the brand name contains "Vyapar" and "Setu", render split styling matching the design
  const isDefaultBrand = text === "VyaparSetu" || text === "Vyapar Setu";

  const defaultVyaparColor = textClassName?.includes("text-white")
    ? "text-white"
    : "text-zinc-900 dark:text-zinc-100";

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <VyaparSetuIcon size={iconSize} color={iconColor} className="shrink-0" />
      {showText && (
        <span
          className={cn(
            "font-sans font-bold text-xl tracking-tight leading-none inline-flex items-baseline",
            textClassName
          )}
        >
          {isDefaultBrand ? (
            <>
              <span className={cn(defaultVyaparColor, vyaparClassName)}>
                Vyapar
              </span>
              <span
                className={cn(
                  "text-[#00C26F] dark:text-[#00C26F]",
                  setuClassName
                )}
              >
                Setu
              </span>
            </>
          ) : (
            <span className={cn("text-[#00C26F]", vyaparClassName)}>{text}</span>
          )}
        </span>
      )}
    </div>
  );
}
