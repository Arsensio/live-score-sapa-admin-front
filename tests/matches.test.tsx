import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GroupMatches } from "../src/pages/tournament-groups/matches";
import { EditMatchDialog } from "../src/pages/match/edit-match-dialog";
import { MatchPage } from "../src/pages/match/ui";
import { matchApi } from "../src/entities/match/api";
import { matchEventApi } from "../src/entities/match/events-api";
import { teamApi } from "../src/entities/team/api";
import type { Match } from "../src/entities/match/model";

vi.mock("../src/entities/match/api", () => ({
  matchApi: { byGroup: vi.fn(), byId: vi.fn(), start: vi.fn(), update: vi.fn(), startShootout: vi.fn(), finish: vi.fn() },
}));
vi.mock("../src/entities/match/events-api", () => ({ matchEventApi: { create: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock("../src/entities/team/api", () => ({ teamApi: { inGroup: vi.fn(), get: vi.fn() } }));

const match: Match = {
  id: "match-1", tournamentId: "cup", groupId: "group-1",
  teamId1: "team-1", teamId2: "team-2", homeScore: 0, awayScore: 0,
  status: "CREATED", scheduledAt: "2026-09-30T18:30:00",
  liveUrl: "https://www.youtube.com/watch?v=old",
  startedAt: null, finishedAt: null, createdAt: "", updatedAt: "",
};

beforeEach(() => {
  vi.resetAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  vi.mocked(matchApi.byGroup).mockResolvedValue({ content: [match] } as never);
  vi.mocked(matchApi.update).mockResolvedValue(match);
  vi.mocked(matchApi.byId).mockResolvedValue(match);
  vi.mocked(matchApi.start).mockResolvedValue(undefined);
  vi.mocked(matchApi.startShootout).mockResolvedValue(undefined);
  vi.mocked(matchApi.finish).mockResolvedValue(undefined);
  vi.mocked(teamApi.get).mockResolvedValue({ players: [] } as never);
  vi.mocked(teamApi.inGroup).mockResolvedValue(["1", "2", "3"].map((id) => ({
    id: `team-${id}`, tournamentId: "cup", name: `Команда ${id}`,
    shortName: null, logoUrl: null, players: [],
  })));
});
afterEach(cleanup);

function renderMatch(value: Match) {
  vi.mocked(matchApi.byId).mockResolvedValue(value);
  return render(<MemoryRouter initialEntries={["/matches/match-1"]}><Routes>
    <Route path="/matches/:matchId" element={<MatchPage />} />
  </Routes></MemoryRouter>);
}

it.each([
  ["LIVE", true, 0, 0, true],
  ["LIVE", true, 1, 1, true],
  ["LIVE", true, 1, 0, false],
  ["LIVE", false, 0, 0, false],
  ["CREATED", true, 0, 0, false],
  ["FINISHED", true, 0, 0, false],
] as const)("условия запуска серии: %s, плей-офф %s, %s:%s", async (status, isPlayOff, homeScore, awayScore, visible) => {
  renderMatch({ ...match, status, isPlayOff, homeScore, awayScore });
  await screen.findByText("События матча");
  expect(Boolean(screen.queryByRole("button", { name: "Начать серию пенальти" }))).toBe(visible);
});

it("обновляет матч после ошибки запуска серии и показывает ошибку", async () => {
  vi.mocked(matchApi.startShootout).mockRejectedValue(new Error("Нельзя начать серию"));
  renderMatch({ ...match, status: "LIVE", isPlayOff: true });
  await userEvent.click(await screen.findByRole("button", { name: "Начать серию пенальти" }));
  await screen.findByText("Нельзя начать серию");
  await waitFor(() => expect(matchApi.byId).toHaveBeenCalledTimes(2));
});

it("после запуска серии загружает матч с новым статусом", async () => {
  renderMatch({ ...match, status: "LIVE", isPlayOff: true });
  await screen.findByRole("button", { name: "Начать серию пенальти" });
  vi.mocked(matchApi.byId).mockResolvedValue({ ...match, status: "PENALTY_SHOOTOUT" });
  await userEvent.click(screen.getByRole("button", { name: "Начать серию пенальти" }));
  await screen.findByText("Серия пенальти — ожидается первый удар");
  expect(matchApi.startShootout).toHaveBeenCalledExactlyOnceWith("match-1");
});

it.each(["SHOOTOUT_GOAL", "SHOOTOUT_MISS"] as const)("отправляет %s без игрока, минуты и ассиста", async (type) => {
  renderMatch({ ...match, status: "PENALTY_SHOOTOUT" });
  await userEvent.click(await screen.findByRole("button", { name: "Добавить событие" }));
  expect(screen.queryByLabelText("Минута")).toBeNull();
  expect(screen.queryByLabelText(/Ассист/)).toBeNull();
  const types = screen.getByLabelText("Тип события") as HTMLSelectElement;
  expect(Array.from(types.options).map((option) => option.value)).toEqual(["SHOOTOUT_GOAL", "SHOOTOUT_MISS"]);
  expect((screen.getByLabelText(/Игрок/) as HTMLSelectElement).required).toBe(false);
  await userEvent.selectOptions(types, type);
  await userEvent.click(screen.getByRole("button", { name: "Добавить", exact: true }));
  await waitFor(() => expect(matchEventApi.create).toHaveBeenCalledExactlyOnceWith({
    matchId: "match-1", teamId: "team-1", playerId: null, type, minute: null, assistPlayerId: null,
  }));
  expect(matchApi.byId).toHaveBeenCalledTimes(2);
});

it.each([[null, null, false], [0, 0, false], [4, 4, false], [4, 3, true]] as const)("завершение серии при %s:%s", async (homePenaltyScore, awayPenaltyScore, enabled) => {
  renderMatch({ ...match, status: "PENALTY_SHOOTOUT", homePenaltyScore, awayPenaltyScore });
  const button = await screen.findByRole("button", { name: "Завершить матч" }) as HTMLButtonElement;
  expect(button.disabled).toBe(!enabled);
  if (homePenaltyScore !== null) expect(screen.getByText(`Пенальти: ${homePenaltyScore} : ${awayPenaltyScore}`)).toBeTruthy();
  expect(matchApi.finish).not.toHaveBeenCalled();
});

it("показывает историю серии после основных событий и выделяет победителя завершённого матча", async () => {
  const event = { id: "event", matchId: match.id, teamId: "team-1", playerId: null, createdAt: "2026-09-30T15:10:00", updatedAt: "" };
  const { container } = renderMatch({ ...match, status: "FINISHED", homeScore: 1, awayScore: 1,
    homePenaltyScore: 4, awayPenaltyScore: 3, winnerTeamId: "team-1", events: [
      { ...event, id: "late", type: "SHOOTOUT_MISS", minute: null, createdAt: "2026-09-30T15:11:00" },
      { ...event, id: "goal", type: "GOAL", minute: 23 },
      { ...event, id: "early", type: "SHOOTOUT_GOAL", minute: 0 },
    ] });
  await screen.findByText("Пенальти: 4 : 3");
  expect(screen.getByText("1 : 1")).toBeTruthy();
  expect(container.querySelector(".match-winner")?.textContent).toContain("Победитель");
  expect(container.querySelectorAll(".match-event-minute").length).toBe(1);
  const rows = container.querySelectorAll(".match-shootout-event");
  expect(rows[0].textContent).toContain("Забил пенальти");
  expect(rows[1].textContent).toContain("Не забил пенальти");
  expect(screen.queryByRole("button", { name: "Добавить событие" })).toBeNull();
});

it.each(["FINISHED", "CANCELLED"] as const)("скрывает форму событий в статусе %s", async (status) => {
  renderMatch({ ...match, status });
  await screen.findByText("События матча");
  expect(screen.queryByRole("button", { name: "Добавить событие" })).toBeNull();
});

it.each(["изменить", "удалить"])("обновляет матч после операции с ударом: %s", async (action) => {
  const event = { id: "kick", matchId: match.id, teamId: "team-1", playerId: null,
    type: "SHOOTOUT_GOAL" as const, minute: null, createdAt: "2026-09-30T15:10:00", updatedAt: "" };
  renderMatch({ ...match, status: "PENALTY_SHOOTOUT", events: [event] });
  if (action === "изменить") {
    await userEvent.click(await screen.findByRole("button", { name: "Изменить" }));
    await userEvent.selectOptions(screen.getByLabelText("Тип события"), "SHOOTOUT_MISS");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(matchEventApi.update).toHaveBeenCalledWith("kick", expect.objectContaining({ type: "SHOOTOUT_MISS", minute: null, assistPlayerId: null })));
  } else {
    await userEvent.click(await screen.findByRole("button", { name: "Удалить" }));
    const buttons = screen.getAllByRole("button", { name: "Удалить" });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(matchEventApi.delete).toHaveBeenCalledExactlyOnceWith("kick"));
  }
  await waitFor(() => expect(matchApi.byId).toHaveBeenCalledTimes(2));
});

it.each([false, true])("обновляет матч после завершения серии, ошибка: %s", async (fails) => {
  if (fails) vi.mocked(matchApi.finish).mockRejectedValue(new Error("Счёт серии изменился"));
  renderMatch({ ...match, status: "PENALTY_SHOOTOUT", homePenaltyScore: 4, awayPenaltyScore: 3 });
  await userEvent.click(await screen.findByRole("button", { name: "Завершить матч" }));
  expect(matchApi.finish).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Да, завершить" }));
  await waitFor(() => expect(matchApi.finish).toHaveBeenCalledExactlyOnceWith("match-1"));
  await waitFor(() => expect(matchApi.byId).toHaveBeenCalledTimes(2));
  if (fails) expect(await screen.findByText("Счёт серии изменился")).toBeTruthy();
});

it("обычные события требуют игрока и скрывают типы серии", async () => {
  renderMatch({ ...match, status: "LIVE" });
  await userEvent.click(await screen.findByRole("button", { name: "Добавить событие" }));
  expect((screen.getByLabelText(/Игрок/) as HTMLSelectElement).required).toBe(true);
  expect(Array.from((screen.getByLabelText("Тип события") as HTMLSelectElement).options).map((option) => option.value)).toEqual(["GOAL", "OWN_GOAL", "YELLOW_CARD", "RED_CARD"]);
  expect(screen.getByLabelText("Минута")).toBeTruthy();
});

it.each(["список", "страница матча"])("запускает матч только после подтверждения: %s", async (location) => {
  render(<MemoryRouter initialEntries={[location === "список" ? "/groups" : "/matches/match-1"]}><Routes>
    <Route path="/groups" element={<GroupMatches groupId="group-1" groupName="A" />} />
    <Route path="/matches/:matchId" element={<MatchPage />} />
  </Routes></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button", { name: "СТАРТ" }));
  expect(screen.getByText("Вы уверены, что хотите начать матч?")).toBeTruthy();
  expect(matchApi.start).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
  expect(matchApi.start).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "СТАРТ" }));
  await userEvent.click(screen.getByRole("button", { name: "Да, начать матч" }));
  await waitFor(() => expect(matchApi.start).toHaveBeenCalledExactlyOnceWith("match-1"));
});

