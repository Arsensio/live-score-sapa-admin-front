import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { TournamentGroupsPage } from "../src/pages/tournament-groups/ui";
import { groupApi } from "../src/entities/group/api";
import type { GroupWithStatistics } from "../src/entities/group/model";
vi.mock("../src/entities/group/api", () => ({
  groupApi: {
    standings: vi.fn(),
    list: vi.fn(),
    reset: vi.fn(),
    finish: vi.fn(),
  },
}));
const groups: GroupWithStatistics[] = [
  {
    id: "final",
    name: "final",
    groupOrder: 5,
    isPlayOff: true,
    status: "CREATED",
    teams: [],
  },
  {
    id: "a",
    name: "Group A",
    groupOrder: 1,
    isPlayOff: false,
    status: "IN_PROGRESS",
    teams: [
      {
        groupTeamId: "membership",
        teamId: "team",
        teamName: "2018",
        teamShortName: "18",
        teamLogoUrl: "/image/team/logo.jpg",
        statisticsId: "stats",
        gamePlayed: 5,
        winCount: 3,
        drawCount: 1,
        loseCount: 1,
        goalCount: 8,
        goalMissed: 4,
        goalDifference: 4,
        points: 10,
      },
    ],
  },
];
function open() {
  render(
    <MemoryRouter initialEntries={["/tournaments/cup/groups"]}>
      <Routes>
        <Route
          path="/tournaments/:tournamentId/groups"
          element={<TournamentGroupsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.mocked(groupApi.standings).mockResolvedValue(groups);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(cleanup);
describe("вкладка Группы со статистикой", () => {
  it("запрашивает подтверждение, завершает группу и перечитывает статистику без DELETE", async () => {
    vi.mocked(groupApi.finish).mockImplementation(async () => {
      vi.mocked(groupApi.standings).mockResolvedValue([
        groups[0],
        { ...groups[1], status: "FINISHED" },
      ]);
      return { id: "a", status: "FINISHED", teams: [] } as never;
    });
    const user = userEvent.setup();
    open();
    await screen.findByText("2018");
    expect(screen.queryByRole("button", { name: /Сбросить/ })).toBeNull();
    await user.click(
      screen.getAllByRole("button", { name: "Завершить группу" })[0],
    );
    expect(groupApi.finish).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(groupApi.finish).not.toHaveBeenCalled();
    await user.click(
      screen.getAllByRole("button", { name: "Завершить группу" })[0],
    );
    await user.click(
      screen.getByRole("button", { name: "Да, завершить группу" }),
    );
    await waitFor(() => expect(groupApi.finish).toHaveBeenCalledWith("a"));
    expect(
      await screen.findByRole("button", { name: "Группа завершена" }),
    ).toHaveProperty("disabled", true);
    expect(groupApi.reset).not.toHaveBeenCalled();
    expect(groupApi.standings).toHaveBeenCalledTimes(2);
    expect(screen.getByText("2018")).toBeTruthy();
  });
  it("при ошибке завершения сохраняет статус и позволяет повторить запрос", async () => {
    vi.mocked(groupApi.finish).mockRejectedValue(
      new Error("Завершение запрещено"),
    );
    const user = userEvent.setup();
    open();
    await screen.findByText("2018");
    await user.click(
      screen.getAllByRole("button", { name: "Завершить группу" })[0],
    );
    await user.click(
      screen.getByRole("button", { name: "Да, завершить группу" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Завершение запрещено",
    );
    expect(
      screen.getByRole("button", { name: "Да, завершить группу" }),
    ).toHaveProperty("disabled", false);
    expect(groupApi.standings).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Группа «Group A» завершена.")).toBeNull();
  });
  it("загружает статистику новым методом и показывает все показатели в порядке groupOrder", async () => {
    open();
    await screen.findByText("2018");
    expect(groupApi.standings).toHaveBeenCalledWith(
      "cup",
      expect.any(AbortSignal),
    );
    expect(groupApi.list).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent),
    ).toEqual(["Group A", "final"]);
    const card = screen.getByRole("row", { name: "Статистика 2018" });
    for (const [label, value] of [
      ["Игры", "5"],
      ["Победы", "3"],
      ["Ничьи", "1"],
      ["Поражения", "1"],
      ["Забито", "8"],
      ["Пропущено", "4"],
      ["Разница", "+4"],
    ]) {
      expect(
        within(card).getByRole("cell", { name: label, exact: true })
          .textContent,
      ).toBe(value);
    }
    expect(within(card).getByRole("cell", { name: "Очки" }).textContent).toBe(
      "10",
    );
    expect(card.querySelector("img")?.getAttribute("src")).toBe(
      "/image/team/logo.jpg",
    );
    expect(screen.getByText("Команды пока не распределены.")).toBeTruthy();
  });
  it("фильтрует статусы локально без обращения к /filter", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("2018");
    await user.selectOptions(screen.getByRole("combobox"), "CREATED");
    expect(screen.queryByText("Group A")).toBeNull();
    expect(screen.getByText("final")).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox"), "FINISHED");
    expect(screen.getByText("Групп с выбранным статусом нет.")).toBeTruthy();
    expect(groupApi.standings).toHaveBeenCalledTimes(1);
    expect(groupApi.list).not.toHaveBeenCalled();
  });
  it("сохраняет нули статистики и отрицательную разницу голов", async () => {
    vi.mocked(groupApi.standings).mockResolvedValue([
      {
        ...groups[1],
        teams: [
          { ...groups[1].teams[0], points: 0, winCount: 0, goalDifference: -2 },
        ],
      },
    ]);
    open();
    await screen.findByText("2018");
    const card = screen.getByRole("row", { name: "Статистика 2018" });
    expect(within(card).getByRole("cell", { name: "Очки" }).textContent).toBe(
      "0",
    );
    expect(within(card).getByRole("cell", { name: "Победы" }).textContent).toBe(
      "0",
    );
    expect(
      within(card).getByRole("cell", { name: "Разница" }).textContent,
    ).toBe("-2");
  });
});
