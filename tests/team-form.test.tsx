import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { TeamFormPage } from "../src/pages/team-form/ui";
import { validateTeam } from "../src/pages/team-form/schema";
import { teamToForm } from "../src/pages/team-form/model";
import { teamApi } from "../src/entities/team/api";
import type { Team } from "../src/entities/team/model";

vi.mock("../src/entities/team/api", () => ({
  teamApi: { get: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
const team: Team = {
  id: "team-1",
  tournamentId: "cup",
  name: "Team A",
  shortName: "TMA",
  logoUrl: "http://localhost:8091/image/team/logo.jpg",
  players: [
    {
      id: "p1",
      teamId: "team-1",
      firstName: "Arman",
      lastName: "Aliyev",
      shirtNumber: 10,
      photoUrl: "http://localhost:8091/image/player/arman.jpg",
      createdAt: "2026-09-25",
    },
    {
      id: "p2",
      teamId: "team-1",
      firstName: "Dias",
      lastName: "Omarov",
      shirtNumber: null,
      photoUrl: null,
    },
  ],
};
function openForm(edit = true) {
  return render(
    <MemoryRouter
      initialEntries={[
        edit
          ? "/tournaments/cup/teams/team-1/edit"
          : "/tournaments/cup/teams/new",
      ]}
    >
      <Routes>
        <Route
          path="/tournaments/:tournamentId/teams/:teamId/edit"
          element={<TeamFormPage />}
        />
        <Route
          path="/tournaments/:tournamentId/teams/new"
          element={<TeamFormPage />}
        />
        <Route path="/tournaments/cup/teams" element={<p>Список команд</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.mocked(teamApi.get).mockResolvedValue(team);
  vi.mocked(teamApi.update).mockResolvedValue(team);
  vi.mocked(teamApi.create).mockResolvedValue(team);
});
afterEach(cleanup);

describe("TeamFormPage: создание и редактирование", () => {
  it("загружает команду и весь состав, null-номер оставляет пустым", async () => {
    openForm();
    await screen.findByDisplayValue("Team A");
    expect(teamApi.get).toHaveBeenCalledWith("team-1", expect.any(AbortSignal));
    expect(
      screen
        .getAllByLabelText("Имя *")
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(["Arman", "Dias"]);
    expect(screen.getAllByLabelText("Номер футболки")[1]).toHaveProperty(
      "value",
      "",
    );
    expect(
      screen.getByAltText("Предпросмотр: Логотип команды").getAttribute("src"),
    ).toBe("/image/team/logo.jpg");
    expect(
      screen.getByAltText("Предпросмотр: Фото игрока 1").getAttribute("src"),
    ).toBe("/image/player/arman.jpg");
  });
  it("отправляет весь изменённый состав одним update без идентификаторов и дат", async () => {
    const user = userEvent.setup();
    openForm();
    await screen.findByDisplayValue("Team A");
    await user.clear(screen.getByLabelText("Название команды *"));
    await user.type(
      screen.getByLabelText("Название команды *"),
      "Team A Updated",
    );
    await user.click(screen.getByRole("button", { name: "Удалить игрока 2" }));
    await user.click(screen.getByRole("button", { name: "Добавить игрока" }));
    await user.type(screen.getAllByLabelText("Имя *")[1], "New");
    await user.type(screen.getAllByLabelText("Фамилия *")[1], "Player");
    await user.click(screen.getByRole("button", { name: "Сохранить команду" }));
    await waitFor(() =>
      expect(teamApi.update).toHaveBeenCalledWith("team-1", {
        tournamentId: "cup",
        name: "Team A Updated",
        shortName: "TMA",
        logoUrl: "/image/team/logo.jpg",
        players: [
          {
            firstName: "Arman",
            lastName: "Aliyev",
            shirtNumber: 10,
            photoUrl: "/image/player/arman.jpg",
          },
          {
            firstName: "New",
            lastName: "Player",
            shirtNumber: null,
            photoUrl: null,
          },
        ],
      }),
    );
    expect(teamApi.update).toHaveBeenCalledTimes(1);
    expect(teamApi.create).not.toHaveBeenCalled();
    await screen.findByText("Список команд");
  });
  it("может сохранить пустой состав после удаления всех игроков", async () => {
    const user = userEvent.setup();
    openForm();
    await screen.findByDisplayValue("Team A");
    await user.click(screen.getByRole("button", { name: "Удалить игрока 2" }));
    await user.click(screen.getByRole("button", { name: "Удалить игрока 1" }));
    await user.click(screen.getByRole("button", { name: "Сохранить команду" }));
    await waitFor(() =>
      expect(teamApi.update).toHaveBeenCalledWith(
        "team-1",
        expect.objectContaining({ players: [] }),
      ),
    );
  });
  it("не показывает пустую форму при ошибке загрузки, разрешает повторить", async () => {
    vi.mocked(teamApi.get).mockRejectedValueOnce(
      new Error("Команда недоступна"),
    );
    const user = userEvent.setup();
    openForm();
    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Сохранить команду" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    await screen.findByDisplayValue("Team A");
  });
  it("не разрешает перезаписать состав, если GET не вернул players", async () => {
    vi.mocked(teamApi.get).mockResolvedValue({
      ...team,
      players: undefined,
    } as unknown as Team);
    openForm();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "полный состав",
    );
    expect(
      screen.queryByRole("button", { name: "Сохранить команду" }),
    ).toBeNull();
  });
  it("после ошибки PUT сохраняет введённые данные для повторной отправки", async () => {
    vi.mocked(teamApi.update).mockRejectedValueOnce(
      new Error("Ошибка сохранения"),
    );
    const user = userEvent.setup();
    openForm();
    await screen.findByDisplayValue("Team A");
    await user.type(screen.getByLabelText("Название команды *"), " Updated");
    await user.click(screen.getByRole("button", { name: "Сохранить команду" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Название команды *")).toHaveProperty(
      "value",
      "Team A Updated",
    );
    expect(screen.getAllByLabelText("Имя *")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Сохранить команду" }));
    await screen.findByText("Список команд");
    expect(teamApi.update).toHaveBeenCalledTimes(2);
  });
  it("создаёт команду без необязательных полей и не загружает команду", async () => {
    const user = userEvent.setup();
    openForm(false);
    expect(screen.getByLabelText("Название команды *")).toHaveProperty(
      "value",
      "",
    );
    await user.type(screen.getByLabelText("Название команды *"), "New team");
    await user.click(screen.getByRole("button", { name: "Добавить игрока" }));
    await user.type(screen.getByLabelText("Имя *"), "Arman");
    await user.type(screen.getByLabelText("Фамилия *"), "Aliyev");
    await user.click(screen.getByRole("button", { name: "Сохранить команду" }));
    await waitFor(() =>
      expect(teamApi.create).toHaveBeenCalledWith({
        tournamentId: "cup",
        name: "New team",
        shortName: null,
        logoUrl: null,
        players: [
          {
            firstName: "Arman",
            lastName: "Aliyev",
            shirtNumber: null,
            photoUrl: null,
          },
        ],
      }),
    );
    expect(teamApi.get).not.toHaveBeenCalled();
    expect(teamApi.update).not.toHaveBeenCalled();
  });
  it("проверяет длину имени и фамилии и допускает пустой номер", () => {
    const form = teamToForm(team);
    expect(validateTeam(form)).toEqual({});
    form.players[0].firstName = "A".repeat(101);
    form.players[0].lastName = "B".repeat(101);
    expect(validateTeam(form)).toMatchObject({
      "firstName-0": expect.any(String),
      "lastName-0": expect.any(String),
    });
    form.players[1].shirtNumber = "0";
    expect(validateTeam(form)).toHaveProperty("shirtNumber-1");
    form.players[1].shirtNumber = "2.5";
    expect(validateTeam(form)).toHaveProperty("shirtNumber-1");
  });
});
