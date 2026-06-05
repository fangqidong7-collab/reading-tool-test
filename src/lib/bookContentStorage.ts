import type { Book } from '@/hooks/useBookshelf';
import { idbGet, idbSet, idbRemove } from '@/lib/storage';

export const BOOKS_MANIFEST_KEY = 'english-reader-books';
const BOOK_CONTENT_PREFIX = 'english-reader-book-content:';

export function bookContentKey(bookId: string): string {
  return `${BOOK_CONTENT_PREFIX}${bookId}`;
}

export async function saveBookContent(bookId: string, content: string): Promise<void> {
  await idbSet(bookContentKey(bookId), content);
}

export async function loadBookContent(bookId: string): Promise<string | null> {
  return idbGet(bookContentKey(bookId));
}

export async function deleteBookContent(bookId: string): Promise<void> {
  await idbRemove(bookContentKey(bookId));
}

/** 将书籍转为仅含元数据的清单项（正文存独立 IDB key） */
export function toManifestBook(book: Book): Book {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { processedContent, content, ...meta } = book;
  const charLen = content?.length ?? book.contentCharLength ?? 0;
  return {
    ...meta,
    content: '',
    contentCharLength: charLen,
  };
}

/**
 * 若清单内仍内联正文（旧格式），拆分到按书 IDB 并写回纯清单。
 */
export async function migrateInlineContentToPerBook(books: Book[]): Promise<Book[]> {
  const needsSplit = books.some((b) => !b.isSample && (b.content?.length ?? 0) > 0);
  if (!needsSplit) {
    return books.map((b) => ({
      ...b,
      contentCharLength: b.contentCharLength ?? b.content?.length ?? 0,
    }));
  }

  await Promise.all(
    books.map(async (b) => {
      if (b.content && b.content.length > 0) {
        await saveBookContent(b.id, b.content);
      }
    }),
  );

  const manifest = books.map((b) => toManifestBook(b));
  await idbSet(BOOKS_MANIFEST_KEY, JSON.stringify(manifest));
  return manifest;
}

/** 导出备份：清单 + 按书正文合并为完整 Book[] */
export async function exportBooksWithContent(manifest: Book[]): Promise<Book[]> {
  return Promise.all(
    manifest.map(async (meta) => {
      if (meta.isSample) {
        return { ...meta, content: meta.content || '' };
      }
      const stored = await loadBookContent(meta.id);
      return {
        ...meta,
        content: stored ?? meta.content ?? '',
        contentCharLength: stored?.length ?? meta.contentCharLength ?? 0,
      };
    }),
  );
}

/** 导入备份：写入按书正文 + 纯清单 */
export async function importBooksWithContent(books: Book[]): Promise<void> {
  await Promise.all(
    books.map(async (b) => {
      const content = b.content ?? '';
      if (content.length > 0) {
        await saveBookContent(b.id, content);
      }
    }),
  );
  const manifest = books.map((b) => toManifestBook({ ...b, content: b.content ?? '' }));
  await idbSet(BOOKS_MANIFEST_KEY, JSON.stringify(manifest));
}
