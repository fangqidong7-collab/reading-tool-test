"use client";

import { useState, useEffect, useCallback } from "react";

export interface ReadingSettings {
  fontSize: number;
  lineHeight: number;
  backgroundColor: string;
  textColor: string;
  headerBg: string;
  headerTextColor: string;
  annotationColor: string;
  highlightBg: string;
  highlightBgHover: string;
  sidebarBg: string;
  isDarkMode: boolean;
}

export interface ReadingSettingsStorage {
  fontSize: number;
  lineHeight: number;
  backgroundTheme: string;
  sidebarOpenByBook: Record<string, boolean>;
  dictMode: 'zh' | 'en';
}

const DEFAULT_SETTINGS: ReadingSettings = {
  fontSize: 16,
  lineHeight: 1.4,
  backgroundColor: "#FFF8F0",
  textColor: "#333333",
  headerBg: "#FFFFFF",
  headerTextColor: "#333333",
  annotationColor: "#E74C3C",
  highlightBg: "#FFF3CD",
  highlightBgHover: "#FFE69C",
  sidebarBg: "#FFFFFF",
  isDarkMode: false,
};

const DICT_MODE_KEY = "reading-dict-mode";

export const BACKGROUND_THEMES = [
  { id: "white", bg: "#FFFFFF", text: "#333333", name: "白色" },
  { id: "cream", bg: "#FFF8F0", text: "#333333", name: "米色" },
  { id: "lightGreen", bg: "#E8F5E9", text: "#2E3B2E", name: "浅绿" },
  { id: "lightBlue", bg: "#E3F2FD", text: "#1A2A3A", name: "浅蓝" },
  { id: "lightGray", bg: "#F0F0F0", text: "#333333", name: "浅灰" },
  { id: "dark", bg: "#1A1A2E", text: "#CCCCCC", name: "夜间", isDark: true },
];

const STORAGE_KEY = "english-reader-settings";

function getThemeColors(themeId: string): ReadingSettings {
  const theme = BACKGROUND_THEMES.find((t) => t.id === themeId) || BACKGROUND_THEMES[1];
  const isDark = theme.isDark || false;

  return {
    fontSize: 16,
    lineHeight: 1.4,
    backgroundColor: theme.bg,
    textColor: theme.text,
    headerBg: isDark ? "#16213E" : "#FFFFFF",
    headerTextColor: isDark ? "#FFFFFF" : "#333333",
    annotationColor: isDark ? "#FF8C42" : "#E74C3C",
    highlightBg: isDark ? "#3D3522" : "#FFF3CD",
    highlightBgHover: isDark ? "#4A4228" : "#FFE69C",
    sidebarBg: isDark ? "#1E1E32" : "#FFFFFF",
    isDarkMode: isDark,
  };
}

function loadSettingsFromStorage(): ReadingSettingsStorage {
  if (typeof window === "undefined") {
    return {
      fontSize: DEFAULT_SETTINGS.fontSize,
      lineHeight: DEFAULT_SETTINGS.lineHeight,
      backgroundTheme: "cream",
      sidebarOpenByBook: {},
      dictMode: "zh",
    };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Failed to load reading settings:", e);
  }

  return {
    fontSize: DEFAULT_SETTINGS.fontSize,
    lineHeight: DEFAULT_SETTINGS.lineHeight,
    backgroundTheme: "cream",
    sidebarOpenByBook: {},
    dictMode: "zh",
  };
}

function saveSettingsToStorage(settings: ReadingSettingsStorage) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save reading settings:", e);
  }
}

