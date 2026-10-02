import { api } from "../../shared/api/client";

export type MatchPollLeader = { userId: string; guessedCount: number };

export const matchPollApi = {
  leaderboard: (tournamentId?: string, signal?: AbortSignal) =>
    api<MatchPollLeader[]>("/api/match-polls/leaderboard", { query: { tournamentId }, signal }),
};
