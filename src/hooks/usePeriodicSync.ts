"use client";

import { useEffect, useRef, useCallback } from "react";

// 自动同步间隔：10 分钟（毫秒）
// 轻量同步足够快，10 分钟完全可行
const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;

interface RemoteSyncData {
  vocabulary?: Record<string, unknown>;
  bookProgress?: Record<string, unknown>;
  books?: unknown[];
}

interface UsePeriodicSyncOptions {
  // 当前同步码
  syncCode: string | null;
  // 是否正在同步中
  syncing: boolean;
  // 执行双向同步（与手动同步一致；负载在 performSync 内部构建）
  performSync: () => Promise<RemoteSyncData | null | undefined>;
  // 是否启用自动同步（默认 true）
  enabled?: boolean;
}

interface UsePeriodicSyncReturn {
  // 手动触发的同步函数（供外部调用，如清除定时器后手动补跑）
  triggerSync: () => void;
}

/**
 * 自动定时同步 Hook
 *
 * 行为：
 * - 仅当用户已绑定同步码（syncCode 有值）时才启动定时器
 * - 每隔 AUTO_SYNC_INTERVAL_MS（10分钟）执行一次同步
 * - 仅在页面可见时执行（监听 visibilitychange）
 * - 页面不可见时暂停计时，页面恢复可见时重新计时
 * - 若上一次同步尚未完成，跳过本轮触发
 * - 自动同步失败时静默处理，不弹窗打扰用户
 */
export function usePeriodicSync({
  syncCode,
  syncing,
  performSync,
  enabled = true,
}: UsePeriodicSyncOptions): UsePeriodicSyncReturn {
  // 使用 ref 保存定时器 ID，便于清理
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 使用 ref 保存同步逻辑的最新值
  const logicRef = useRef({ syncCode, syncing, performSync });
  // 使用 ref 标记是否需要立即同步（页面从隐藏变为可见时检查）
  const needImmediateSyncRef = useRef(false);
  // 使用 ref 标记页面是否可见
  const isVisibleRef = useRef(true);

  // 更新 logic ref
  useEffect(() => {
    logicRef.current = { syncCode, syncing, performSync };
  }, [syncCode, syncing, performSync]);

  // 执行一次同步的函数（通过 ref 访问最新值）
  const doSyncRef = useRef<(() => Promise<void>) | null>(null);

  // 初始化 doSync（内部同步逻辑）
  const initDoSync = useCallback(() => {
    const syncFn = async () => {
      const logic = logicRef.current;

      // 条件检查：syncCode 存在、非同步中
      if (!logic.syncCode || logic.syncing) {
        return;
      }

      // 构建数据并执行同步
      try {
        const remoteData = await logic.performSync();
        if (remoteData) {
          console.log('[AutoSync] 自动同步成功');
        }
      } catch (err) {
        // 自动同步失败时静默处理，仅记录日志
        console.warn('[AutoSync] 自动同步失败:', err instanceof Error ? err.message : '未知错误');
      }
    };
    doSyncRef.current = syncFn;
    return syncFn;
  }, []);

  // 初始化时设置 doSyncRef
  useEffect(() => {
    initDoSync();
  }, [initDoSync]);

  // 启动/停止定时器
  useEffect(() => {
    // 初始化可见状态
    isVisibleRef.current = document.visibilityState === 'visible';
    if (document.visibilityState === 'hidden') {
      needImmediateSyncRef.current = true;
    }

    const startInterval = () => {
      // 清除已有定时器
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const logic = logicRef.current;

      // 无 syncCode 或未启用或不处于可见状态时不启动定时器
      if (!logic.syncCode || !enabled || !isVisibleRef.current) {
        return;
      }

      timerRef.current = setInterval(() => {
        // 每次 interval 触发时，通过 ref 获取最新的 syncFn
        doSyncRef.current?.();
      }, AUTO_SYNC_INTERVAL_MS);
    };

    startInterval();

    return () => {
      // 组件卸载时清除定时器
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, syncCode]);

  // 处理 visibility 变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面变为可见
        isVisibleRef.current = true;
        if (needImmediateSyncRef.current) {
          // 清除标记
          needImmediateSyncRef.current = false;
          // 立即同步一次
          doSyncRef.current?.();
        }
        // 重新启动定时器
        const logic = logicRef.current;
        if (logic.syncCode && enabled) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          timerRef.current = setInterval(() => {
            doSyncRef.current?.();
          }, AUTO_SYNC_INTERVAL_MS);
        }
      } else {
        // 页面变为隐藏，暂停定时器
        isVisibleRef.current = false;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  // 手动触发同步（供外部调用）
  const triggerSync = useCallback(() => {
    doSyncRef.current?.();
  }, []);

  return { triggerSync };
}
