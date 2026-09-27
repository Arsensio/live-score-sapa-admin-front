import { api } from "../api/client";

function readToken(value: unknown, names: string[]): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const name of names) {
    if (typeof record[name] === "string" && record[name].trim())
      return record[name] as string;
  }
  return record.data ? readToken(record.data, names) : undefined;
}

export async function csrfToken(): Promise<string> {
  const payload = await api<unknown>("/api/auth/csrf", {
    skipAuth: true,
    allowTextResponse: true,
  });
  const token = typeof payload === "string"
    ? payload.trim()
    : readToken(payload, ["token", "csrfToken", "xsrfToken"]);
  if (!token) throw new Error("Не удалось подготовить безопасное соединение.");
  return token;
}

let refreshRequest: Promise<string> | undefined;

export function refreshAccessToken(): Promise<string> {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      const csrf = await csrfToken();
      const payload = await api<unknown>("/api/auth/refresh", {
        method: "POST",
        skipAuth: true,
        headers: { "X-XSRF-TOKEN": csrf },
      });
      const token = readToken(payload, ["accessToken", "access_token", "token"]);
      if (!token) throw new Error("Сервер не вернул данные сессии.");
      return token;
    })().finally(() => {
      refreshRequest = undefined;
    });
  }
  return refreshRequest;
}
