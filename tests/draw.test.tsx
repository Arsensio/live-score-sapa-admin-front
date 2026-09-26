import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DrawPage } from "../src/pages/draw/ui";
import { groupApi } from "../src/entities/group/api";
import { teamApi } from "../src/entities/team/api";
import { submitDraw } from "../src/pages/draw/api";
import { ApiError } from "../src/shared/api/client";
vi.mock("../src/entities/group/api", () => ({
  groupApi: { list: vi.fn(), reset: vi.fn() },
}));
vi.mock("../src/entities/team/api", () => ({
  teamApi: { list: vi.fn(), inGroup: vi.fn() },
}));
vi.mock("../src/pages/draw/api", () => ({ submitDraw: vi.fn() }));
const teams = ["1", "2", "3"].map((id) => ({
  id,
  tournamentId: "cup",
  name: `Team ${id}`,
  shortName: `T${id}`,
  logoUrl: null,
  players: [],
}));
const groups = [
  {
    id: "a",
    name: "Group A",
    status: "CREATED" as const,
    groupOrder: 1,
    isPlayOff: false,
    teams: [],
  },
  {
    id: "b",
    name: "Group B",
    status: "IN_PROGRESS" as const,
    groupOrder: 2,
    isPlayOff: false,
    teams: [teams[2]],
  },
];
function open(url = "/tournaments/cup/draw") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/tournaments/:tournamentId/draw" element={<DrawPage />} />
        <Route
          path="/tournaments/:tournamentId/draw/:groupId"
          element={<DrawPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.mocked(teamApi.list).mockResolvedValue(teams);
  vi.mocked(groupApi.list).mockResolvedValue(groups);
  vi.mocked(teamApi.inGroup).mockRejectedValue(
    new Error("Отдельная загрузка состава не должна вызываться"),
  );
  vi.mocked(submitDraw).mockResolvedValue(undefined);
  vi.mocked(groupApi.reset).mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(() => {
  cleanup();
  expect(teamApi.inGroup).not.toHaveBeenCalled();
});
describe("жеребьевка внутри группы", () => {
  it("сортирует группы и плей-офф по groupOrder из filter", async () => {
    vi.mocked(groupApi.list).mockResolvedValue([
      {
        ...groups[0],
        id: "final",
        name: "final",
        groupOrder: 5,
        isPlayOff: true,
      },
      { ...groups[0], id: "semi", name: "1/2", groupOrder: 3, isPlayOff: true },
      groups[1],
      groups[0],
    ]);
    open();
    await screen.findByRole("link", { name: "Открыть final" });
    expect(
      screen
        .getAllByRole("link", { name: /^Открыть / })
        .map((link) => link.getAttribute("aria-label")),
    ).toEqual([
      "Открыть Group A",
      "Открыть Group B",
      "Открыть 1/2",
      "Открыть final",
    ]);
    expect(groupApi.list).toHaveBeenCalledWith(
      "cup",
      undefined,
      expect.any(AbortSignal),
    );
    expect(screen.getByText("Команд в группе: 1")).toBeTruthy();
    expect(screen.getByText("Team 3")).toBeTruthy();
  });
  it("не предлагает все команды как свободные, если backend не прислал teams", async () => {
    vi.mocked(groupApi.list).mockResolvedValue([
      { ...groups[0], teams: undefined } as never,
    ]);
    open("/tournaments/cup/draw/a");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "не вернул состав",
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
  it("показывает карточки групп и открывает выбранную группу", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("link", { name: "Открыть Group A" });
    expect(screen.getByRole("link", { name: "Открыть Group B" })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    await user.click(screen.getByRole("link", { name: "Открыть Group A" }));
    await screen.findByRole("checkbox", { name: "Добавить Team 1" });
    expect(
      screen.queryByRole("checkbox", { name: "Добавить Team 3" }),
    ).toBeNull();
    await user.click(
      screen.getByRole("link", { name: "Все группы жеребьевки" }),
    );
    await screen.findByRole("link", { name: "Открыть Group A" });
  });
  it("отправляет только отмеченные команды в открытую группу и перечитывает состав", async () => {
    vi.mocked(submitDraw).mockImplementation(async () => {
      vi.mocked(groupApi.list).mockResolvedValue([
        { ...groups[0], status: "IN_PROGRESS", teams: [teams[1]] },
        groups[1],
      ]);
    });
    const user = userEvent.setup();
    open("/tournaments/cup/draw/a");
    await screen.findByRole("checkbox", { name: "Добавить Team 2" });
    expect(
      screen.getByRole("button", { name: "Добавить в Group A" }),
    ).toHaveProperty("disabled", true);
    await user.click(screen.getByRole("checkbox", { name: "Добавить Team 2" }));
    await user.click(
      screen.getByRole("button", { name: "Добавить в Group A (1)" }),
    );
    await waitFor(() =>
      expect(submitDraw).toHaveBeenCalledWith({
        tournamentId: "cup",
        teams: [{ teamId: "2", groupId: "a" }],
      }),
    );
    await screen.findByText("Команды добавлены в Group A.");
    await screen.findByRole("checkbox", { name: "Добавить Team 1" });
    expect(
      screen.queryByRole("checkbox", { name: "Добавить Team 2" }),
    ).toBeNull();
    expect(screen.getByText("В процессе")).toBeTruthy();
    expect(teamApi.list).toHaveBeenCalledTimes(2);
  });
  it("сохраняет выбор при поиске и позволяет добавить несколько команд", async () => {
    const user = userEvent.setup();
    open("/tournaments/cup/draw/a");
    await screen.findByRole("checkbox", { name: "Добавить Team 1" });
    await user.click(screen.getByRole("checkbox", { name: "Добавить Team 1" }));
    await user.type(screen.getByRole("searchbox"), "Team 2");
    await user.click(screen.getByRole("checkbox", { name: "Добавить Team 2" }));
    await user.click(
      screen.getByRole("button", { name: "Добавить в Group A (2)" }),
    );
    await waitFor(() =>
      expect(submitDraw).toHaveBeenCalledWith({
        tournamentId: "cup",
        teams: [
          { teamId: "1", groupId: "a" },
          { teamId: "2", groupId: "a" },
        ],
      }),
    );
  });
  it("разрешает дополнять IN_PROGRESS, исключая уже назначенные команды", async () => {
    vi.mocked(groupApi.list).mockResolvedValue([
      { ...groups[0], status: "IN_PROGRESS", teams: [teams[0]] },
      groups[1],
    ]);
    const user = userEvent.setup();
    open("/tournaments/cup/draw/a");
    await screen.findByRole("checkbox", { name: "Добавить Team 2" });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Добавить в Group A (1)" }),
    );
    await waitFor(() =>
      expect(submitDraw).toHaveBeenCalledWith({
        tournamentId: "cup",
        teams: [{ teamId: "2", groupId: "a" }],
      }),
    );
  });
  it("разрешает добавить команды завершённой группы в следующую группу", async () => {
    vi.mocked(groupApi.list).mockResolvedValue([
      groups[0],
      { ...groups[1], status: "FINISHED" },
    ]);
    const user = userEvent.setup();
    open("/tournaments/cup/draw/a");
    await screen.findByRole("checkbox", { name: "Добавить Team 3" });
    await user.click(screen.getByRole("checkbox", { name: "Добавить Team 3" }));
    await user.click(
      screen.getByRole("button", { name: "Добавить в Group A (1)" }),
    );
    await waitFor(() =>
      expect(submitDraw).toHaveBeenCalledWith({
        tournamentId: "cup",
        teams: [{ teamId: "3", groupId: "a" }],
      }),
    );
  });
  it("не освобождает команду, если она также состоит в незавершённой группе", async () => {
    vi.mocked(groupApi.list).mockResolvedValue([
      groups[0],
      { ...groups[1], status: "FINISHED" },
      { ...groups[1], id: "c", name: "Group C", status: "IN_PROGRESS" },
    ]);
    open("/tournaments/cup/draw/a");
    await screen.findByRole("checkbox", { name: "Добавить Team 1" });
    expect(
      screen.queryByRole("checkbox", { name: "Добавить Team 3" }),
    ).toBeNull();
  });
  it("для FINISHED показывает только состав", async () => {
    vi.mocked(groupApi.list).mockResolvedValue([
      groups[0],
      { ...groups[1], status: "FINISHED" },
    ]);
    open("/tournaments/cup/draw/b");
    await screen.findByText("Team 3");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Добавить в/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Сбросить/ })).toBeNull();
  });
  it("обрабатывает конфликт без ложного успеха и позволяет обновить данные", async () => {
    vi.mocked(submitDraw).mockRejectedValue(new ApiError(409, "Conflict"));
    const user = userEvent.setup();
    open("/tournaments/cup/draw/a");
    await screen.findByRole("checkbox", { name: "Добавить Team 1" });
    await user.click(screen.getByRole("checkbox", { name: "Добавить Team 1" }));
    await user.click(
      screen.getByRole("button", { name: "Добавить в Group A (1)" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "уже состоит в группе",
    );
    expect(screen.queryByText("Команды добавлены в Group A.")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Обновить распределение" }),
    );
    await screen.findByRole("checkbox", { name: "Добавить Team 1" });
    expect(
      screen.getByRole("button", { name: "Добавить в Group A" }),
    ).toHaveProperty("disabled", true);
  });
  it("сбрасывает только открытую группу после подтверждения", async () => {
    vi.mocked(groupApi.list).mockResolvedValue([
      { ...groups[0], teams: [teams[0]] },
      groups[1],
    ]);
    vi.mocked(groupApi.reset).mockImplementation(async () => {
      vi.mocked(groupApi.list).mockResolvedValue(groups);
    });
    const user = userEvent.setup();
    open("/tournaments/cup/draw/a");
    await screen.findByRole("button", { name: "Сбросить жеребьевку группы" });
    await user.click(
      screen.getByRole("button", { name: "Сбросить жеребьевку группы" }),
    );
    expect(groupApi.reset).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Сбросить жеребьевку", exact: true }),
    );
    await waitFor(() => expect(groupApi.reset).toHaveBeenCalledWith("a"));
    await screen.findByText("Жеребьевка Group A сброшена.");
    await screen.findByRole("checkbox", { name: "Добавить Team 1" });
  });
  it("не выдумывает группы при пустом ответе backend", async () => {
    vi.mocked(groupApi.list).mockResolvedValue([]);
    open();
    await screen.findByText(/Групп пока нет/);
    expect(screen.queryByRole("link", { name: "Открыть Group A" })).toBeNull();
  });
  it("показывает ошибку для группы не из этого турнира", async () => {
    open("/tournaments/cup/draw/unknown");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Группа не найдена",
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
