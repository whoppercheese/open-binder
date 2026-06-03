/**
 * Type theme accent colors from Pokémon Sword/Shield UI:
 * symbol → accent, attack → hover + accent text.
 * @see https://www.pokemonaaah.net/news/2019/12/sword-shield-type-symbols-and-color-guide/
 */
export const COLOR_THEMES = [
  "default",
  "psycho",
  "fire",
  "electric",
  "leaf",
  "ice",
  "water",
  "dragon",
  "fairy",
  "ghost",
  "normal",
  "dark",
] as const;

export type ColorThemeId = (typeof COLOR_THEMES)[number];

export const DEFAULT_COLOR_THEME: ColorThemeId = "default";

export type ThemeTokens = {
  accent: string;
  accentHover: string;
  accentText: string;
  accentTextSoft: string;
  /** Text on solid accent backgrounds (buttons, selected chips). */
  accentForeground: string;
};

export type ThemeDefinition = {
  id: ColorThemeId;
  previewColor: string;
  tokens: ThemeTokens;
};

const ACCENT_FG_DARK = "#000000";
const ACCENT_FG_LIGHT = "#ffffff";

export const THEME_DEFINITIONS: Record<ColorThemeId, ThemeDefinition> = {
  default: {
    id: "default",
    previewColor: "#10b981",
    tokens: {
      accent: "#10b981",
      accentHover: "#34d399",
      accentText: "#6ee7b7",
      accentTextSoft: "#a7f3d0",
      accentForeground: ACCENT_FG_DARK,
    },
  },
  electric: {
    id: "electric",
    previewColor: "#f4d43b",
    tokens: {
      accent: "#f4d43b",
      accentHover: "#f6dc85",
      accentText: "#f6dc85",
      accentTextSoft: "#faf0a5",
      accentForeground: ACCENT_FG_DARK,
    },
  },
  water: {
    id: "water",
    previewColor: "#4e92d2",
    tokens: {
      accent: "#4e92d2",
      accentHover: "#8cade0",
      accentText: "#8cade0",
      accentTextSoft: "#b3cce8",
      accentForeground: ACCENT_FG_LIGHT,
    },
  },
  psycho: {
    id: "psycho",
    previewColor: "#fb717b",
    tokens: {
      accent: "#fb717b",
      accentHover: "#fa9c9d",
      accentText: "#fa9c9d",
      accentTextSoft: "#fcc5c6",
      accentForeground: ACCENT_FG_DARK,
    },
  },
  leaf: {
    id: "leaf",
    previewColor: "#63bc5a",
    tokens: {
      accent: "#63bc5a",
      accentHover: "#94cc8f",
      accentText: "#94cc8f",
      accentTextSoft: "#b0dba8",
      accentForeground: ACCENT_FG_DARK,
    },
  },
  fire: {
    id: "fire",
    previewColor: "#ff9d54",
    tokens: {
      accent: "#ff9d54",
      accentHover: "#ffb68d",
      accentText: "#ffb68d",
      accentTextSoft: "#ffd4b8",
      accentForeground: ACCENT_FG_DARK,
    },
  },
  dragon: {
    id: "dragon",
    previewColor: "#0c6cc4",
    tokens: {
      accent: "#0c6cc4",
      accentHover: "#7a99cf",
      accentText: "#9eb0d8",
      accentTextSoft: "#b8c8e8",
      accentForeground: ACCENT_FG_LIGHT,
    },
  },
  fairy: {
    id: "fairy",
    previewColor: "#ed91e3",
    tokens: {
      accent: "#ed91e3",
      accentHover: "#f2adec",
      accentText: "#f2adec",
      accentTextSoft: "#f9d4f5",
      accentForeground: ACCENT_FG_DARK,
    },
  },
  ghost: {
    id: "ghost",
    previewColor: "#705898",
    tokens: {
      // Bulbapedia Ghost type (#705898) — purple, matches „Geist-Lila“ / Gengar.
      // Sw/Sh symbol (#526aad) is blue-indigo; too close to Dark and not purple.
      accent: "#705898",
      accentHover: "#8e6bb8",
      accentText: "#b8a8d0",
      accentTextSoft: "#d4c8e8",
      accentForeground: ACCENT_FG_LIGHT,
    },
  },
  normal: {
    id: "normal",
    previewColor: "#909ca2",
    tokens: {
      accent: "#909ca2",
      accentHover: "#acb4b7",
      accentText: "#acb4b7",
      accentTextSoft: "#c8cdd1",
      accentForeground: ACCENT_FG_DARK,
    },
  },
  dark: {
    id: "dark",
    previewColor: "#5a5467",
    tokens: {
      accent: "#5a5467",
      accentHover: "#908d96",
      accentText: "#908d96",
      accentTextSoft: "#b0adb8",
      accentForeground: ACCENT_FG_LIGHT,
    },
  },
  ice: {
    id: "ice",
    previewColor: "#73d0bd",
    tokens: {
      accent: "#73d0bd",
      accentHover: "#9cdacd",
      accentText: "#9cdacd",
      accentTextSoft: "#bceee3",
      accentForeground: ACCENT_FG_DARK,
    },
  },
};

export function isColorThemeId(value: string): value is ColorThemeId {
  return (COLOR_THEMES as readonly string[]).includes(value);
}

/** Maps legacy theme ids to current ids. */
export function normalizeColorTheme(value: string): ColorThemeId {
  if (value === "pokemon") {
    return "electric";
  }
  if (value === "grass") {
    return "leaf";
  }
  if (value === "poison") {
    return DEFAULT_COLOR_THEME;
  }
  return isColorThemeId(value) ? value : DEFAULT_COLOR_THEME;
}

export const THEME_I18N_KEYS: Record<ColorThemeId, string> = {
  default: "settings.colorThemeDefault",
  electric: "settings.colorThemeElectric",
  water: "settings.colorThemeWater",
  psycho: "settings.colorThemePsycho",
  leaf: "settings.colorThemeLeaf",
  fire: "settings.colorThemeFire",
  dragon: "settings.colorThemeDragon",
  fairy: "settings.colorThemeFairy",
  ghost: "settings.colorThemeGhost",
  normal: "settings.colorThemeNormal",
  dark: "settings.colorThemeDark",
  ice: "settings.colorThemeIce",
};
