"use client";

import { useEffect, useRef, useCallback } from "react";

const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;

interface RemoteSyncData {
  vocabulary?: Record<string, unknown>;
  bookProgress?: Record<string, unknown>;
  books?: unknown[];
}

interface UsePeriodicSyncOptions {
  syncCode: string | null;
  syncing: boolean;
  performSync: () => Promise<RemoteSyncData | null | undefined>;
  enabled?: boolean;
}

interface UsePeriodicSyncReturn {
  triggerSync: () => void;
}

/**
 * 自动定时同步 Hook
 *
 * - 仅当用户已绑定同步码（syncCode 有值）时才启动定时器
 * - 仅在前台连续阅读满 10 分钟时触发同步
 * - 页面隐藏时暂停定时器，恢复可见时继续剩余计时
 * - 若上一次同步尚未完成，跳过本轮触发
 * - 自动同步失败时静默处理，不弹窗打扰用户
 */
export function usePeriodicSync({
  syncCode,
  syncing,
  performSync,
  enabled = true,
}: UsePeriodicSyncOptions): UsePeriodicSyncReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logicRef = useRef({ syncCode, syncing, performSync });
  const isVisibleRef = useRef(true);
  // 前台已累积的阅读时间（毫秒），达到 AUTO_SYNC_INTERVAL_MS 时触发同步
  const elapsedRef = useRef(0);
  // 上次恢复可见（或定时器启动）的时间戳，用于计算本次前台时长
  const visibleSinceRef = useRef(Date.now());

  useEffect(() => {
    logicRef.current = { syncCode, syncing, performSync };
  }, [syncCode, syncing, performSync]);

  const doSyncRef = useRef<(() => Promise<void>) | null>(null);

  const initDoSync = useCallback(() => {
    const syncFn = async () => {
      const logic = logicRef.current;

      if (!logic.syncCode || logic.syncing) {
        return;
      }

      try {
        await logic.performSync();
        console.log('[AutoSync] 自动同步完成');
      } catch (err) {
        console.warn('[AutoSync] 自动同步失败:', err instanceof Error ? err.message : '未知错误');
      }
    };
    doSyncRef.current = syncFn;
    return syncFn;
  }, []);

  useEffect(() => {
    initDoSync();
  }, [initDoSync]);

  // 启动一个 setTimeout，delay = 剩余需要等待的前台时间
  const scheduleNext = useCallback((remainingMs: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const logic = logicRef.current;
    if (!logic.syncCode || !enabled || !isVisibleRef.current) {
      return;
    }

    const delay = Math.max(remainingMs, 0);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      doSyncRef.current?.();
      // 同步后重置累积时间，开始下一轮计时
      elapsedRef.current = 0;
      visibleSinceRef.current = Date.now();
      scheduleNext(AUTO_SYNC_INTERVAL_MS);
    }, delay);
  }, [enabled]);

  // 启动/停止定时器
  useEffect(() => {
    isVisibleRef.current = document.visibilityState === 'visible';
    elapsedRef.current = 0;
    visibleSinceRef.current = Date.now();

    if (document.visibilityState === 'visible') {
      scheduleNext(AUTO_SYNC_INTERVAL_MS);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, syncCode, scheduleNext]);

  // 处理 visibility 变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        isVisibleRef.current = true;
        visibleSinceRef.current = Date.now();
        // 用剩余的前台时间继续计时
        const remaining = AUTO_SYNC_INTERVAL_MS - elapsedRef.current;
        scheduleNext(remaining);
      } else {
        // 页面变隐藏：累加本次前台时长，暂停定时器
        isVisibleRef.current = false;
        const thisSessionMs = Date.now() - visibleSinceRef.current;
        elapsedRef.current += thisSessionMs;

        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [scheduleNext]);

  const triggerSync = useCallback(() => {
    doSyncRef.current?.();
  }, []);

  return { triggerSync };
}
