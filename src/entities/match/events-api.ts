import { api } from "../../shared/api/client";
import type { MatchEvent, MatchEventType } from "./model";

export type MatchEventInput = {
  matchId: string;
  teamId: string;
  playerId: string | null;
  assistPlayerId?: string;
  type: MatchEventType;
  minute: number;
};

export const matchEventApi = {
  create: (body: MatchEventInput) =>
    api<MatchEvent>("/api/events", { method: "POST", body }),
  update: (eventId: string, body: MatchEventInput) =>
    api<MatchEvent>(`/api/events/${encodeURIComponent(eventId)}`, {
      method: "PUT",
      body,
    }),
};
