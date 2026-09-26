export type TournamentType =
  "LEAGUE" | "PLAY_OFF" | "GROUP_STAGE_WITH_PLAY_OFF";
export type TournamentStatus =
  "DRAFT" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
export type TournamentInput = {
  name: string;
  description: string;
  logoUrl: string;
  startDate: string;
  endDate: string;
  maxTeams: number;
  type: TournamentType;
};
export type Tournament = TournamentInput & {
  id: string;
  status: TournamentStatus;
};
export const typeLabels: Record<TournamentType, string> = {
  LEAGUE: "Лига",
  PLAY_OFF: "Плей-офф",
  GROUP_STAGE_WITH_PLAY_OFF: "Группы + плей-офф",
};
export const statusLabels: Record<TournamentStatus, string> = {
  DRAFT: "Черновик",
  IN_PROGRESS: "В процессе",
  FINISHED: "Завершён",
  CANCELLED: "Отменён",
};
