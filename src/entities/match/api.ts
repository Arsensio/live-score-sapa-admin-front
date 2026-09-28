import { api } from "../../shared/api/client";
import type { CreateMatchInput, Match, MatchGroupsPage, MatchPage, MatchStatus } from "./model";

export const matchApi = {
  byId: (matchId: string, signal?: AbortSignal) =>
    api<Match>(`/api/matches/${encodeURIComponent(matchId)}`, { signal }),
  byGroup: (groupId: string, status?: MatchStatus, signal?: AbortSignal) =>
    api<MatchPage>(`/api/matches/groups/${encodeURIComponent(groupId)}`, {
      query: { status, page: 0, size: 20 },
      signal,
    }),
  byTournament: (tournamentId: string, status?: MatchStatus, page = 0, size = 20, signal?: AbortSignal) =>
    api<MatchGroupsPage>(`/api/matches/tournaments/${encodeURIComponent(tournamentId)}`, {
      query: { status, page, size },
      signal,
    }),
  create: (body: CreateMatchInput) =>
    api<Match>("/api/matches", { method: "POST", body }),
  start: (matchId: string) =>
    api<void>(`/api/matches/${encodeURIComponent(matchId)}/action`, {
      method: "PATCH",
      query: { action: "START" },
    }),
  finish: (matchId: string) =>
    api<void>(`/api/matches/${encodeURIComponent(matchId)}/action`, {
      method: "PATCH",
      query: { action: "FINISH" },
    }),
};
