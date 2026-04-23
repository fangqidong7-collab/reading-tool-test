/**
 * SHA-256（UTF-8）十六进制字符串，用于同步正文去重与省略上传。
 * 如果 crypto.subtle 不可用（非安全上下文），回退到简单 djb2 哈希。
 * 回退哈希不保证密码学安全，但足以做内容变更检测。
 */
export async function sha256Utf8(text: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    const bytes = new Uint8Array(hashBuf);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, "0");
    }
    return hex;
  }

  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return "djb2_" + h.toString(16).padStart(8, "0") + "_" + text.length.toString(16);
}
