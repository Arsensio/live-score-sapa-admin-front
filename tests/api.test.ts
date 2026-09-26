import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/shared/config/backend", () => ({
  backendUrl: "https://backend.example.test",
}));
import { api, ApiError } from "../src/shared/api/client";
import { allPages } from "../src/shared/api/pagination";
import { teamApi } from "../src/entities/team/api";
import { groupApi } from "../src/entities/group/api";
afterEach(() => vi.unstubAllGlobals());
describe("единый API-клиент", () => {
  it("завершает выбранную группу PATCH-запросом без тела", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('{"id":"group-1","status":"FINISHED","teams":[]}'),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(groupApi.finish("group-1")).resolves.toMatchObject({
      status: "FINISHED",
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.pathname).toBe("/api/groups/group-1/finish");
    expect(options.method).toBe("PATCH");
    expect(options.body).toBeUndefined();
  });
  it("запрашивает статистику групп по /api/groups с tournamentId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(groupApi.standings("cup")).resolves.toEqual([]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.pathname).toBe("/api/groups");
    expect(url.search).toBe("?tournamentId=cup");
    expect(options.method).toBe("GET");
  });
  it("обновляет команду одним PUT с полным players, включая пустой состав", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"id":"team-1"}'));
    vi.stubGlobal("fetch", fetchMock);
    const body = {
      tournamentId: "cup",
      name: "Team",
      shortName: null,
      logoUrl: null,
      players: [],
    };
    await teamApi.update("team-1", body);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.pathname).toBe("/api/teams/team-1");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("использует конфигурацию, кодирует query и отправляет JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"id":"1"}', { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      api("/api/tournaments", {
        method: "POST",
        query: { name: "Кубок & Лига", page: 0 },
        body: { name: "Кубок" },
      }),
    ).resolves.toEqual({ id: "1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.origin).toBe("https://backend.example.test");
    expect(url.searchParams.get("name")).toBe("Кубок & Лига");
    expect(url.searchParams.get("page")).toBe("0");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "Кубок" });
    expect(init.credentials).toBe("include");
  });
  it("обрабатывает пустой ответ удаления", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(
      api("/api/draw/groups/a/teams", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });
  it("сохраняет HTTP-статус конфликта и сообщение backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response('{"message":"Команда уже в группе"}', { status: 409 }),
        ),
    );
    await expect(api("/api/draw/teams")).rejects.toMatchObject({
      status: 409,
      message: "Команда уже в группе",
    });
  });
  it("показывает понятную сетевую ошибку", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(api("/api/tournaments")).rejects.toBeInstanceOf(ApiError);
  });
  it("не принимает HTML за API-ответ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>app</html>")),
    );
    await expect(api("/api/tournaments")).rejects.toThrow("VITE_BACKEND_URL");
  });
});
describe("пагинация всех команд", () => {
  it("загружает все страницы", async () => {
    const load = vi.fn(async (page: number) => ({
      content: [page],
      totalPages: 3,
    }));
    await expect(allPages(load)).resolves.toEqual([0, 1, 2]);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it("принимает обычный массив", async () => {
    await expect(allPages(async () => ["a", "b"])).resolves.toEqual(["a", "b"]);
  });
  it("поддерживает Spring PagedModel", async () => {
    await expect(
      allPages(async (page) => ({
        content: [page],
        page: { totalPages: 2, totalElements: 2, number: page },
      })),
    ).resolves.toEqual([0, 1]);
  });
});
