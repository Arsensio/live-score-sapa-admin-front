import { api } from "./client";
import { backendUrl } from "../config/backend";
import { isImagePath } from "../lib/validation";

export type ImageTarget = "player" | "team" | "tournament";
type ImageUploadResponse = { suffix: string; url: string };
export function imageSrc(value: string) {
  return isImagePath(value) ? `${backendUrl}${value}` : value;
}
export async function uploadImage(
  target: ImageTarget,
  file: File,
  signal?: AbortSignal,
): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const response = await api<ImageUploadResponse>(`/image/${target}`, {
    method: "POST",
    body,
    signal,
  });
  if (typeof response?.suffix === "string" && isImagePath(response.suffix))
    return response.suffix;
  throw new Error(
    "Сервер не вернул адрес загруженного изображения. Попробуйте ещё раз.",
  );
}
