export type Errors = Record<string, string>;
export function isImagePath(value: string) {
  return /^\/image\/(player|team|tournament)\/[^/\s?#]+$/.test(value);
}
export function validImageUrl(value: string) {
  return isImagePath(value) || validUrl(value);
}
export function validUrl(value: string) {
  if (!value.trim()) return true;
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
