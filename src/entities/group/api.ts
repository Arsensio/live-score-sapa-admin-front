import { api } from "../../shared/api/client";
import { allPages, type Collection } from "../../shared/api/pagination";
import type { Group, GroupStatus, GroupWithStatistics } from "./model";
export const groupApi = {
  finish: (groupId: string) =>
    api<Group>(`/api/groups/${encodeURIComponent(groupId)}/finish`, {
      method: "PATCH",
    }),
  standings: (tournamentId: string, signal?: AbortSignal) =>
    api<GroupWithStatistics[]>("/api/groups", {
      query: { tournamentId },
      signal,
    }),
  list: (tournamentId: string, status?: GroupStatus, signal?: AbortSignal) =>
    allPages((page) =>
      api<Collection<GroupWithStatistics>>("/api/groups/filter", {
        query: { tournamentId, status, page, size: 100 },
        signal,
      }),
    ),
  reset: (groupId: string) =>
    api<void>(`/api/draw/groups/${encodeURIComponent(groupId)}/teams`, {
      method: "DELETE",
    }),
};
