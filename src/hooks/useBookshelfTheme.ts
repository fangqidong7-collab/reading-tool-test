"use client";

import { useState, useEffect, useCallback } from "react";

export interface CoverColor {
  bg: string;
  spine: string;
}

export interface BookshelfTheme {
  id: string;
  name: string;
  pageBg: string;
  accent: string;
  textColor: string;
  searchBg: string;
  searchBorder: string;
  isDark?: boolean;
  coverPalette: CoverColor[];
}

export const BOOKSHELF_THEMES: BookshelfTheme[] = [
  {
    id: "mist",
    name: "薄雾",
    pageBg: "#D8DEE6",
    accent: "#8898A8",
    textColor: "#333333",
    searchBg: "#ffffff",
    searchBorder: "#c8cdd3",
    coverPalette: [
      { bg: "#8EA8B8", spine: "#7A95A5" },
      { bg: "#9AAE8E", spine: "#889C7D" },
      { bg: "#A898AB", spine: "#958698" },
      { bg: "#B0A494", spine: "#9D9183" },
      { bg: "#8898A8", spine: "#76879A" },
      { bg: "#93AE9A", spine: "#819C88" },
      { bg: "#8BA59E", spine: "#7A9490" },
      { bg: "#7E8F9C", spine: "#6E7F8C" },
      { bg: "#A89890", spine: "#968680" },
      { bg: "#9CABA0", spine: "#8A9A8F" },
      { bg: "#A5A0B0", spine: "#938EA0" },
      { bg: "#B0A898", spine: "#9E9688" },
    ],
  },
  {
    id: "forest",
    name: "森林",
    pageBg: "#E4EDE0",
    accent: "#3A7D44",
    textColor: "#2E3B2E",
    searchBg: "#ffffff",
    searchBorder: "#c2d4be",
    coverPalette: [
      { bg: "#3A7D44", spine: "#2E6636" },
      { bg: "#2E8B8B", spine: "#257272" },
      { bg: "#4B6B03", spine: "#3D5902" },
      { bg: "#5E8C31", spine: "#4D7528" },
      { bg: "#66A355", spine: "#558B45" },
      { bg: "#5B8FB9", spine: "#4A7A9E" },
      { bg: "#C4956A", spine: "#B0835A" },
      { bg: "#D4735E", spine: "#BE6350" },
      { bg: "#B8A44C", spine: "#A09040" },
      { bg: "#7CB342", spine: "#689F38" },
      { bg: "#3B5998", spine: "#304A80" },
      { bg: "#8B6B4A", spine: "#76593D" },
    ],
  },
  {
    id: "ocean",
    name: "深海",
    pageBg: "#0F1B33",
    accent: "#3A8FB7",
    textColor: "#E0E8F0",
    searchBg: "rgba(255,255,255,0.08)",
    searchBorder: "rgba(255,255,255,0.18)",
    isDark: true,
    coverPalette: [
      { bg: "#1B4F72", spine: "#154060" },
      { bg: "#2E8B8B", spine: "#257272" },
      { bg: "#1A3A5C", spine: "#142E4A" },
      { bg: "#4682B4", spine: "#3A6F9A" },
      { bg: "#1F6E6E", spine: "#185A5A" },
      { bg: "#2C3E6B", spine: "#233258" },
      { bg: "#2E7D6A", spine: "#246856" },
      { bg: "#3D5A80", spine: "#324A6A" },
      { bg: "#2A6496", spine: "#22537C" },
      { bg: "#1B5E7A", spine: "#154D66" },
      { bg: "#1A6B6B", spine: "#145858" },
      { bg: "#344E7A", spine: "#2B4066" },
    ],
  },
  {
    id: "rose",
    name: "玫瑰",
    pageBg: "#F5EDE4",
    accent: "#C4887A",
    textColor: "#5A4A42",
    searchBg: "#ffffff",
    searchBorder: "#ddd0c8",
    coverPalette: [
      { bg: "#C4887A", spine: "#B07668" },
      { bg: "#8BA68E", spine: "#7A957D" },
      { bg: "#E0CAB8", spine: "#CCB6A4" },
      { bg: "#B87360", spine: "#A46252" },
      { bg: "#7A9A6D", spine: "#68855C" },
      { bg: "#D4A0A0", spine: "#C08E8E" },
      { bg: "#C8A08A", spine: "#B48E78" },
      { bg: "#8B9A6B", spine: "#78855B" },
      { bg: "#B09090", spine: "#9E7E7E" },
      { bg: "#C8B8A0", spine: "#B4A48E" },
      { bg: "#D4B0A0", spine: "#C09E8E" },
      { bg: "#7B9B7A", spine: "#688568" },
    ],
  },
];

const STORAGE_KEY = "bookshelf-theme";

export function useBookshelfTheme() {
  const [themeId, setThemeIdState] = useState("mist");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && BOOKSHELF_THEMES.some((t) => t.id === saved)) {
        setThemeIdState(saved);
      }
    } catch {
      // ignore
    }
    setIsLoaded(true);
  }, []);

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const theme =
    BOOKSHELF_THEMES.find((t) => t.id === themeId) || BOOKSHELF_THEMES[0];

  return { theme, themeId, setThemeId, isLoaded };
}
