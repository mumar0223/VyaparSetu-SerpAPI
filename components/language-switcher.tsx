"use client";

import { Globe, Check, ChevronDown } from "lucide-react";
import { useTranslation, AVAILABLE_LANGUAGES, LanguageCode } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface LanguageSwitcherProps {
  variant?: "header" | "sidebar" | "brand" | "compact";
  className?: string;
}

export function LanguageSwitcher({
  variant = "header",
  className,
}: LanguageSwitcherProps) {
  const { language, setLanguage } = useTranslation();

  const currentLang =
    AVAILABLE_LANGUAGES.find((l) => l.code === language) || AVAILABLE_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1.5 rounded-xl transition-all cursor-pointer select-none focus:outline-hidden",
          variant === "brand" &&
            "h-8 px-2.5 text-xs font-semibold bg-mint-pale/80 dark:bg-mint/10 hover:bg-mint-pale dark:hover:bg-mint/20 border border-mint/30 text-forest dark:text-mint rounded-xl shadow-2xs",
          variant === "header" &&
            "px-3 py-1.5 text-xs font-medium bg-muted/50 hover:bg-muted border border-border text-foreground shadow-xs",
          variant === "sidebar" &&
            "w-full px-3 py-2 text-xs font-medium bg-sage/10 hover:bg-sage/20 border border-sage/30 text-ink justify-between",
          variant === "compact" &&
            "p-1.5 text-xs rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground",
          className
        )}
      >
        <Globe className="size-3.5 shrink-0 text-mint" />
        <span className="truncate text-xs font-medium">
          {currentLang.nativeName}
        </span>
        <ChevronDown className="size-3 opacity-60 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-56 rounded-2xl bg-popover/95 backdrop-blur-md border border-border shadow-2xl p-2 z-50 max-h-72 overflow-y-auto"
      >
        <div className="px-2.5 py-1 text-[10.5px] font-bold tracking-wider uppercase text-muted-foreground select-none">
          Select Language (भाषा चुनें)
        </div>
        <DropdownMenuSeparator className="my-1.5 opacity-60" />

        <div className="flex flex-col gap-1.5 pt-0.5">
          {AVAILABLE_LANGUAGES.map((lang) => {
            const active = language === lang.code;
            return (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => setLanguage(lang.code as LanguageCode)}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer",
                  active
                    ? "bg-mint/15 text-forest dark:text-mint font-bold border border-mint/40 shadow-xs"
                    : "text-foreground hover:bg-muted border border-transparent"
                )}
              >
                <div className="flex flex-col leading-tight">
                  <span className="text-[13.5px] font-semibold">{lang.nativeName}</span>
                  <span className="text-[10.5px] text-muted-foreground mt-0.5">
                    {lang.name}
                  </span>
                </div>
                {active && <Check className="size-4 text-mint shrink-0 stroke-[2.5]" />}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
