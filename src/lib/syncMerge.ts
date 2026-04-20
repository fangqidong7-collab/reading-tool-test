/** 同步时用书名（忽略大小写与多空格）识别「同一本书」 */
export function normalizeBookTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/** 两台设备同一本书不同 uuid 时，收敛为稳定 id，避免书架出现两本「同一本书」 */
export function canonicalBookId(idA: string, idB: string): string {
  return idA <= idB ? idA : idB;
}
