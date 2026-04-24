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

export interface BookManifestEntry {
  id: string;
  title: string;
  contentHash: string;
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
    console.log('[SYNC] createSync — start');
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
      console.log('[SYNC] createSync — success, code:', code);
      setSyncCode(code);
      localStorage.setItem(SYNC_CODE_KEY, code);
      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return code;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '创建同步失败';
      console.error('[SYNC] createSync — error:', msg);
      setSyncError(msg);
      return null;
    } finally {
      setSyncing(false);
    }
  }, []);

  const bindSyncCode = useCallback(async (code: string) => {
    console.log('[SYNC] bindSyncCode — start, code:', code.toUpperCase());
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
      console.log('[SYNC] bindSyncCode — success, books:', result.data?.books?.length ?? 0);
      const upperCode = code.toUpperCase();
      setSyncCode(upperCode);
      localStorage.setItem(SYNC_CODE_KEY, upperCode);
      const now = Date.now();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      return result.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '绑定失败';
      console.error('[SYNC] bindSyncCode — error:', msg);
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

  /**
   * 两阶段轻量同步：
   * 1. POST /api/sync/push — 只传 vocab + progress + bookManifest（极小）
   *    - action:"push"  → 本地数据已写入云端，返回 null
   *    - action:"needBooks" → 需要补传缺失书籍，进入阶段 2
   *    - action:"pull" → 云端更新，返回轻量数据，按需拉取书籍
   * 2. POST /api/sync/push-books — 只传缺失书籍正文
   */
  const syncBoth = useCallback(async (options: {
    data: { vocabulary: Record<string, unknown>; bookProgress: Record<string, unknown> };
    bookManifest: BookManifestEntry[];
    getBooksForIds: (ids: string[]) => Book[];
    onConfirmOverwrite?: (info: { localCount: number; cloudCount: number }) => Promise<boolean>;
  }): Promise<SyncMergedPayload | null> => {
    if (!syncCode) return null;
    console.log('[SYNC] syncBoth — start, lastSyncAt:', lastSyncAt, 'books:', options.bookManifest.length);
    setSyncing(true);
    setSyncError(null);

    const SYNC_MS = 180000;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), SYNC_MS);
    const t0 = performance.now();

    try {
      // Phase 1: lightweight push
      console.log('[SYNC] syncBoth — Phase1: push (vocab + progress + manifest)');
      const pushRes = await postSyncJson(
        "/api/sync/push",
        { syncCode, data: options.data, lastSyncAt, bookManifest: options.bookManifest },
        { signal: controller.signal }
      );
      if (!pushRes.ok) {
        const p = await readErrJson(pushRes);
        throw new Error(apiFailMessage('同步失败', pushRes, p));
      }

      const json = (await parseSyncJsonResponse(pushRes)) as {
        action: 'pull' | 'push' | 'needBooks';
        data?: SyncMergedPayload;
        cloudBookManifest?: Array<{ id: string; title: string }>;
        missingBookIds?: string[];
        updatedAt?: number;
        cloudBookCount?: number;
      };

      console.log('[SYNC] syncBoth — Phase1 response: action=', json.action, 'missingBookIds=', json.missingBookIds?.length ?? 0);

      const saveSyncTime = (ts: number) => {
        setLastSyncAt(ts);
        localStorage.setItem(LAST_SYNC_KEY, String(ts));
      };

      if (json.action === 'needBooks' && json.missingBookIds) {
        console.log('[SYNC] syncBoth — Phase2: push-books, ids:', json.missingBookIds);
        const missingBooks = options.getBooksForIds(json.missingBookIds);
        const booksRes = await postSyncJson(
          "/api/sync/push-books",
          { syncCode, books: missingBooks },
          { signal: controller.signal }
        );
        if (!booksRes.ok) {
          const p = await readErrJson(booksRes);
          throw new Error(apiFailMessage('书籍推送失败', booksRes, p));
        }
        const booksJson = (await parseSyncJsonResponse(booksRes)) as { updatedAt?: number };
        saveSyncTime(booksJson.updatedAt ?? Date.now());
        console.log('[SYNC] syncBoth — done (push-books), total:', ((performance.now() - t0) / 1000).toFixed(1), 's');
        return null;
      }

      if (json.action === 'pull') {
        const cloudManifest = json.cloudBookManifest ?? [];
        const localManifest = options.bookManifest;
        const booksMatch = checkBooksMatch(localManifest, cloudManifest);
        console.log('[SYNC] syncBoth — pull: booksMatch=', booksMatch, 'cloud:', cloudManifest.length, 'local:', localManifest.length);

        if (booksMatch) {
          const cloudTs = json.data?.updatedAt ?? Date.now();
          saveSyncTime(cloudTs);
          console.log('[SYNC] syncBoth — done (pull, books match), total:', ((performance.now() - t0) / 1000).toFixed(1), 's');
          return json.data ?? null;
        }

        try {
          console.log('[SYNC] syncBoth — full pull (books differ)');
          const pullRes = await postSyncJson(
            "/api/sync/pull",
            { syncCode },
            { signal: controller.signal }
          );
          if (!pullRes.ok) {
            throw new Error('full pull failed');
          }
          const pullJson = (await parseSyncJsonResponse(pullRes)) as { data: SyncMergedPayload };
          const cloudTs = pullJson.data?.updatedAt ?? Date.now();
          saveSyncTime(cloudTs);
          console.log('[SYNC] syncBoth — done (full pull), books:', pullJson.data?.books?.length ?? 0, 'total:', ((performance.now() - t0) / 1000).toFixed(1), 's');
          return pullJson.data;
        } catch (pullErr) {
          console.warn('[SYNC] syncBoth — full pull failed, fallback to lightweight data:', pullErr);
          const cloudTs = json.data?.updatedAt ?? Date.now();
          saveSyncTime(cloudTs);
          return json.data ?? null;
        }
      }

      // action === 'push' — check if cloud has more books than local
      const cloudCount = json.cloudBookCount ?? 0;
      const localCount = options.bookManifest.length;
      if (cloudCount > localCount && options.onConfirmOverwrite) {
        console.log('[SYNC] syncBoth — cloud has more books:', cloudCount, 'vs local:', localCount, '— asking user');
        const confirmed = await options.onConfirmOverwrite({ localCount, cloudCount });
        if (!confirmed) {
          console.log('[SYNC] syncBoth — user cancelled overwrite');
          setSyncError(null);
          return null;
        }
      }
      saveSyncTime(json.updatedAt ?? Date.now());
      console.log('[SYNC] syncBoth — done (push), total:', ((performance.now() - t0) / 1000).toFixed(1), 's');
      return null;
    } catch (err) {
      const ms = ((performance.now() - t0) / 1000).toFixed(1);
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? `同步超时（超过 ${SYNC_MS / 1000} 秒），请检查网络或减少书籍体积后重试`
          : err instanceof Error
            ? err.message
            : '同步失败';
      console.error('[SYNC] syncBoth — error after', ms, 's:', msg);
      setSyncError(msg);
      return null;
    } finally {
      window.clearTimeout(timeoutId);
      setSyncing(false);
    }
  }, [syncCode, lastSyncAt]);

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
    setSyncError,
    createSync,
    bindSyncCode,
    pushData,
    pullData,
    syncBoth,
    unbind,
  };
}

/**
 * 比较本地 bookManifest 与云端 bookManifest。
 * 云端的每本书在本地都能找到（按 ID 或 title）→ booksMatch。
 */
function checkBooksMatch(
  localManifest: BookManifestEntry[],
  cloudManifest: Array<{ id: string; title: string }>,
): boolean {
  const localIdSet = new Set(localManifest.map(e => e.id));
  const localTitleSet = new Set(localManifest.map(e => e.title));

  for (const cloud of cloudManifest) {
    if (localIdSet.has(cloud.id)) continue;
    if (localTitleSet.has(cloud.title)) continue;
    return false;
  }

  if (cloudManifest.length !== localManifest.length) return false;

  return true;
}
