import { describe, expect, it } from "vitest";
import { validateTournament } from "../src/pages/tournament-form/schema";
import { validateTeam, type TeamForm } from "../src/pages/team-form/schema";
import type { TournamentInput } from "../src/entities/tournament/model";
const tournament: TournamentInput = {
  name: "Кубок",
  description: "",
  logoUrl: "",
  startDate: "2026-10-01",
  endDate: "2026-10-10",
  maxTeams: 16,
  type: "LEAGUE",
};
describe("валидация форм", () => {
  it("отклоняет пустое название, обратные даты и некорректное количество команд", () => {
    expect(validateTournament({ ...tournament, name: " " })).toHaveProperty(
      "name",
    );
    expect(validateTournament({ ...tournament, maxTeams: 1 })).toHaveProperty(
      "maxTeams",
    );
    expect(
      validateTournament({ ...tournament, endDate: "2026-09-01" }),
    ).toHaveProperty("endDate");
    expect(validateTournament({ ...tournament, maxTeams: 2.5 })).toHaveProperty(
      "maxTeams",
    );
  });
  it("принимает корректный турнир", () =>
    expect(validateTournament(tournament)).toEqual({}));
  it("проверяет обязательные поля игрока и положительный целый номер", () => {
    const values: TeamForm = {
      name: "Команда",
      shortName: "A".repeat(51),
      logoUrl: "javascript:alert(1)",
      players: [
        {
          key: "1",
          firstName: "",
          lastName: "",
          shirtNumber: "-1",
          photoUrl: "",
        },
      ],
    };
    expect(Object.keys(validateTeam(values))).toEqual(
      expect.arrayContaining([
        "shortName",
        "logoUrl",
        "firstName-0",
        "lastName-0",
        "shirtNumber-0",
      ]),
    );
  });
  it("принимает команду с корректным игроком", () => {
    expect(
      validateTeam({
        name: "Команда",
        shortName: "TMA",
        logoUrl: "",
        players: [
          {
            key: "1",
            firstName: "Arman",
            lastName: "Aliyev",
            shirtNumber: "10",
            photoUrl: "",
          },
        ],
      }),
    ).toEqual({});
  });
});
