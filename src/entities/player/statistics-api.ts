import { api } from "../../shared/api/client";
import type { MatchEventType } from "../match/model";

export type PlayerStatisticsEventType = MatchEventType | "ASSIST";

export type PlayerStatisticsItem = {
  playerId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  teamLogoUrl: string | null;
  count: number;
  games: number;
};

export type PlayerStatisticsPage = {
  content: PlayerStatisticsItem[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
};

export const playerStatisticsApi = {
  list: (tournamentId: string, type: PlayerStatisticsEventType, page: number, size: number, signal?: AbortSignal) =>
    api<PlayerStatisticsPage>("/api/players/statistics", {
      query: { tournamentId, type, page, size },
      signal,
    }),
};
