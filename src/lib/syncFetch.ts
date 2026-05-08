"use client";

export async function postSyncJson(
  url: string,
  body: unknown,
  init?: RequestInit
): Promise<Response> {
  const jsonBody = JSON.stringify(body);

  const res = await fetch(url, {
    ...init,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
    body: jsonBody,
  });
  return res;
}

export async function parseSyncJsonResponse(res: Response): Promise<unknown> {
  return res.json();
}
