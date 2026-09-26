import { validImageUrl, type Errors } from "../../shared/lib/validation";
export type PlayerForm = {
  key: string;
  firstName: string;
  lastName: string;
  shirtNumber: string;
  photoUrl: string;
};
export type TeamForm = {
  name: string;
  shortName: string;
  logoUrl: string;
  players: PlayerForm[];
};
export function validateTeam(values: TeamForm): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = "Введите название команды.";
  if (values.shortName.trim().length > 50)
    errors.shortName = "Максимум 50 символов.";
  if (!validImageUrl(values.logoUrl))
    errors.logoUrl =
      "Не удалось использовать логотип. Загрузите изображение повторно.";
  values.players.forEach((p, index) => {
    if (!p.firstName.trim())
      errors[`firstName-${index}`] = "Введите имя игрока.";
    else if (p.firstName.trim().length > 100)
      errors[`firstName-${index}`] = "Имя — максимум 100 символов.";
    if (!p.lastName.trim())
      errors[`lastName-${index}`] = "Введите фамилию игрока.";
    else if (p.lastName.trim().length > 100)
      errors[`lastName-${index}`] = "Фамилия — максимум 100 символов.";
    if (
      p.shirtNumber.trim() &&
      (!Number.isSafeInteger(Number(p.shirtNumber)) ||
        Number(p.shirtNumber) <= 0)
    )
      errors[`shirtNumber-${index}`] = "Укажите целый положительный номер.";
    if (!validImageUrl(p.photoUrl))
      errors[`photoUrl-${index}`] =
        "Не удалось использовать фото. Загрузите изображение повторно.";
  });
  return errors;
}
