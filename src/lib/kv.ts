// 轻量 KV 存储 — 开发用文件方案，生产可替换为 Redis/Upstash

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.sync-data');

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface KVEntry {
  value: string;
  expiresAt?: number;
}

export const kv = {
  async get(key: string): Promise<string | null> {
    const filePath = path.join(DATA_DIR, encodeURIComponent(key) + '.json');
    try {
      if (!fs.existsSync(filePath)) return null;
      const entry: KVEntry = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      // 检查是否过期
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        fs.unlinkSync(filePath);
        return null;
      }
      return entry.value;
    } catch {
      return null;
    }
  },

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    const filePath = path.join(DATA_DIR, encodeURIComponent(key) + '.json');
    const entry: KVEntry = {
      value,
      expiresAt: options?.ex ? Date.now() + options.ex * 1000 : undefined,
    };
    fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
  },

  async del(key: string): Promise<void> {
    const filePath = path.join(DATA_DIR, encodeURIComponent(key) + '.json');
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  },
};
