import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { TournamentGroupsPage } from "../src/pages/tournament-groups/ui";
import { TeamFormPage } from "../src/pages/team-form/ui";
import { TournamentFormPage } from "../src/pages/tournament-form/ui";
import { teamApi } from "../src/entities/team/api";
import { groupApi } from "../src/entities/group/api";
import { tournamentApi } from "../src/entities/tournament/api";

vi.mock("../src/entities/team/api", () => ({
  teamApi: { list: vi.fn(), inGroup: vi.fn(), create: vi.fn() },
}));
vi.mock("../src/entities/group/api", () => ({
  groupApi: {
    list: vi.fn(),
    standings: vi.fn(),
    reset: vi.fn(),
    finish: vi.fn(),
  },
}));
vi.mock("../src/entities/tournament/api", () => ({
  tournamentApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

const teams = ["1", "2"].map((id) => ({
  id,
  name: `Команда ${id}`,
  shortName: `T${id}`,
  tournamentId: "cup",
  logoUrl: "",
  players: [],
}));
const groups = [
  { id: "g1", name: "Группа A", status: "CREATED" as const },
  { id: "g2", name: "Группа B", status: "FINISHED" as const },
];
function renderRoute(element: ReactNode, path: string, url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={path} element={element} />
        <Route
          path="/tournaments/cup/teams"
          element={<div>Команды турнира</div>}
        />
        <Route path="/tournaments/cup" element={<div>Открыт турнир</div>} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.mocked(teamApi.list).mockResolvedValue(teams);
  vi.mocked(teamApi.inGroup).mockResolvedValue([]);
  vi.mocked(groupApi.list).mockResolvedValue(groups);
  vi.mocked(groupApi.standings).mockResolvedValue(
    groups.map((group, index) => ({
      ...group,
      groupOrder: index + 1,
      isPlayOff: false,
      teams: [],
    })),
  );
  vi.mocked(groupApi.finish).mockResolvedValue({
    id: "g1",
    status: "FINISHED",
  } as never);

  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(cleanup);
describe("сценарии администрирования", () => {
  it("завершает только выбранную группу после подтверждения; FINISHED заблокирована", async () => {
    const user = userEvent.setup();
    renderRoute(
      <TournamentGroupsPage />,
      "/tournaments/:tournamentId/groups",
      "/tournaments/cup/groups",
    );
    await screen.findByText("Группа A");
    expect(
      screen.getByRole("button", {
        name: "Группа завершена",
      }),
    ).toHaveProperty("disabled", true);
    await user.click(screen.getByRole("button", { name: "Завершить группу" }));
    expect(groupApi.finish).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    const buttons = dialog.querySelectorAll("button");
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(groupApi.finish).toHaveBeenCalledWith("g1"));
    await screen.findByRole("status");
  });
  it("сохраняет команду с игроком без служебного ключа формы", async () => {
    vi.mocked(teamApi.create).mockResolvedValue(teams[0]);
    const user = userEvent.setup();
    renderRoute(
      <TeamFormPage />,
      "/tournaments/:tournamentId/teams/new",
      "/tournaments/cup/teams/new",
    );
    await user.type(screen.getByLabelText("Название команды *"), "Team A");
    await user.type(screen.getByLabelText("Короткое название"), "TMA");
    await user.click(screen.getByRole("button", { name: "Добавить игрока" }));
    await user.type(screen.getByLabelText("Имя *"), "Arman");
    await user.type(screen.getByLabelText("Фамилия *"), "Aliyev");
    await user.type(screen.getByLabelText("Номер футболки"), "10");
    await user.click(screen.getByRole("button", { name: "Сохранить команду" }));
    await waitFor(() =>
      expect(teamApi.create).toHaveBeenCalledWith({
        tournamentId: "cup",
        name: "Team A",
        shortName: "TMA",
        logoUrl: null,
        players: [
          {
            firstName: "Arman",
            lastName: "Aliyev",
            shirtNumber: 10,
            photoUrl: null,
          },
        ],
      }),
    );
    await screen.findByText("Команды турнира");
  });
  it("создаёт турнир и открывает его страницу по id из ответа", async () => {
    vi.mocked(tournamentApi.create).mockResolvedValue({ id: "cup" } as never);
    const user = userEvent.setup();
    renderRoute(<TournamentFormPage />, "/tournaments/new", "/tournaments/new");
    await screen.findByLabelText("Название турнира *");
    await user.type(screen.getByLabelText("Название турнира *"), "Summer Cup");
    fireEvent.change(screen.getByLabelText("Дата начала *"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Дата окончания *"), {
      target: { value: "2026-10-10" },
    });
    await user.click(screen.getByRole("button", { name: "Создать турнир" }));
    await waitFor(() =>
      expect(tournamentApi.create).toHaveBeenCalledWith({
        name: "Summer Cup",
        description: "",
        logoUrl: "",
        startDate: "2026-10-01",
        endDate: "2026-10-10",
        maxTeams: 16,
        type: "GROUP_STAGE_WITH_PLAY_OFF",
      }),
    );
    await screen.findByText("Открыт турнир");
  });
});
