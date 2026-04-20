"use client";

import { useState, useCallback, useEffect } from "react";
import type { Book } from "@/hooks/useBookshelf";
import { fetchWithTimeoutAndRetry } from "@/lib/syncFetch";
import { gzipSupported, gzipUtf8String } from "@/lib/syncCompression";

/** 超过此大小的 JSON 上传改用 gzip，减轻手机上行压力 */
const SYNC_JSON_GZIP_MIN_BYTES = 2048;

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

function syncNetworkErrorMessage(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError") {
    return "同步超时（数据较大或网络较慢），请稍后重试或更换网络";
  }
  return err instanceof Error ? err.message : "同步失败";
}

async function fetchSyncPost(url: string, payload: unknown): Promise<Response> {
  const json = JSON.stringify(payload);
  if (gzipSupported() && json.length >= SYNC_JSON_GZIP_MIN_BYTES) {
    const buf = await gzipUtf8String(json);
    return fetchWithTimeoutAndRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
      },
      body: buf,
    });
  }
  return fetchWithTimeoutAndRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json,
  });
}

export interface SyncData {
  vocabulary: Record<string, unknown>;
  bookProgress: Record<string, unknown>;
  books?: Book[];
}

/** 服务端 push / pull 返回的整条同步负载（合并后） */
export type SyncPayloadFromServer = SyncData & {
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
      const res = await fetchSyncPost("/api/sync/create", { data });
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
      const msg = syncNetworkErrorMessage(err) || '创建同步失败';
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
      const res = await fetchWithTimeoutAndRetry('/api/sync/pull', {
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
      const msg = syncNetworkErrorMessage(err) || '绑定失败';
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
      const res = await fetchSyncPost("/api/sync/push", { syncCode, data });
      if (!res.ok) {
        const p = await readErrJson(res);
        throw new Error(apiFailMessage('推送失败', res, p));
      }
      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return true;
    } catch (err) {
      const msg = syncNetworkErrorMessage(err) || '推送失败';
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
      const res = await fetchWithTimeoutAndRetry('/api/sync/pull', {
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
      const msg = syncNetworkErrorMessage(err) || '拉取失败';
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
  }): Promise<SyncPayloadFromServer | null> => {
    if (!syncCode) return null;
    setSyncing(true);
    setSyncError(null);
    try {
      const pushRes = await fetchSyncPost("/api/sync/push", {
        syncCode,
        data: localData,
      });
      if (!pushRes.ok) {
        const p = await readErrJson(pushRes);
        throw new Error(apiFailMessage('同步上传失败', pushRes, p));
      }

      const result = (await pushRes.json()) as {
        success?: boolean;
        data?: SyncPayloadFromServer;
      };
      let payload: SyncPayloadFromServer | undefined = result.data;

      // 兼容旧服务端（仅返回 success）；仍补一次 pull
      if (!payload && syncCode) {
        const pullRes = await fetchWithTimeoutAndRetry('/api/sync/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syncCode }),
        });
        if (!pullRes.ok) {
          const p = await readErrJson(pullRes);
          throw new Error(apiFailMessage('同步下载失败', pullRes, p));
        }
        const pullJson = (await pullRes.json()) as { data?: SyncPayloadFromServer };
        payload = pullJson.data;
      }

      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return payload ?? null;
    } catch (err) {
      const msg = syncNetworkErrorMessage(err) || '同步失败';
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