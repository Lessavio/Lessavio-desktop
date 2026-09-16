import type { TFunction } from "i18next";

const serverErrorKeys: Record<string, string> = {
  REQUEST_FAILED: "errors.requestFailed",
  LESSON_SERIES_INVALID: "errors.invalidLessonSeries",
  LESSON_SERIES_OVERLAP: "errors.lessonSeriesOverlap",
  LESSON_SERIES_TOO_MANY: "errors.lessonSeriesTooMany",
  INVALID_LESSON_SERIES: "errors.invalidLessonSeries",
  INVALID_RECURRENCE: "errors.invalidLessonSeries",
  INVALID_STARTS_AT: "errors.invalidLessonSeriesDates",
  INVALID_OCCURRENCE_STARTS_AT: "errors.invalidLessonSeriesDates",
  TOO_MANY_LESSONS: "errors.lessonSeriesTooMany",
  TOO_MANY_OCCURRENCES: "errors.lessonSeriesTooMany",
  "Ученик не найден": "errors.studentNotFound",
  "Активный ученик не найден": "errors.activeStudentNotFound",
  "Урок не найден": "errors.lessonNotFound",
  "На это время уже запланирован другой урок": "errors.lessonOverlap",
  "Поле «Урок» должно быть объектом": "errors.invalidLessonSeries",
  "Объект «Урок» содержит недопустимые поля": "errors.invalidLessonSeries",
  "Поле «Повторение» должно быть объектом": "errors.invalidLessonSeries",
  "Объект «Повторение» содержит недопустимые поля": "errors.invalidLessonSeries",
  "Запрос серии содержит недопустимые поля": "errors.invalidLessonSeries",
  "Поле «Дата начала» должно быть в формате YYYY-MM-DD": "errors.invalidLessonSeriesDates",
  "Поле «Локальное время» должно быть в формате HH:mm": "errors.invalidLessonSeriesDates",
  "Поле «Дни недели» должно быть непустым массивом": "errors.invalidLessonSeries",
  "Дни недели должны быть уникальными целыми числами от 1 до 7": "errors.invalidLessonSeries",
  "Поле «Интервал в неделях» должно иметь значение 1 или 2": "errors.lessonSeriesInterval",
  "Поле «Режим окончания» должно иметь значение «date» или «count»": "errors.invalidLessonSeries",
  "Для режима окончания «date» обязательна дата окончания": "errors.invalidLessonSeriesDates",
  "Для режима окончания «count» обязательно количество уроков": "errors.lessonSeriesCount",
  "Поле «Количество уроков» должно быть целым числом от 1 до 100": "errors.lessonSeriesCount",
  "Диапазон дат создаёт больше 100 уроков": "errors.lessonSeriesTooMany",
  "Поле «Часовой пояс» обязательно": "errors.invalidTimeZone",
  "Поле «Часовой пояс» должно содержать корректный IANA time zone": "errors.invalidTimeZone",
  "Поле «timeZone» обязательно": "errors.invalidTimeZone",
  "Поле «timeZone» должно содержать корректный IANA time zone": "errors.invalidTimeZone",
  "Поле «intervalWeeks» должно иметь значение 1 или 2": "errors.lessonSeriesInterval",
  "Поле «occurrenceCount» должно быть целым числом от 1 до 100": "errors.lessonSeriesCount",
  "Поле «occurrenceStartsAt» должно быть массивом от 1 до 100 дат": "errors.invalidLessonSeriesDates",
  "Поле «occurrenceStartsAt» содержит пропущенные или лишние даты": "errors.invalidLessonSeriesDates",
  "Даты начала уроков должны быть строго отсортированы по возрастанию": "errors.invalidLessonSeriesDates",
  "Правило повторения создаёт больше 100 уроков": "errors.lessonSeriesTooMany",
  "Поле «Даты начала вхождений» должно быть массивом": "errors.invalidLessonSeriesDates",
  "Количество дат начала вхождений должно совпадать с серией": "errors.invalidLessonSeriesDates",
  "Даты начала вхождений должны быть уникальными": "errors.invalidLessonSeriesDates",
  "Даты начала вхождений должны быть отсортированы по возрастанию": "errors.invalidLessonSeriesDates",
  "Поле «Даты начала» должно быть массивом": "errors.invalidLessonSeriesDates",
  "Количество дат начала должно совпадать с количеством уроков": "errors.invalidLessonSeriesDates",
  "Даты начала уроков должны быть уникальными": "errors.invalidLessonSeriesDates",
  "Даты начала уроков должны быть отсортированы по возрастанию": "errors.invalidLessonSeriesDates",
  "Один или несколько уроков серии пересекаются с существующими уроками": "errors.lessonSeriesOverlap",
  "Серия уроков пересекается с существующими уроками": "errors.lessonSeriesOverlap",
  "Некорректные параметры серии уроков": "errors.invalidLessonSeries",
  "Даты серии уроков не соответствуют правилу повторения": "errors.invalidLessonSeriesDates",
  "Количество уроков в серии должно быть от 2 до 100": "errors.lessonSeriesCount",
  "Интервал повторения должен быть от 1 до 52 недель": "errors.lessonSeriesInterval",
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
  if (fallbackKey === "errors.saveLessonSeriesFailed" && error.message === "На это время уже запланирован другой урок") {
    return t("errors.lessonSeriesOverlap");
  }
  const translationKey = serverErrorKeys[error.message];
  if (translationKey) return t(translationKey);
  const normalized = error.message.toLowerCase();
  if (normalized.includes("больше 100") || normalized.includes("more than 100") || normalized.includes("too many")) {
    return t("errors.lessonSeriesTooMany");
  }
  if (normalized.includes("дата и время №") || normalized.includes("даты начала вхождений")
    || normalized.includes("occurrencestartsat") || normalized.includes("не соответствует правилу повторения")) {
    return t("errors.invalidLessonSeriesDates");
  }
  if ((normalized.includes("сер") || normalized.includes("series")) && normalized.includes("перес")) {
    return t("errors.lessonSeriesOverlap");
  }
  if (normalized.includes("series") || normalized.includes("recurrence") || normalized.includes("сер")) {
    return t("errors.invalidLessonSeries");
  }
  return t(fallbackKey);
}
