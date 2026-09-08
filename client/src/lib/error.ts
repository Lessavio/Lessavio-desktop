import type { TFunction } from "i18next";

const serverErrorKeys: Record<string, string> = {
  REQUEST_FAILED: "errors.requestFailed",
  "Ученик не найден": "errors.studentNotFound",
  "Активный ученик не найден": "errors.activeStudentNotFound",
  "Урок не найден": "errors.lessonNotFound",
  "На это время уже запланирован другой урок": "errors.lessonOverlap",
  "У ученика есть история занятий. Переместите его в архив": "errors.studentHasHistory",
  "Не переданы поля для изменения": "errors.noFields",
  "Тело запроса должно быть объектом": "errors.invalidBody",
  "API-маршрут не найден": "errors.apiNotFound",
};

export function localizedError(error: unknown, t: TFunction, fallbackKey: string): string {
  if (!(error instanceof Error)) return t(fallbackKey);
  const translationKey = serverErrorKeys[error.message];
  return translationKey ? t(translationKey) : t(fallbackKey);
}
