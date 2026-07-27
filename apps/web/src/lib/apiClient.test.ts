/** Unit tests for the typed API client (envelope parsing, 401 refresh flow). */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiRequestError, tokenStore } from "./apiClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiClient", () => {
  beforeEach(() => {
    tokenStore.set(null);
    vi.restoreAllMocks();
  });

  it("returns data from the success envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: { status: "ok" }, message: "Success" })),
    );
    const data = await api<{ status: string }>("/health", { auth: false });
    expect(data.status).toBe("ok");
  });

  it("throws ApiRequestError with code/message from the error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(404, { error: { code: "STUDENT_NOT_FOUND", message: "Student not found" } }),
      ),
    );
    await expect(api("/x", { auth: false })).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 404,
      code: "STUDENT_NOT_FOUND",
      message: "Student not found",
    });
  });

  it("attaches the Bearer token when present", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: {}, message: "Success" }));
    vi.stubGlobal("fetch", fetchMock);
    tokenStore.set("test-token");

    await api("/auth/me");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });

  it("on 401: refreshes once, retries with the new token", async () => {
    const fetchMock = vi
      .fn()
      // 1) original request -> 401
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "expired" } }))
      // 2) refresh call -> new token
      .mockResolvedValueOnce(jsonResponse(200, { data: { access_token: "new-token" }, message: "Success" }))
      // 3) retried request -> 200
      .mockResolvedValueOnce(jsonResponse(200, { data: { ok: true }, message: "Success" }));
    vi.stubGlobal("fetch", fetchMock);
    tokenStore.set("old-token");

    const data = await api<{ ok: boolean }>("/protected");
    expect(data.ok).toBe(true);
    expect(tokenStore.get()).toBe("new-token");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("on 401 with failed refresh: clears token and rethrows", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "expired" } }))
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "INVALID_REFRESH_TOKEN", message: "no" } }));
    vi.stubGlobal("fetch", fetchMock);
    tokenStore.set("old-token");

    await expect(api("/protected")).rejects.toBeInstanceOf(ApiRequestError);
    expect(tokenStore.get()).toBeNull();
  });
});