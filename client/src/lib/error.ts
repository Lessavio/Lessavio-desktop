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
  "Период оплаты за этот месяц уже существует": "errors.paymentPeriodDuplicate",
  "Период оплаты пересекается с существующим периодом": "errors.paymentPeriodOverlap",
  "Указан недопустимый часовой пояс": "errors.invalidTimeZone",
  "Не удалось определить границы месяца в указанном часовом поясе": "errors.invalidPaymentPeriod",
  "Поле «Сумма» должно быть числом от 0 до 1000000": "errors.invalidPaymentAmount",
  "Поле «Сумма» должно быть числом от 0.01 до 1000000": "errors.invalidPaymentAmount",
  "Поле «Сумма» должно быть числом от 0,01 до 1000000": "errors.invalidPaymentAmount",
  "Поле «Месяц» должно быть в формате YYYY-MM": "errors.invalidPaymentPeriod",
  "Период оплаты не найден": "errors.paymentPeriodNotFound",
  "Платёж не найден": "errors.paymentNotFound",
  "Нельзя удалить последний платёж. Удалите весь оплаченный месяц вместо этого": "errors.cannotDeleteLastPayment",
  "API-маршрут не найден": "errors.apiNotFound",
};

export function localizedError(error: unknown, t: TFunction, fallbackKey: string): string {
  if (!(error instanceof Error)) return t(fallbackKey);
  const translationKey = serverErrorKeys[error.message];
  return translationKey ? t(translationKey) : t(fallbackKey);
}
