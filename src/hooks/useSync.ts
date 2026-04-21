"use client";

import { useState, useCallback, useEffect } from "react";
import type { Book } from "@/hooks/useBookshelf";
import { parseSyncJsonResponse, postSyncJson } from "@/lib/syncFetch";

const SYNC_CODE_KEY = "english-reader-sync-code";
const LAST_SYNC_KEY = "english-reader-last-sync";

async function readErrJson(res: Response): Promise<{ error?: string; code?: string }> {
  try {
    const j: unknown = await parseSyncJsonResponse(res);
    if (typeof j !== "object" || j === null) return {};
    const rec = j as Record<string, unknown>;
    const error = typeof rec.error === "string" ? rec.error : undefined;
    const code = typeof rec.code === "string" ? rec.code : undefined;
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

/** 服务端合并后的负载（push 返回或 pull 返回的 data） */
export type SyncMergedPayload = {
  vocabulary?: Record<
    string,
    { root: string; meaning: string; pos: string; correctCount?: number }
  >;
  bookProgress?: Record<string, unknown>;
  books?: Book[];
  updatedAt?: number;
  createdAt?: number;
};

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
      const res = await postSyncJson("/api/sync/create", { data });
      if (!res.ok) {
        const p = await readErrJson(res);
        throw new Error(apiFailMessage('创建同步失败', res, p));
      }
      const result = (await parseSyncJsonResponse(res)) as { syncCode?: string };
      const code = result.syncCode;
      if (typeof code !== "string" || code.length === 0) {
        throw new Error("创建同步失败：未返回同步码");
      }
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
      const res = await postSyncJson("/api/sync/pull", { syncCode: code.toUpperCase() });
      if (!res.ok) {
        if (res.status === 404) throw new Error('同步码无效或已过期');
        const p = await readErrJson(res);
        throw new Error(apiFailMessage('拉取数据失败', res, p));
      }
      const result = (await parseSyncJsonResponse(res)) as { data: SyncMergedPayload };
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
      const res = await postSyncJson("/api/sync/push", { syncCode, data });
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
      const res = await postSyncJson("/api/sync/pull", { syncCode });
      if (!res.ok) {
        const p = await readErrJson(res);
        throw new Error(apiFailMessage('拉取失败', res, p));
      }
      const result = (await parseSyncJsonResponse(res)) as { data: unknown };
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
  }): Promise<SyncMergedPayload | null> => {
    if (!syncCode) return null;
    setSyncing(true);
    setSyncError(null);

    const SYNC_MS = 180000;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), SYNC_MS);

    try {
      const pushRes = await postSyncJson(
        "/api/sync/push",
        { syncCode, data: localData },
        { signal: controller.signal }
      );
      if (!pushRes.ok) {
        const p = await readErrJson(pushRes);
        throw new Error(apiFailMessage('同步上传失败', pushRes, p));
      }

      const pushJson: unknown = await parseSyncJsonResponse(pushRes);
      let merged: unknown = null;
      if (typeof pushJson === 'object' && pushJson !== null && 'data' in pushJson) {
        merged = (pushJson as { data: unknown }).data;
      }

      // 兼容旧部署：push 未返回 data 时再 pull 一次（仍比失败好）
      if (merged === undefined || merged === null) {
        const pullRes = await postSyncJson(
          "/api/sync/pull",
          { syncCode },
          { signal: controller.signal }
        );
        if (!pullRes.ok) {
          const p = await readErrJson(pullRes);
          throw new Error(apiFailMessage('同步下载失败', pullRes, p));
        }
        const pullJson: unknown = await parseSyncJsonResponse(pullRes);
        if (typeof pullJson === 'object' && pullJson !== null && 'data' in pullJson) {
          merged = (pullJson as { data: unknown }).data;
        }
      }

      if (merged === undefined || merged === null) {
        setSyncError('同步完成但未收到合并数据');
        return null;
      }

      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return merged as SyncMergedPayload;
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? `同步超时（超过 ${SYNC_MS / 1000} 秒），请检查网络或减少书籍体积后重试`
          : err instanceof Error
            ? err.message
            : '同步失败';
      setSyncError(msg);
      return null;
    } finally {
      window.clearTimeout(timeoutId);
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