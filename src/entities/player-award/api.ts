import { api, ApiError } from "../../shared/api/client";
import { refreshAccessToken } from "../../shared/auth/session";
import { setAccessToken } from "../../shared/auth/access-token";
import type { Page } from "../../shared/api/pagination";
import type { Player } from "../team/model";
import type { AwardPoll, AwardResults, CreateAwardInput } from "./model";

async function authorized<T>(request: () => Promise<T>): Promise<T> {
  try { return await request(); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    setAccessToken(await refreshAccessToken());
    return request();
  }
}

export const playerAwardApi = {
  list: (tournamentId: string, page: number, signal?: AbortSignal) => authorized(() =>
    api<Page<AwardPoll>>("/api/player-award-polls", { query: { tournamentId, page, size: 20, sort: "id,asc" }, signal })),
  players: (tournamentId: string, name: string, page: number, signal?: AbortSignal) => authorized(() =>
    api<Page<Player>>("/api/players", { query: { tournamentId, name: name.trim(), page, size: 20, sort: "lastName,asc" }, signal })),
  create: (body: CreateAwardInput) => authorized(() => api<AwardPoll>("/api/player-award-polls", { method: "POST", body })),
  get: (pollId: string, signal?: AbortSignal) => authorized(() => api<AwardPoll>(`/api/player-award-polls/${encodeURIComponent(pollId)}`, { signal })),
  results: (pollId: string, signal?: AbortSignal) => authorized(() => api<AwardResults>(`/api/player-award-polls/${encodeURIComponent(pollId)}/results`, { signal })),
  action: (pollId: string, action: "OPEN" | "CLOSE") => authorized(() => api<void>(`/api/player-award-polls/${encodeURIComponent(pollId)}/action`, { method: "PATCH", query: { action } })),
};

export function awardError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const messages: Record<number, string> = {
    400: "Проверьте название, количество кандидатов и выбранных игроков.",
    401: "Сессия истекла. Войдите снова.",
    403: "Недостаточно прав",
    404: "Голосование не найдено",
    409: "Состояние голосования изменилось. Данные обновлены, повторите действие при необходимости.",
  };
  return messages[error.status] ? new ApiError(error.status, messages[error.status]) : error;
}
