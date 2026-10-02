import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CreatePlayerAwardPage } from "../src/pages/player-awards/create";
import { PlayerAwardDetailsPage } from "../src/pages/player-awards/details";
import { PlayerAwardPollsPage } from "../src/pages/player-awards/list";
import { playerAwardApi } from "../src/entities/player-award/api";
import { ApiError } from "../src/shared/api/client";
import type { AwardPoll, AwardResults } from "../src/entities/player-award/model";

vi.mock("../src/entities/player-award/api", async (original) => ({
  ...await original<typeof import("../src/entities/player-award/api")>(),
  playerAwardApi: { list: vi.fn(), players: vi.fn(), create: vi.fn(), get: vi.fn(), results: vi.fn(), action: vi.fn() },
}));

const players = ["1", "2", "3"].map((id) => ({ id, teamId: "team", firstName: "Иван", lastName: `Игрок ${id}`, shirtNumber: Number(id), photoUrl: null }));
const poll: AwardPoll = { id: "poll", title: "Лучший игрок", candidateCount: 2, status: "DRAFT", canVote: false,
  candidates: players.slice(0, 2).map((player) => ({ ...player, playerId: player.id, teamName: "Команда" })) };
const scores: AwardResults = { pollId: "poll", status: "DRAFT", totalVoters: 0,
  results: poll.candidates.map((candidate) => ({ ...candidate, rank: 1, totalPoints: 0, firstPlaceVotes: 0 })) };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(playerAwardApi.players).mockResolvedValue({ content: players, totalPages: 1, last: true });
  vi.mocked(playerAwardApi.create).mockResolvedValue(poll);
  vi.mocked(playerAwardApi.get).mockResolvedValue(poll);
  vi.mocked(playerAwardApi.results).mockResolvedValue(scores);
  vi.mocked(playerAwardApi.action).mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it("показывает голосования турнира, переходы и следующую страницу", async () => {
  vi.mocked(playerAwardApi.list)
    .mockResolvedValueOnce({ content: [poll], totalPages: 2, totalElements: 21, last: false })
    .mockResolvedValueOnce({ content: [{ ...poll, id: "closed", title: "Итоги", status: "CLOSED" }], totalPages: 2, last: true });
  render(<MemoryRouter initialEntries={["/tournaments/cup/player-award-polls"]}><Routes>
    <Route path="/tournaments/:tournamentId/player-award-polls" element={<PlayerAwardPollsPage />} />
  </Routes></MemoryRouter>);
  expect((await screen.findByRole("link", { name: "Лучший игрок" })).getAttribute("href")).toBe("/tournaments/cup/player-award-polls/poll");
  expect(screen.getByRole("link", { name: "Создать голосование" }).getAttribute("href")).toBe("/tournaments/cup/player-award-polls/new");
  expect(playerAwardApi.list).toHaveBeenCalledWith("cup", 0, expect.any(AbortSignal));
  await userEvent.click(screen.getByRole("button", { name: "Далее" }));
  await screen.findByRole("link", { name: "Итоги" });
  expect(playerAwardApi.list).toHaveBeenLastCalledWith("cup", 1, expect.any(AbortSignal));
  expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(true);
});

function renderPage(create = false) {
  return render(<MemoryRouter initialEntries={[create ? "/tournaments/cup/player-award-polls/new" : "/tournaments/cup/player-award-polls/poll"]}><Routes>
    <Route path="/tournaments/:tournamentId/player-award-polls/new" element={<CreatePlayerAwardPage />} />
    <Route path="/tournaments/:tournamentId/player-award-polls/:pollId" element={<PlayerAwardDetailsPage />} />
  </Routes></MemoryRouter>);
}

it("создаёт голосование с точным числом кандидатов и переходит к деталям", async () => {
  renderPage(true);
  const choices = await screen.findAllByRole("checkbox");
  expect(playerAwardApi.players).toHaveBeenCalledWith("cup", "", 0, expect.any(AbortSignal));
  const create = screen.getByRole("button", { name: "Создать" }) as HTMLButtonElement;
  expect(create.disabled).toBe(true);
  await userEvent.type(screen.getByLabelText("Название"), "Лучший игрок");
  await userEvent.click(choices[1]);
  expect(create.disabled).toBe(true);
  await userEvent.click(choices[0]);
  expect(screen.getByText("Выбрано 2 из 2")).toBeTruthy();
  expect((choices[2] as HTMLInputElement).disabled).toBe(true);
  await userEvent.click(create);
  await waitFor(() => expect(playerAwardApi.create).toHaveBeenCalledExactlyOnceWith({ tournamentId: "cup", title: "Лучший игрок", candidateCount: 2, playerIds: ["2", "1"] }));
  await screen.findByText("Количество кандидатов: 2");
});

it("сохраняет выбор по ID при смене страницы и поиске", async () => {
  vi.mocked(playerAwardApi.players).mockImplementation(async (_tournamentId, name, page) => ({ content: name ? [players[0]] : page === 0 ? [players[0]] : [players[1]], totalPages: 2, last: page === 1 }));
  renderPage(true);
  await userEvent.click(await screen.findByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "Далее" }));
  await userEvent.click(await screen.findByRole("checkbox"));
  await userEvent.type(screen.getByLabelText("Поиск по имени или фамилии"), "Иван");
  await userEvent.click(screen.getByRole("button", { name: "Найти" }));
  await waitFor(() => expect(playerAwardApi.players).toHaveBeenLastCalledWith("cup", "Иван", 0, expect.any(AbortSignal)));
  expect((await screen.findByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText("Выбрано 2 из 2")).toBeTruthy();
});

