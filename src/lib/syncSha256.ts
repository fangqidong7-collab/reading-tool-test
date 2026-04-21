/**
 * SHA-256（UTF-8）十六进制字符串，用于同步正文去重与省略上传。
 */
export async function sha256Utf8(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(hashBuf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
