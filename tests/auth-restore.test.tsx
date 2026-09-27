import { StrictMode } from "react";
import { render, screen, cleanup, act } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
vi.mock("../src/shared/config/backend", () => ({ apiBaseUrl: "" }));
import { AuthProvider, useAuth } from "../src/shared/auth/auth-context";
function Status() { return <div>{useAuth().status}</div>; }
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("restores after a temporary profile failure without rotating refresh twice", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response('csrf'))
    .mockResolvedValueOnce(new Response('{"accessToken":"restored"}'))
    .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    .mockResolvedValueOnce(new Response('{"id":"1","role":"ADMIN"}'));
  vi.stubGlobal("fetch", fetchMock);
  render(<StrictMode><AuthProvider><Status /></AuthProvider></StrictMode>);
  await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
  expect(screen.getByText("authenticated")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe("Bearer restored");
  expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
});

it("keeps a connection error separate from an expired session", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  render(<AuthProvider><Status /></AuthProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  expect(screen.queryByText("anonymous")).toBeNull();
});
