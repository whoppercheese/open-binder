import type { CSSProperties } from "react";
import type { ThemeTokens } from "@/lib/theme/themes";

export function themeTokensToStyle(tokens: ThemeTokens): CSSProperties {
  return {
    "--accent": tokens.accent,
    "--accent-hover": tokens.accentHover,
    "--accent-text": tokens.accentText,
    "--accent-text-soft": tokens.accentTextSoft,
    "--accent-foreground": tokens.accentForeground,
  } as CSSProperties;
}

export function applyThemeTokensToDocument(tokens: ThemeTokens) {
  const root = document.documentElement;
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--accent-hover", tokens.accentHover);
  root.style.setProperty("--accent-text", tokens.accentText);
  root.style.setProperty("--accent-text-soft", tokens.accentTextSoft);
  root.style.setProperty("--accent-foreground", tokens.accentForeground);
}
