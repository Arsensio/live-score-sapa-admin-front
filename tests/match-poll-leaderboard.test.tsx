import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MatchPollLeaderboardPage } from "../src/pages/match-poll-leaderboard/ui";

vi.mock("../src/shared/config/backend", () => ({ apiBaseUrl: "https://gateway.example.test" }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function renderPage() {
  render(<MemoryRouter initialEntries={["/tournaments/cup/match-poll-leaderboard"]}><Routes>
    <Route path="/tournaments/:tournamentId/match-poll-leaderboard" element={<MatchPollLeaderboardPage />} />
  </Routes></MemoryRouter>);
}

it("показывает рейтинг турнира и запрашивает общий рейтинг без фильтра", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify([{ userId: "user-1", guessedCount: 8 }, { userId: "user-2", guessedCount: 5 }])))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1", name: "Arsen Test", firstName: "Arsen", lastName: "Test", email: "user@example.com" })))
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(new Response("[]"));
  vi.stubGlobal("fetch", fetchMock);
  renderPage();
  await screen.findByRole("table", { name: "Рейтинг прогнозов" });
  await screen.findByText("Arsen Test");
  expect(screen.getByText("user@example.com")).toBeTruthy();
  await screen.findByText("Пользователь не найден");
  expect(screen.queryByText("user-1")).toBeNull();
  expect(fetchMock.mock.calls[1][0].pathname).toBe("/api/users/userInfo/user-1");
  expect(fetchMock.mock.calls[1][1].headers["X-API-Key"]).toBeUndefined();
  expect(screen.getByText("8")).toBeTruthy();
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.origin).toBe("https://gateway.example.test");
  expect(url.pathname).toBe("/api/match-polls/leaderboard");
  expect(url.searchParams.get("tournamentId")).toBe("cup");
  expect(options.method).toBe("GET");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Рейтинг" }), "all");
  await screen.findByText("Пока никто не угадал результаты матчей.");
  expect(fetchMock.mock.calls[3][0].search).toBe("");
  expect(screen.queryByRole("table")).toBeNull();
});

it("показывает ошибку и повторяет загрузку", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response("{}", { status: 500 }))
    .mockResolvedValueOnce(new Response("[]"));
  vi.stubGlobal("fetch", fetchMock);
  renderPage();
  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
  await screen.findByText("Пока никто не угадал результаты матчей.");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
