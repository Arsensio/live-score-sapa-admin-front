import { api } from "../../shared/api/client";
export type DrawInput = {
  tournamentId: string;
  teams: { teamId: string; groupId: string }[];
};
export const submitDraw = (body: DrawInput) =>
  api<void>("/api/draw/teams", { method: "POST", body });
