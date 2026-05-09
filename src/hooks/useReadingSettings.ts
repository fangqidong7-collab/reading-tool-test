"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

export type VocabLevelSetting = 'off' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type FontFamilySetting = 'serif' | 'sans-serif' | 'system';

export const FONT_FAMILIES: { id: FontFamilySetting; label: string; css: string }[] = [
  { id: 'serif', label: '衬线体', css: 'Georgia, "Times New Roman", "Noto Serif", serif' },
  { id: 'sans-serif', label: '无衬线', css: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { id: 'system', label: '系统默认', css: 'inherit' },
];

export interface ReadingSettingsStorage {
  fontSize: number;
  lineHeight: number;
  backgroundTheme: string;
  sidebarOpenByBook: Record<string, boolean>;
  dictMode: 'zh' | 'en' | 'en-simple';
  pageTurnRatio: number;
  clickToTurnPage: boolean;
  vocabLevel: VocabLevelSetting;
  fontFamily: FontFamilySetting;
  autoTheme: boolean;
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
  const defaults: ReadingSettingsStorage = {
    fontSize: DEFAULT_SETTINGS.fontSize,
    lineHeight: DEFAULT_SETTINGS.lineHeight,
    backgroundTheme: "cream",
    sidebarOpenByBook: {},
    dictMode: "zh",
    pageTurnRatio: 0.9,
    clickToTurnPage: false,
    vocabLevel: "off" as VocabLevelSetting,
    fontFamily: "serif" as FontFamilySetting,
    autoTheme: false,
  };
  if (typeof window === "undefined") return defaults;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaults,
        ...parsed,
        clickToTurnPage: parsed.clickToTurnPage ?? false,
        vocabLevel: parsed.vocabLevel ?? 'off',
        fontFamily: parsed.fontFamily ?? 'serif',
        autoTheme: parsed.autoTheme ?? false,
      };
    }
  } catch (e) {
    console.warn("Failed to load reading settings:", e);
  }

  return defaults;
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
    pageTurnRatio: 0.9,
    clickToTurnPage: false,
    vocabLevel: "off",
    fontFamily: "serif",
    autoTheme: false,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [dictMode, setDictModeState] = useState<'zh' | 'en' | 'en-simple'>('zh');
  const [pageTurnRatio, setPageTurnRatioState] = useState(0.9);
  const [clickToTurnPage, setClickToTurnPageState] = useState(false);
  const [vocabLevel, setVocabLevelState] = useState<VocabLevelSetting>('off');
  const [fontFamily, setFontFamilyState] = useState<FontFamilySetting>('serif');
  const [autoTheme, setAutoThemeState] = useState(false);
  const autoThemeRef = useRef(false);

  // Load settings on mount
  useEffect(() => {
    const loaded = loadSettingsFromStorage();
    setStorage(loaded);
    setDictModeState(loaded.dictMode || 'zh');
    setPageTurnRatioState(loaded.pageTurnRatio ?? 0.9);
    setClickToTurnPageState(loaded.clickToTurnPage ?? false);
    setVocabLevelState(loaded.vocabLevel ?? 'off');
    setFontFamilyState(loaded.fontFamily ?? 'serif');
    setAutoThemeState(loaded.autoTheme ?? false);
    autoThemeRef.current = loaded.autoTheme ?? false;

    let themeId = loaded.backgroundTheme;
    if (loaded.autoTheme && typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      themeId = prefersDark ? 'dark' : (loaded.backgroundTheme === 'dark' ? 'cream' : loaded.backgroundTheme);
    }
    const colors = getThemeColors(themeId);
    setSettings({
      ...colors,
      fontSize: loaded.fontSize,
      lineHeight: loaded.lineHeight,
    });
    setIsLoaded(true);
  }, []);

  // Listen for system theme changes when autoTheme is enabled
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!autoThemeRef.current) return;
      const themeId = e.matches ? 'dark' : 'cream';
      const colors = getThemeColors(themeId);
      setSettings((prev) => ({ ...prev, ...colors }));
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
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
        pageTurnRatio: storage.pageTurnRatio,
        clickToTurnPage: storage.clickToTurnPage,
        vocabLevel: storage.vocabLevel,
        fontFamily: storage.fontFamily,
        autoTheme: storage.autoTheme,
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

  // Set background theme (also disables autoTheme when user manually picks)
  const setBackgroundTheme = useCallback((themeId: string) => {
    autoThemeRef.current = false;
    setAutoThemeState(false);
    const colors = getThemeColors(themeId);
    setSettings((prev) => ({
      ...prev,
      ...colors,
      fontSize: storage.fontSize,
      lineHeight: storage.lineHeight,
    }));
    setStorage((prev) => ({ ...prev, backgroundTheme: themeId, autoTheme: false }));
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
    autoThemeRef.current = false;
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
      clickToTurnPage: false,
      fontFamily: 'serif',
      autoTheme: false,
    }));
    setDictModeState('zh');
    setPageTurnRatioState(0.9);
    setClickToTurnPageState(false);
    setVocabLevelState('off');
    setFontFamilyState('serif');
    setAutoThemeState(false);
  }, []);

  const setDictMode = useCallback((mode: 'zh' | 'en' | 'en-simple') => {
    setDictModeState(mode);
    setStorage((prev) => ({ ...prev, dictMode: mode }));
  }, []);

  // Set page turn ratio
  const setPageTurnRatio = useCallback((ratio: number) => {
    const clamped = Math.max(0.5, Math.min(1.0, ratio));
    setPageTurnRatioState(clamped);
    setStorage((prev) => ({ ...prev, pageTurnRatio: clamped }));
  }, []);

  // Set click to turn page mode
  const setClickToTurnPage = useCallback((enabled: boolean) => {
    setClickToTurnPageState(enabled);
    setStorage((prev) => ({ ...prev, clickToTurnPage: enabled }));
  }, []);

  const setVocabLevel = useCallback((level: string) => {
    const val = level as VocabLevelSetting;
    setVocabLevelState(val);
    setStorage((prev) => ({ ...prev, vocabLevel: val }));
  }, []);

  const setFontFamily = useCallback((family: FontFamilySetting) => {
    setFontFamilyState(family);
    setStorage((prev) => ({ ...prev, fontFamily: family }));
  }, []);

  const setAutoTheme = useCallback((enabled: boolean) => {
    autoThemeRef.current = enabled;
    setAutoThemeState(enabled);
    setStorage((prev) => ({ ...prev, autoTheme: enabled }));
    if (enabled && typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const themeId = prefersDark ? 'dark' : 'cream';
      const colors = getThemeColors(themeId);
      setSettings((prev) => ({ ...prev, ...colors }));
    }
  }, []);

  const annotationFontSize = Math.round(settings.fontSize * 0.7);

  const fontFamilyCss = FONT_FAMILIES.find(f => f.id === fontFamily)?.css
    ?? FONT_FAMILIES[0].css;

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
    pageTurnRatio,
    setPageTurnRatio,
    clickToTurnPage,
    setClickToTurnPage,
    vocabLevel,
    setVocabLevel,
    fontFamily,
    fontFamilyCss,
    setFontFamily,
    autoTheme,
    setAutoTheme,
  };
}
