import type { TournamentInput } from "../../entities/tournament/model";
import { validImageUrl, type Errors } from "../../shared/lib/validation";
export function validateTournament(values: TournamentInput): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = "Введите название турнира.";
  if (!Number.isInteger(values.maxTeams) || values.maxTeams < 2)
    errors.maxTeams = "Укажите целое число, не меньше 2.";
  if (!values.startDate) errors.startDate = "Укажите дату начала.";
  if (!values.endDate) errors.endDate = "Укажите дату окончания.";
  if (values.startDate && values.endDate && values.endDate < values.startDate)
    errors.endDate = "Дата окончания не может быть раньше начала.";
  if (!validImageUrl(values.logoUrl))
    errors.logoUrl =
      "Не удалось использовать логотип. Загрузите изображение повторно.";
  return errors;
}
