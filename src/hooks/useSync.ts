"use client";

import { useState, useCallback, useEffect } from "react";
import type { Book } from "@/hooks/useBookshelf";

const SYNC_CODE_KEY = "english-reader-sync-code";
const LAST_SYNC_KEY = "english-reader-last-sync";

async function readErrJson(res: Response): Promise<{ error?: string; code?: string }> {
  try {
    const j: unknown = await res.json();
    if (typeof j !== 'object' || j === null) return {};
    const rec = j as Record<string, unknown>;
    const error = typeof rec.error === 'string' ? rec.error : undefined;
    const code = typeof rec.code === 'string' ? rec.code : undefined;
    return { error, code };
  } catch {
    return {};
  }
}

function apiFailMessage(kind: string, res: Response, parsed: { error?: string; code?: string }) {
  const tail = parsed.code ? ` (${parsed.code})` : ` [${res.status}]`;
  return `${parsed.error || kind}${tail}`;
}

export interface SyncData {
  vocabulary: Record<string, unknown>;
  bookProgress: Record<string, unknown>;
  books?: Book[];
}

export function useSync() {
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem(SYNC_CODE_KEY);
    if (saved) setSyncCode(saved);
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    if (lastSync) setLastSyncAt(parseInt(lastSync, 10));
  }, []);

  const createSync = useCallback(async (data: SyncData) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/sync/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const p = await readErrJson(res);
        throw new Error(apiFailMessage('创建同步失败', res, p));
      }
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
        const p = await readErrJson(res);
        throw new Error(apiFailMessage('拉取数据失败', res, p));
      }
      const result = await res.json();
      const upperCode = code.toUpperCase();
      setSyncCode(upperCode);
      localStorage.setItem(SYNC_CODE_KEY, upperCode);
      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return result.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '绑定失败';
      setSyncError(msg);
      return null;
    } finally {
      setSyncing(false);
    }
  }, []);

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
      if (!res.ok) {
        const p = await readErrJson(res);
        throw new Error(apiFailMessage('推送失败', res, p));
      }
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
      if (!res.ok) {
        const p = await readErrJson(res);
        throw new Error(apiFailMessage('拉取失败', res, p));
      }
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

  const syncBoth = useCallback(async (localData: {
    vocabulary: Record<string, unknown>;
    bookProgress: Record<string, unknown>;
    books?: Book[];
  }) => {
    if (!syncCode) return null;
    setSyncing(true);
    setSyncError(null);
    try {
      const pushRes = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode, data: localData }),
      });
      if (!pushRes.ok) {
        const p = await readErrJson(pushRes);
        throw new Error(apiFailMessage('同步上传失败', pushRes, p));
      }

      const pullRes = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode }),
      });
      if (!pullRes.ok) {
        const p = await readErrJson(pullRes);
        throw new Error(apiFailMessage('同步下载失败', pullRes, p));
      }

      const result = await pullRes.json();
      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return result.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '同步失败';
      setSyncError(msg);
      return null;
    } finally {
      setSyncing(false);
    }
  }, [syncCode]);

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