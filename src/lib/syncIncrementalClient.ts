import type { Book } from "@/hooks/useBookshelf";

const HASH_STORAGE_KEY = "english-reader-sync-book-hash:";

/** SHA-256 前 16 字节 hex，用作正文指纹（足够区分是否变更） */
export async function hashBookContent(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 16; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export async function hashBooksToMap(books: Pick<Book, "id" | "content">[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const b of books) {
    out[b.id] = await hashBookContent(b.content ?? "");
  }
  return out;
}

export function loadBookHashMap(syncCode: string | null): Record<string, string> | null {
  if (!syncCode || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HASH_STORAGE_KEY + syncCode.toUpperCase());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBookHashMap(syncCode: string, hashes: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HASH_STORAGE_KEY + syncCode.toUpperCase(), JSON.stringify(hashes));
  } catch {
    /* QuotaExceeded — 忽略 */
  }
}

/**
 * 与上次成功同步的正文指纹一致的书省略 content，减小上传；
 * 服务端用 KV 里已有正文合并。
 */
export async function buildIncrementalBookPayload(
  books: Book[],
  previousHashes: Record<string, string> | null
): Promise<{ booksOut: Book[]; contentHashes: Record<string, string> }> {
  const contentHashes: Record<string, string> = {};
  const booksOut: Book[] = [];

  for (const book of books) {
    const rawContent = book.content ?? "";
    const h = await hashBookContent(rawContent);
    contentHashes[book.id] = h;

    const canStrip =
      previousHashes !== null &&
      previousHashes[book.id] === h &&
      rawContent.length > 0;

    if (canStrip) {
      const { processedContent: _pc, content: _c, ...rest } = book;
      booksOut.push({
        ...rest,
        content: "",
      } as Book);
    } else {
      const { processedContent: _pc, ...rest } = book;
      booksOut.push(rest as Book);
    }
  }

  return { booksOut, contentHashes };
}
