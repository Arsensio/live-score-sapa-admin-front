import { afterEach, expect, it, vi } from "vitest";
vi.mock("../src/shared/config/backend", () => ({ apiBaseUrl: "https://backend.example.test" }));
import { matchApi } from "../src/entities/match/api";
import { matchEventApi } from "../src/entities/match/events-api";
afterEach(() => vi.unstubAllGlobals());

it.each(["startShootout", "finish"] as const)("%s отправляет PATCH без тела и принимает 204", async (action) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(matchApi[action]("match-1")).resolves.toBeUndefined();
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.pathname).toBe("/api/matches/match-1/action");
  expect(url.searchParams.get("action")).toBe(action === "finish" ? "FINISH" : "START_PENALTY_SHOOTOUT");
  expect(options.method).toBe("PATCH");
  expect(options.body).toBeUndefined();
});

it("сохраняет явные null в запросе добавления удара", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"kick"}', { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  const body = { matchId: "match-1", teamId: "team-1", playerId: null, type: "SHOOTOUT_GOAL" as const, minute: null, assistPlayerId: null };
  await matchEventApi.create(body);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.pathname).toBe("/api/events");
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toEqual(body);
});
