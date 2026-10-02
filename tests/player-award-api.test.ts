import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/shared/config/backend", () => ({ apiBaseUrl: "https://gateway.example.test" }));
vi.mock("../src/shared/auth/session", () => ({ refreshAccessToken: vi.fn() }));
import { playerAwardApi } from "../src/entities/player-award/api";
import { setAccessToken } from "../src/shared/auth/access-token";
import { refreshAccessToken } from "../src/shared/auth/session";

beforeEach(() => { vi.resetAllMocks(); setAccessToken("admin-token"); });
afterEach(() => { vi.unstubAllGlobals(); setAccessToken(null); });

it("загружает страницу голосований с фильтром турнира", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"content":[],"totalPages":0}'));
  vi.stubGlobal("fetch", fetchMock);
  await playerAwardApi.list("cup", 2);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.pathname).toBe("/api/player-award-polls");
  expect(Object.fromEntries(url.searchParams)).toEqual({ tournamentId: "cup", page: "2", size: "20", sort: "id,asc" });
  expect(options.headers.Authorization).toBe("Bearer admin-token");
});

it("запрашивает футболистов через gateway с поиском, пагинацией, сортировкой и токеном", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"content":[]}'));
  vi.stubGlobal("fetch", fetchMock);
  await playerAwardApi.players("cup", "Арсен", 2);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.origin).toBe("https://gateway.example.test");
  expect(url.pathname).toBe("/api/players");
  expect(Object.fromEntries(url.searchParams)).toEqual({ tournamentId: "cup", name: "Арсен", page: "2", size: "20", sort: "lastName,asc" });
  expect(options.headers.Authorization).toBe("Bearer admin-token");
});

it.each(["OPEN", "CLOSE"] as const)("%s отправляет PATCH без тела и принимает 204", async (action) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(playerAwardApi.action("poll", action)).resolves.toBeUndefined();
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.pathname).toBe("/api/player-award-polls/poll/action");
  expect(url.searchParams.get("action")).toBe(action);
  expect(options.method).toBe("PATCH");
  expect(options.body).toBeUndefined();
});

it("создаёт голосование с ID в порядке выбора", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"poll"}', { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  const input = { tournamentId: "cup", title: "Лучший", candidateCount: 2, playerIds: ["second", "first"] };
  await playerAwardApi.create(input);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.pathname).toBe("/api/player-award-polls");
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toEqual(input);
});

it("при 401 обновляет токен существующим сценарием и повторяет запрос", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response('{"id":"poll"}'));
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(refreshAccessToken).mockResolvedValue("new-admin-token");
  await expect(playerAwardApi.get("poll")).resolves.toEqual({ id: "poll" });
  expect(refreshAccessToken).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer new-admin-token");
});
