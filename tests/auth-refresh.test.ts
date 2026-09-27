import { afterEach, expect, it, vi } from "vitest";
vi.mock("../src/shared/config/backend", () => ({ apiBaseUrl: "https://api.example.test" }));
import { refreshAccessToken } from "../src/shared/auth/session";

afterEach(() => vi.unstubAllGlobals());

it.each([
  ["csrf-value", { accessToken: "new-token" }],
  [{ data: { xsrfToken: "csrf-value" } }, { data: { access_token: "new-token" } }],
  [{ csrfToken: "csrf-value" }, { token: "new-token" }],
])("restores a token without a user using CSRF and cookies", async (csrf, token) => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(typeof csrf === "string" ? csrf : JSON.stringify(csrf)))
    .mockResolvedValueOnce(new Response(JSON.stringify(token)));
  vi.stubGlobal("fetch", fetchMock);
  const first = refreshAccessToken();
  expect(refreshAccessToken()).toBe(first);
  await expect(first).resolves.toBe("new-token");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [url, init] = fetchMock.mock.calls[1];
  expect(url.pathname).toBe("/api/auth/refresh");
  expect(init.method).toBe("POST");
  expect(init.credentials).toBe("include");
  expect(init.headers["X-XSRF-TOKEN"]).toBe("csrf-value");
  expect(init.headers.Authorization).toBeUndefined();
});

it("does not refresh without CSRF and permits a later attempt after 401", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response("{}"))
    .mockResolvedValueOnce(new Response('{"token":"csrf"}'))
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response('{"token":"csrf"}'))
    .mockResolvedValueOnce(new Response('{"accessToken":"new-token"}'));
  vi.stubGlobal("fetch", fetchMock);
  await expect(refreshAccessToken()).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await expect(refreshAccessToken()).rejects.toMatchObject({ status: 401 });
  await expect(refreshAccessToken()).resolves.toBe("new-token");
});