export function useReadingSettings() {
  const [settings, setSettings] = useState<ReadingSettings>(DEFAULT_SETTINGS);
  const [storage, setStorage] = useState<ReadingSettingsStorage>({
    fontSize: DEFAULT_SETTINGS.fontSize,
    lineHeight: DEFAULT_SETTINGS.lineHeight,
    backgroundTheme: "cream",
    sidebarOpenByBook: {},
    dictMode: "zh",
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [dictMode, setDictModeState] = useState<'zh' | 'en'>('zh');

  // Load settings on mount
  useEffect(() => {
    const loaded = loadSettingsFromStorage();
    setStorage(loaded);
    setDictModeState(loaded.dictMode || 'zh');
    const colors = getThemeColors(loaded.backgroundTheme);
    setSettings({
      ...colors,
      fontSize: loaded.fontSize,
      lineHeight: loaded.lineHeight,
    });
    setIsLoaded(true);
  }, []);

  // Save settings when they change
  useEffect(() => {
    if (isLoaded) {
      saveSettingsToStorage({
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        backgroundTheme: storage.backgroundTheme,
        sidebarOpenByBook: storage.sidebarOpenByBook,
        dictMode: storage.dictMode,
      });
    }
  }, [settings, storage, isLoaded]);

  // Set font size
  const setFontSize = useCallback((size: number) => {
    const clampedSize = Math.max(14, Math.min(28, size));
    setSettings((prev) => ({ ...prev, fontSize: clampedSize }));
    setStorage((prev) => ({ ...prev, fontSize: clampedSize }));
  }, []);

  // Set line height
  const setLineHeight = useCallback((height: number) => {
    const clampedHeight = Math.max(1.2, Math.min(2.5, height));
    setSettings((prev) => ({ ...prev, lineHeight: clampedHeight }));
    setStorage((prev) => ({ ...prev, lineHeight: clampedHeight }));
  }, []);

  // Set background theme
  const setBackgroundTheme = useCallback((themeId: string) => {
    const colors = getThemeColors(themeId);
    setSettings((prev) => ({
      ...prev,
      ...colors,
      fontSize: storage.fontSize,
      lineHeight: storage.lineHeight,
    }));
    setStorage((prev) => ({ ...prev, backgroundTheme: themeId }));
  }, [storage.fontSize, storage.lineHeight]);

  // Get sidebar state for a specific book
  const getSidebarState = useCallback((bookId: string): boolean => {
    return storage.sidebarOpenByBook[bookId] ?? false;
  }, [storage.sidebarOpenByBook]);

  // Set sidebar state for a specific book
  const setSidebarState = useCallback((bookId: string, isOpen: boolean) => {
    setStorage((prev) => ({
      ...prev,
      sidebarOpenByBook: {
        ...prev.sidebarOpenByBook,
        [bookId]: isOpen,
      },
    }));
  }, []);

  // Reset all settings to default
  const resetToDefault = useCallback(() => {
    const defaultTheme = "cream";
    const colors = getThemeColors(defaultTheme);
    setSettings({
      ...colors,
      fontSize: 16,
      lineHeight: 1.4,
    });
    setStorage((prev) => ({
      ...prev,
      fontSize: 16,
      lineHeight: 1.4,
      backgroundTheme: defaultTheme,
      sidebarOpenByBook: {},
    }));
    setDictModeState('zh');
  }, []);

  // Set dictionary mode (zh for Chinese, en for English)
  const setDictMode = useCallback((mode: 'zh' | 'en') => {
    setDictModeState(mode);
    setStorage((prev) => ({ ...prev, dictMode: mode }));
  }, []);

  // Calculate annotation font size (70% of body font size)
  const annotationFontSize = Math.round(settings.fontSize * 0.7);

  return {
    settings,
    isLoaded,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
    headerBg: settings.headerBg,
    headerTextColor: settings.headerTextColor,
    annotationColor: settings.annotationColor,
    annotationFontSize,
    highlightBg: settings.highlightBg,
    highlightBgHover: settings.highlightBgHover,
    sidebarBg: settings.sidebarBg,
    isDarkMode: settings.isDarkMode,
    currentTheme: storage.backgroundTheme,
    setFontSize,
    setLineHeight,
    setBackgroundTheme,
    getSidebarState,
    setSidebarState,
    resetToDefault,
    dictMode,
    setDictMode,
  };
}