it("открывает запланированный матч без запуска", async () => {
  render(<MemoryRouter initialEntries={["/groups"]}><Routes>
    <Route path="/groups" element={<GroupMatches groupId="group-1" groupName="A" />} />
    <Route path="/matches/:matchId" element={<div>Детали матча</div>} />
  </Routes></MemoryRouter>);
  await userEvent.click(await screen.findByRole("link", { name: "Открыть матч" }));
  expect(screen.getByText("Детали матча")).toBeTruthy();
  expect(matchApi.start).not.toHaveBeenCalled();
});

it("сохраняет команды, местное время и новую ссылку без запуска матча", async () => {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<EditMatchDialog match={match} onSaved={onSaved} onClose={onClose} />);
  const firstTeam = await screen.findByLabelText("Первая команда");
  expect((firstTeam as HTMLSelectElement).value).toBe("team-1");
  expect((screen.getByLabelText("Дата и время") as HTMLInputElement).value).toBe("2026-09-30T18:30");
  await userEvent.selectOptions(firstTeam, "team-3");
  fireEvent.change(screen.getByLabelText("Дата и время"), { target: { value: "2026-10-01T20:45" } });
  fireEvent.change(screen.getByLabelText(/Ссылка на YouTube/), { target: { value: "https://www.youtube.com/watch?v=new" } });
  await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(matchApi.update).toHaveBeenCalledWith("match-1", {
    groupId: "group-1", teamId1: "team-3", teamId2: "team-2",
    scheduledAt: "2026-10-01T20:45", liveUrl: "https://www.youtube.com/watch?v=new",
  }));
  expect(onSaved).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
  expect(matchApi.start).not.toHaveBeenCalled();
});

it("позволяет убрать ссылку на трансляцию", async () => {
  render(<EditMatchDialog match={match} onSaved={vi.fn()} onClose={vi.fn()} />);
  await screen.findByLabelText("Первая команда");
  fireEvent.change(screen.getByLabelText(/Ссылка на YouTube/), { target: { value: "" } });
  await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(matchApi.update).toHaveBeenCalledWith("match-1", expect.objectContaining({ liveUrl: "" })));
});
