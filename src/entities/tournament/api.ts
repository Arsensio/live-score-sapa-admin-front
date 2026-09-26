import { api } from "../../shared/api/client";
import type { Collection } from "../../shared/api/pagination";
import type { Tournament, TournamentInput } from "./model";
export const tournamentApi = {
  list: (name: string, page: number, size: number, signal?: AbortSignal) =>
    api<Collection<Tournament>>("/api/tournaments", {
      query: { name, page, size },
      signal,
    }),
  // These two conventional endpoints must be confirmed against the backend contract.
  get: (id: string, signal?: AbortSignal) =>
    api<Tournament>(`/api/tournaments/${encodeURIComponent(id)}`, { signal }),
  create: (body: TournamentInput) =>
    api<Tournament>("/api/tournaments", { method: "POST", body }),
  update: (id: string, body: TournamentInput) =>
    api<Tournament>(`/api/tournaments/${encodeURIComponent(id)}`, {
      method: "PUT",
      body,
    }),
};
