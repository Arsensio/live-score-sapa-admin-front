import { api } from "../../shared/api/client";
import { allPages, type Collection } from "../../shared/api/pagination";
import type { Team, TeamInput } from "./model";
export const teamApi = {
  get: (id: string, signal?: AbortSignal) =>
    api<Team>(`/api/teams/${encodeURIComponent(id)}`, { signal }),
  update: (id: string, body: TeamInput) =>
    api<Team>(`/api/teams/${encodeURIComponent(id)}`, { method: "PUT", body }),
  list: (tournamentId: string, signal?: AbortSignal) =>
    allPages((page) =>
      api<Collection<Team>>("/api/teams", {
        query: { tournamentId, page, size: 100 },
        signal,
      }),
    ),
  create: (body: TeamInput) =>
    api<Team>("/api/teams", { method: "POST", body }),
  inGroup: (groupId: string, signal?: AbortSignal) =>
    allPages((page) =>
      api<Collection<Team>>(
        `/api/teams/admin/groups/${encodeURIComponent(groupId)}`,
        { query: { page, size: 100 }, signal },
      ),
    ),
};
