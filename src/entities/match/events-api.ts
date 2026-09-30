import { api } from "../../shared/api/client";
import type { MatchEvent, MatchEventType } from "./model";

export type MatchEventInput = {
  matchId: string;
  teamId: string;
  playerId: string | null;
  assistPlayerId?: string | null;
  type: MatchEventType;
  minute: number | null;
};

export const matchEventApi = {
  delete: (eventId: string) =>
    api<void>(`/api/events/${encodeURIComponent(eventId)}`, { method: "DELETE" }),
  create: (body: MatchEventInput) =>
    api<MatchEvent>("/api/events", { method: "POST", body }),
  update: (eventId: string, body: MatchEventInput) =>
    api<MatchEvent>(`/api/events/${encodeURIComponent(eventId)}`, {
      method: "PUT",
      body,
    }),
};
