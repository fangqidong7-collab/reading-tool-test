/**
 * Dual-driver KV store:
 *  - Upstash Redis (production): when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set
 *  - File KV (local dev): fallback when env vars are absent
 *
 * Interface matches the original:
 *   kv.get(key)  → Promise<string | null>
 *   kv.set(key, value: string, options?)  → Promise<void>   (options.ex = TTL in seconds)
 *   kv.del(key)  → Promise<void>
 */

import fs from 'fs';
import path from 'path';

// ─── Detect driver ───────────────────────────────────────────────────────────

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KV_DRIVER = process.env.KV_DRIVER;

const useUpstash =
  KV_DRIVER === 'upstash' ||
  (KV_DRIVER !== 'file' && !!UPSTASH_URL && !!UPSTASH_TOKEN);

// ─── Upstash driver ──────────────────────────────────────────────────────────

async function createUpstashDriver() {
  const { Redis } = await import('@upstash/redis');

  const redis = Redis.fromEnv();

  return {
    async get(key: string): Promise<string | null> {
      const v: unknown = await redis.get(key);
      if (v === null || v === undefined) return null;
      if (typeof v === 'string') return v;
      if (v instanceof Uint8Array) {
        return new TextDecoder('utf-8').decode(v);
      }
      if (typeof v === 'object') {
        try {
          return JSON.stringify(v);
        } catch {
          return null;
        }
      }
      return String(v);
    },

    async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
      await redis.set(key, value, options?.ex ? { ex: options.ex } : undefined);
    },

    async del(key: string): Promise<void> {
      await redis.del(key);
    },
  };
}

// ─── File driver (local dev only) ──────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), '.sync-data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // ignore
    }
  }
}

async function createFileDriver() {
  return {
    async get(key: string): Promise<string | null> {
      const filePath = path.join(DATA_DIR, encodeURIComponent(key) + '.json');
      try {
        if (!fs.existsSync(filePath)) return null;
        const raw = fs.readFileSync(filePath, 'utf-8');
        const entry: { value: string; expiresAt?: number } = JSON.parse(raw);
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          try { fs.unlinkSync(filePath); } catch { /* ignore */ }
          return null;
        }
        return entry.value;
      } catch {
        return null;
      }
    },

    async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
      ensureDataDir();
      const filePath = path.join(DATA_DIR, encodeURIComponent(key) + '.json');
      const entry = {
        value,
        expiresAt: options?.ex ? Date.now() + options.ex * 1000 : undefined,
      };
      fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
    },

    async del(key: string): Promise<void> {
      try {
        const filePath = path.join(DATA_DIR, encodeURIComponent(key) + '.json');
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    },
  };
}

// ─── Exported kv singleton ───────────────────────────────────────────────────

type KVDriver = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
};

let _driver: KVDriver | null = null;

async function getDriver(): Promise<KVDriver> {
  if (_driver) return _driver;
  _driver = useUpstash ? await createUpstashDriver() : await createFileDriver();
  return _driver;
}

const _stub: KVDriver = {
  async get(key: string)    { return (await getDriver()).get(key); },
  async set(key: string, value: string, options?: { ex?: number }) { return (await getDriver()).set(key, value, options); },
  async del(key: string)    { return (await getDriver()).del(key); },
};

export const kv: KVDriver = _stub;