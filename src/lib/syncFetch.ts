"use client";

let _reqId = 0;

export async function postSyncJson(
  url: string,
  body: unknown,
  init?: RequestInit
): Promise<Response> {
  const id = ++_reqId;
  const jsonBody = JSON.stringify(body);
  const sizeKB = (jsonBody.length / 1024).toFixed(1);
  const t0 = performance.now();
  console.log(`[SYNC-REQ #${id}] POST ${url} — body ${sizeKB} KB`);

  try {
    const res = await fetch(url, {
      ...init,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string> | undefined),
      },
      body: jsonBody,
    });
    const ms = (performance.now() - t0).toFixed(0);
    console.log(`[SYNC-RES #${id}] ${res.status} — ${ms}ms`);
    return res;
  } catch (err) {
    const ms = (performance.now() - t0).toFixed(0);
    console.error(`[SYNC-ERR #${id}] ${ms}ms —`, err);
    throw err;
  }
}

export async function parseSyncJsonResponse(res: Response): Promise<unknown> {
  return res.json();
}
