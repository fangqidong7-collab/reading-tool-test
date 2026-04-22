import { NextResponse } from "next/server";

/**
 * 解析 POST JSON 请求体。
 * 不做手动 gzip 解压——Vercel 平台不支持客户端 Content-Encoding: gzip 请求体。
 */
export async function parseJsonRequestBody(request: Request): Promise<unknown> {
  return request.json();
}

/**
 * 返回 JSON 响应。
 * Vercel 自动按 Accept-Encoding 压缩响应，无需手动 gzip。
 */
export function jsonResponseMaybeGzip(payload: unknown): NextResponse {
  return NextResponse.json(payload);
}
