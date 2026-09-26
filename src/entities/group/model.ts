import type { Team } from "../team/model";

export type GroupStatus = "CREATED" | "IN_PROGRESS" | "FINISHED";
export type Group = {
  id: string;
  name: string;
  status: GroupStatus;
  tournamentId?: string;
  groupOrder: number;
  isPlayOff: boolean;
  teams: Team[];
};
export const groupStatusLabels: Record<GroupStatus, string> = {
  CREATED: "Создана",
  IN_PROGRESS: "В процессе",
  FINISHED: "Завершена",
};
export type GroupTeamStatistics = {
  groupTeamId: string;
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  teamLogoUrl: string | null;
  statisticsId: string;
  isLive?: boolean;
  gamePlayed: number;
  winCount: number;
  drawCount: number;
  loseCount: number;
  goalCount: number;
  goalMissed: number;
  goalDifference: number;
  points: number;
};
export type GroupWithStatistics = Omit<Group, "teams"> & {
  teams: GroupTeamStatistics[];
};
