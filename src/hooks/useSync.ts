"use client";

import { useState, useCallback, useEffect } from "react";

const SYNC_CODE_KEY = "english-reader-sync-code";
const LAST_SYNC_KEY = "english-reader-last-sync";

export interface SyncData {
  vocabulary: Record<string, unknown>;
  bookProgress: Record<string, unknown>;
}

export function useSync() {
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 启动时读取本地保存的同步码
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem(SYNC_CODE_KEY);
    if (saved) setSyncCode(saved);
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    if (lastSync) setLastSyncAt(parseInt(lastSync, 10));
  }, []);

  // 首次生成同步码（把当前数据上传）
  const createSync = useCallback(async (data: SyncData) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/sync/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) throw new Error('创建同步失败');
      const result = await res.json();
      const code = result.syncCode;
      setSyncCode(code);
      localStorage.setItem(SYNC_CODE_KEY, code);
      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return code;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '创建同步失败';
      setSyncError(msg);
      return null;
    } finally {
      setSyncing(false);
    }
  }, []);

  // 绑定已有同步码（从另一台设备输入）
  const bindSyncCode = useCallback(async (code: string) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode: code.toUpperCase() }),
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error('同步码无效或已过期');
        throw new Error('拉取数据失败');
      }
      const result = await res.json();
      const upperCode = code.toUpperCase();
      setSyncCode(upperCode);
      localStorage.setItem(SYNC_CODE_KEY, upperCode);
      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return result.data; // 返回远端数据，由调用方合并到本地
    } catch (err) {
      const msg = err instanceof Error ? err.message : '绑定失败';
      setSyncError(msg);
      return null;
    } finally {
      setSyncing(false);
    }
  }, []);

  // 推送本地数据到云端
  const pushData = useCallback(async (data: SyncData) => {
    if (!syncCode) return false;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode, data }),
      });
      if (!res.ok) throw new Error('推送失败');
      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '推送失败';
      setSyncError(msg);
      return false;
    } finally {
      setSyncing(false);
    }
  }, [syncCode]);

  // 从云端拉取数据
  const pullData = useCallback(async () => {
    if (!syncCode) return null;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode }),
      });
      if (!res.ok) throw new Error('拉取失败');
      const result = await res.json();
      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return result.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '拉取失败';
      setSyncError(msg);
      return null;
    } finally {
      setSyncing(false);
    }
  }, [syncCode]);

  // 双向同步：先推本地数据，再拉远端合并结果
  const syncBoth = useCallback(async (localData: {
    vocabulary: Record<string, unknown>;
    bookProgress: Record<string, unknown>;
  }) => {
    if (!syncCode) return null;
    setSyncing(true);
    setSyncError(null);
    try {
      // 第一步：推送本地数据（服务端会智能合并）
      const pushRes = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode, data: localData }),
      });
      if (!pushRes.ok) throw new Error('同步上传失败');

      // 第二步：拉取合并后的数据
      const pullRes = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode }),
      });
      if (!pullRes.ok) throw new Error('同步下载失败');

      const result = await pullRes.json();
      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return result.data; // 返回合并后的完整数据
    } catch (err) {
      const msg = err instanceof Error ? err.message : '同步失败';
      setSyncError(msg);
      return null;
    } finally {
      setSyncing(false);
    }
  }, [syncCode]);

  // 解绑同步码
  const unbind = useCallback(() => {
    setSyncCode(null);
    setLastSyncAt(null);
    setSyncError(null);
    localStorage.removeItem(SYNC_CODE_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
  }, []);

  return {
    syncCode,
    syncing,
    lastSyncAt,
    syncError,
    createSync,
    bindSyncCode,
    pushData,
    pullData,
    syncBoth,
    unbind,
  };
}
