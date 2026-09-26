export type Page<T> = {
  content: T[];
  totalPages?: number;
  totalElements?: number;
  number?: number;
  last?: boolean;
  page?: { totalPages: number; totalElements: number; number: number };
};
export type Collection<T> = T[] | Page<T>;
export function items<T>(data: Collection<T>): T[] {
  return Array.isArray(data) ? data : data.content;
}
export async function allPages<T>(
  load: (page: number) => Promise<Collection<T>>,
): Promise<T[]> {
  const result: T[] = [];
  for (let page = 0; page < 1000; page++) {
    const data = await load(page);
    const rows = items(data);
    result.push(...rows);
    if (Array.isArray(data)) return result;
    const pages = data.totalPages ?? data.page?.totalPages;
    if (
      data.last === true ||
      (pages !== undefined && page + 1 >= pages) ||
      !rows.length
    )
      return result;
    if (pages === undefined && data.last === undefined)
      throw new Error(
        "Ответ списка не содержит метаданные пагинации. Невозможно гарантировать загрузку всех команд.",
      );
  }
  throw new Error("Превышен лимит загрузки страниц.");
}
