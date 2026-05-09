"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const STORAGE_KEY = "reading-stats";
const TICK_INTERVAL_MS = 60_000;

export interface DailyRecord {
  /** Minutes spent reading */
  minutes: number;
  /** Number of words read (processed) */
  wordsRead: number;
}

export interface ReadingStatsData {
  /** yyyy-MM-dd → DailyRecord */
  daily: Record<string, DailyRecord>;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadStats(): ReadingStatsData {
  if (typeof window === 'undefined') return { daily: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { daily: {} };
}

function saveStats(data: ReadingStatsData) {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(data.daily).sort();
    if (keys.length > 90) {
      const cutoff = keys[keys.length - 90];
      for (const k of keys) {
        if (k < cutoff) delete data.daily[k];
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota */ }
}

export interface WeekSummary {
  label: string;
  minutes: number;
}

export interface ReadingStatsReturn {
  todayMinutes: number;
  weekData: WeekSummary[];
  monthMinutes: number;
  totalMinutes: number;
  streak: number;
}

function getDateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function computeStats(data: ReadingStatsData): ReadingStatsReturn {
  const today = todayKey();
  const todayMinutes = data.daily[today]?.minutes || 0;

  const weekData: WeekSummary[] = [];
  for (let i = -6; i <= 0; i++) {
    const key = getDateStr(i);
    const d = new Date();
    d.setDate(d.getDate() + i);
    weekData.push({
      label: DAY_LABELS[d.getDay()],
      minutes: data.daily[key]?.minutes || 0,
    });
  }

  let monthMinutes = 0;
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  for (const [k, v] of Object.entries(data.daily)) {
    if (k.startsWith(monthPrefix)) monthMinutes += v.minutes;
  }

  let totalMinutes = 0;
  for (const v of Object.values(data.daily)) totalMinutes += v.minutes;

  let streak = 0;
  for (let i = 0; i >= -365; i--) {
    const key = getDateStr(i);
    if ((data.daily[key]?.minutes || 0) > 0) {
      streak++;
    } else {
      if (i < 0) break;
    }
  }

  return { todayMinutes, weekData, monthMinutes, totalMinutes, streak };
}

/**
 * Tracks foreground reading time. Only ticks when the page is visible
 * and a book is open (isReading=true).
 */
export function useReadingStats(isReading: boolean): ReadingStatsReturn {
  const statsRef = useRef<ReadingStatsData>(loadStats());
  const [summary, setSummary] = useState<ReadingStatsReturn>(() => computeStats(statsRef.current));

  const tick = useCallback(() => {
    const key = todayKey();
    const data = statsRef.current;
    if (!data.daily[key]) data.daily[key] = { minutes: 0, wordsRead: 0 };
    data.daily[key].minutes += 1;
    saveStats(data);
    setSummary(computeStats(data));
  }, []);

  useEffect(() => {
    if (!isReading) return;
    if (typeof document === 'undefined') return;

    let timerId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timerId) return;
      timerId = setInterval(tick, TICK_INTERVAL_MS);
    };
    const stop = () => {
      if (timerId) { clearInterval(timerId); timerId = null; }
    };

    const onVisChange = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [isReading, tick]);

  useEffect(() => {
    statsRef.current = loadStats();
    setSummary(computeStats(statsRef.current));
  }, []);

  return summary;
}
