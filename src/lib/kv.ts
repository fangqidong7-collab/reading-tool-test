/**
 * Triple-driver KV store:
 *  - Coze Object Storage (production default): when COZE_BUCKET_* env vars are set
 *  - Upstash Redis (legacy): when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set
 *  - File KV (local dev fallback): when neither above is configured
 *
 * Interface matches the original:
 *   kv.get(key)  → Promise<string | null>
 *   kv.set(key, value: string, options?)  → Promise<void>   (options.ex = TTL in seconds, advisory only for S3 driver)
 *   kv.del(key)  → Promise<void>
 */

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { S3Storage } from 'coze-coding-dev-sdk';

// ─── Detect driver ───────────────────────────────────────────────────────────

const COZE_BUCKET_ENDPOINT = process.env.COZE_BUCKET_ENDPOINT_URL;
const COZE_BUCKET_NAME = process.env.COZE_BUCKET_NAME;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KV_DRIVER = process.env.KV_DRIVER;

const useCozeStorage =
  KV_DRIVER !== 'file' &&
  KV_DRIVER !== 'upstash' &&
  !!COZE_BUCKET_ENDPOINT &&
  !!COZE_BUCKET_NAME;

const useUpstash =
  KV_DRIVER === 'upstash' ||
  (KV_DRIVER !== 'file' && !useCozeStorage && !!UPSTASH_URL && !!UPSTASH_TOKEN);

// ─── S3 (Coze Object Storage) driver ───────────────────────────────────────

async function createCozeDriver() {
  const storage = new S3Storage({
    endpointUrl: COZE_BUCKET_ENDPOINT,
    accessKey: '',
    secretKey: '',
    bucketName: COZE_BUCKET_NAME,
    region: 'cn-beijing',
  });

  return {
    async get(key: string): Promise<string | null> {
      try {
        const buf = await storage.readFile({ fileKey: key });
        const json: { value: string; expiresAt?: number } = JSON.parse(
          buf.toString('utf-8'),
        );
        if (json.expiresAt && Date.now() > json.expiresAt) {
          await storage.deleteFile({ fileKey: key });
          return null;
        }
        return json.value ?? null;
      } catch (e: unknown) {
        // S3 throws a structured error when key not found
        const err = e as { name?: string };
        if (err?.name === 'NoSuchKey' || err?.name === '404') return null;
        return null;
      }
    },

    async set(
      key: string,
      value: string,
      options?: { ex?: number },
    ): Promise<void> {
      const entry = {
        value,
        expiresAt: options?.ex ? Date.now() + options.ex * 1000 : undefined,
      };
      const buf = Buffer.from(JSON.stringify(entry), 'utf-8');
      const stream = Readable.from(buf);
      await storage.streamUploadFile({
        stream,
        fileName: key,
        contentType: 'application/json',
      });
    },

    async del(key: string): Promise<void> {
      try {
        await storage.deleteFile({ fileKey: key });
      } catch {
        // ignore
      }
    },
  };
}

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

    async set(
      key: string,
      value: string,
      options?: { ex?: number },
    ): Promise<void> {
      await redis.set(
        key,
        value,
        options?.ex ? { ex: options.ex } : undefined,
      );
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
      const filePath = path.join(
        DATA_DIR,
        encodeURIComponent(key) + '.json',
      );
      try {
        if (!fs.existsSync(filePath)) return null;
        const raw = fs.readFileSync(filePath, 'utf-8');
        const entry: { value: string; expiresAt?: number } =
          JSON.parse(raw);
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          try {
            fs.unlinkSync(filePath);
          } catch {
            /* ignore */
          }
          return null;
        }
        return entry.value;
      } catch {
        return null;
      }
    },

    async set(
      key: string,
      value: string,
      options?: { ex?: number },
    ): Promise<void> {
      ensureDataDir();
      const filePath = path.join(
        DATA_DIR,
        encodeURIComponent(key) + '.json',
      );
      const entry = {
        value,
        expiresAt: options?.ex ? Date.now() + options.ex * 1000 : undefined,
      };
      fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
    },

    async del(key: string): Promise<void> {
      try {
        const filePath = path.join(
          DATA_DIR,
          encodeURIComponent(key) + '.json',
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    },
  };
}

// ─── Exported kv singleton ──────────────────────────────────────────────────

type KVDriver = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
};

let _driver: KVDriver | null = null;

async function getDriver(): Promise<KVDriver> {
  if (_driver) return _driver;

  if (useCozeStorage) {
    console.info('[kv] Using Coze Object Storage driver');
    _driver = await createCozeDriver();
  } else if (useUpstash) {
    console.info('[kv] Using Upstash Redis driver');
    _driver = await createUpstashDriver();
  } else {
    console.info('[kv] Using file driver (local dev)');
    _driver = await createFileDriver();
  }

  return _driver;
}

// Proxy that lazilyinitialises the correct driver
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const kv: KVDriver = new Proxy({} as KVDriver, {
  get(_target, prop) {
    return async (...args: unknown[]) => {
      const driver = await getDriver();
      const fn = driver[prop as keyof KVDriver];
      if (typeof fn !== 'function') return undefined;
      return (fn as (...a: unknown[]) => unknown).call(driver, ...args);
    };
  },
});
