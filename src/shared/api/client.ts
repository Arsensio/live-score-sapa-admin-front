import { apiBaseUrl } from "../config/backend";
import { getAccessToken } from "../auth/access-token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  allowTextResponse?: boolean;
};
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const url = new URL(`${apiBaseUrl}${path}`, window.location.origin);
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "")
      url.searchParams.set(key, String(value));
  });
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      signal: options.signal,
      credentials: "include",
      cache: path.startsWith("/api/auth/") ? "no-store" : undefined,
      headers: {
        Accept: "application/json",
        ...(!options.skipAuth && getAccessToken()
          ? { Authorization: `Bearer ${getAccessToken()}` }
          : {}),
        ...options.headers,
        ...(options.body === undefined || options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        options.body === undefined
          ? undefined
          : options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      0,
      "Не удалось подключиться к серверу. Проверьте соединение и адрес backend.",
    );
  }
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = options.allowTextResponse ? text : undefined;
  }
  if (!response.ok) {
    const defaults: Record<number, string> = {
      400: "Проверьте введённые данные.",
      401: "Необходима авторизация на сервере.",
      403: "Недостаточно прав для выполнения операции.",
      404: "Запрашиваемые данные не найдены.",
      409: "Конфликт данных. Возможно, команда уже назначена в группу.",
      413: "Изображение слишком большое. Выберите файл меньшего размера.",
      415: "Сервер не поддерживает этот формат изображения.",
      422: "Сервер отклонил данные. Проверьте поля формы.",
    };
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : (defaults[response.status] ?? "Ошибка сервера. Попробуйте ещё раз.");
    throw new ApiError(response.status, message, payload);
  }
  if (text && payload === undefined)
    throw new ApiError(
      response.status,
      "Сервер вернул ответ не в формате JSON. Проверьте адрес API.",
    );
  return payload as T;
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Произошла неизвестная ошибка.";
}