it("сохраняет форму после сетевой ошибки и позволяет повторить", async () => {
  vi.mocked(playerAwardApi.create).mockRejectedValueOnce(new ApiError(0, "Нет соединения"));
  renderPage(true);
  const choices = await screen.findAllByRole("checkbox");
  fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Лучший игрок" } });
  await userEvent.click(choices[0]); await userEvent.click(choices[1]);
  await userEvent.click(screen.getByRole("button", { name: "Создать" }));
  await screen.findByText("Нет соединения");
  expect((screen.getByLabelText("Название") as HTMLInputElement).value).toBe("Лучший игрок");
  expect(screen.getByText("Выбрано 2 из 2")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
  await screen.findByText("Количество кандидатов: 2");
  expect(playerAwardApi.create).toHaveBeenCalledTimes(2);
});

it("сохраняет места и порядок результатов от сервера, включая одинаковые места", async () => {
  vi.mocked(playerAwardApi.get).mockResolvedValue({ ...poll, status: "OPEN" });
  vi.mocked(playerAwardApi.results).mockResolvedValue({ ...scores, status: "OPEN", totalVoters: 3, results: [
    { ...scores.results[1], rank: 1, totalPoints: 5, firstPlaceVotes: 2 },
    { ...scores.results[0], rank: 1, totalPoints: 5, firstPlaceVotes: 1 },
  ] });
  renderPage();
  await screen.findByText("Предварительные результаты");
  expect(screen.getByText("Проголосовали: 3")).toBeTruthy();
  const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  expect(within(rows[0]).getAllByRole("cell")[0].textContent).toBe("1");
  expect(rows[0].textContent).toContain("Игрок 2");
  expect(rows[1].textContent).toContain("Игрок 1");
});

it("открывает черновик и перезагружает детали и результаты", async () => {
  renderPage();
  await userEvent.click(await screen.findByRole("button", { name: "Открыть голосование" }));
  await waitFor(() => expect(playerAwardApi.action).toHaveBeenCalledExactlyOnceWith("poll", "OPEN"));
  await waitFor(() => expect(playerAwardApi.get).toHaveBeenCalledTimes(2));
  expect(playerAwardApi.results).toHaveBeenCalledTimes(2);
});

it("закрывает голосование только после подтверждения", async () => {
  vi.mocked(playerAwardApi.get).mockResolvedValue({ ...poll, status: "OPEN" });
  renderPage();
  await userEvent.click(await screen.findByRole("button", { name: "Закрыть голосование" }));
  expect(screen.getByText("Пользователи больше не смогут отправлять и изменять свои рейтинги.")).toBeTruthy();
  expect(playerAwardApi.action).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
  expect(playerAwardApi.action).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Закрыть голосование" }));
  vi.mocked(playerAwardApi.get).mockResolvedValue({ ...poll, status: "CLOSED" });
  vi.mocked(playerAwardApi.results).mockResolvedValue({ ...scores, status: "CLOSED" });
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Закрыть голосование" }));
  await screen.findByText("Голосование закрыто");
  expect(playerAwardApi.action).toHaveBeenCalledExactlyOnceWith("poll", "CLOSE");
  expect(screen.queryByRole("button", { name: "Открыть голосование" })).toBeNull();
});

it("после конфликта состояния перезагружает данные", async () => {
  vi.mocked(playerAwardApi.action).mockRejectedValue(new ApiError(409, "Conflict"));
  renderPage();
  await userEvent.click(await screen.findByRole("button", { name: "Открыть голосование" }));
  await waitFor(() => expect(playerAwardApi.get).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("alert").textContent).toContain("Состояние голосования изменилось");
});

it.each([[403, "Недостаточно прав"], [404, "Голосование не найдено"]])("показывает ошибку %s", async (status, message) => {
  vi.mocked(playerAwardApi.get).mockRejectedValue(new ApiError(status as number, "Server error"));
  renderPage();
  expect(await screen.findByText(message as string)).toBeTruthy();
});

it("блокирует повторное открытие на время запроса", async () => {
  let complete: () => void = () => {};
  vi.mocked(playerAwardApi.action).mockImplementation(() => new Promise<void>((resolve) => { complete = resolve; }));
  renderPage();
  await userEvent.click(await screen.findByRole("button", { name: "Открыть голосование" }));
  expect((screen.getByRole("button", { name: "Открываем…" }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Открываем…" }));
  expect(playerAwardApi.action).toHaveBeenCalledOnce();
  await act(async () => { complete(); });
});

it("обновляет каждые 10 секунд, приостанавливается в скрытой вкладке и останавливается после закрытия", async () => {
  vi.useFakeTimers();
  let visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility as DocumentVisibilityState);
  vi.mocked(playerAwardApi.get).mockResolvedValue({ ...poll, status: "OPEN" });
  vi.mocked(playerAwardApi.results).mockResolvedValue({ ...scores, status: "OPEN" });
  renderPage();
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(screen.getByText("Пока никто не проголосовал")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(playerAwardApi.results).toHaveBeenCalledTimes(2);
  visibility = "hidden";
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(playerAwardApi.results).toHaveBeenCalledTimes(2);
  visibility = "visible";
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(playerAwardApi.results).toHaveBeenCalledTimes(3);
  vi.mocked(playerAwardApi.get).mockResolvedValue({ ...poll, status: "CLOSED" });
  vi.mocked(playerAwardApi.results).mockResolvedValue({ ...scores, status: "CLOSED" });
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(screen.getByText("Голосование закрыто")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(playerAwardApi.results).toHaveBeenCalledTimes(4);
});
