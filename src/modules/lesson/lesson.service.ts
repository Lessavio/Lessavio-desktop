import { AppError } from "../../common/errors/AppError";
import {
  asObject,
  isoDate,
  optionalBoolean,
  optionalEnum,
  optionalNumber,
  optionalString,
  requiredNumber,
  requiredString,
} from "../../common/validation";
import { studentRepository } from "../student/student.repository";
import {
  CreateLessonDto,
  CreateLessonSeriesDto,
  Lesson,
  LessonFilters,
  LESSON_STATUSES,
  LessonSeriesRecurrence,
  UpdateLessonDto,
} from "./lesson.model";
import { lessonRepository } from "./lesson.repository";

function duration(value: number): number {
  if (!Number.isInteger(value)) {
    throw new AppError("Продолжительность должна быть целым числом минут", 400);
  }
  return value;
}

async function ensureStudent(ownerId: string, studentId: string, allowArchived = false) {
  const student = await studentRepository.findById(ownerId, studentId);
  if (!student || (student.archived && !allowArchived)) {
    throw new AppError("Активный ученик не найден", 404);
  }
  return student;
}

async function parseCreate(ownerId: string, input: unknown): Promise<CreateLessonDto> {
  const data = asObject(input);
  const studentId = requiredString(data, "studentId", "Ученик", 40);
  const student = await ensureStudent(ownerId, studentId);
  const durationMinutes = duration(requiredNumber(data, "durationMinutes", "Продолжительность", 15, 480));
  return {
    studentId,
    startsAt: isoDate(data.startsAt, "Дата и время"),
    durationMinutes,
    price: optionalNumber(data, "price", "Стоимость", 0, 1_000_000) ?? student.defaultLessonPrice,
    status: optionalEnum(data, "status", "Статус", LESSON_STATUSES) ?? "scheduled",
    isPaid: optionalBoolean(data, "isPaid", "Оплачен") ?? false,
    notes: optionalString(data, "notes", "Заметки", 2000) ?? null,
  };
}

function requireExactKeys(
  data: Record<string, unknown>,
  keys: readonly string[],
  label: string
): void {
  const allowed = new Set(keys);
  if (
    Object.keys(data).some((key) => !allowed.has(key))
    || keys.some((key) => !(key in data))
  ) {
    throw new AppError(`${label} должен содержать только обязательные поля: ${keys.join(", ")}`, 400);
  }
}

interface CalendarDate {
  value: string;
  date: Date;
}

function parseCalendarDate(value: unknown, label: string): CalendarDate {
  if (typeof value !== "string") {
    throw new AppError(`Поле «${label}» должно быть датой в формате YYYY-MM-DD`, 400);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new AppError(`Поле «${label}» должно быть датой в формате YYYY-MM-DD`, 400);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    throw new AppError(`Поле «${label}» должно содержать корректную дату`, 400);
  }
  return { value, date };
}

function parseRecurrence(value: unknown): LessonSeriesRecurrence {
  const data = asObject(value);
  const commonKeys = [
    "startDate",
    "localTime",
    "timeZone",
    "weekdays",
    "intervalWeeks",
    "endMode",
  ] as const;
  if (data.endMode === "date") {
    requireExactKeys(data, [...commonKeys, "endDate"], "Объект «recurrence»");
  } else if (data.endMode === "count") {
    requireExactKeys(data, [...commonKeys, "occurrenceCount"], "Объект «recurrence»");
  } else {
    throw new AppError("Поле «endMode» должно иметь значение «date» или «count»", 400);
  }

  const startDate = parseCalendarDate(data.startDate, "startDate");
  if (typeof data.localTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.localTime)) {
    throw new AppError("Поле «localTime» должно содержать время в формате HH:mm", 400);
  }
  if (typeof data.timeZone !== "string" || !data.timeZone) {
    throw new AppError("Поле «timeZone» обязательно", 400);
  }
  const timeZone = data.timeZone;
  const ianaName = timeZone === "UTC"
    || /^(?:[A-Za-z._+-]+\/)+[A-Za-z0-9._+-]+$/.test(timeZone);
  if (!ianaName) {
    throw new AppError("Поле «timeZone» должно содержать корректный IANA time zone", 400);
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
  } catch {
    throw new AppError("Поле «timeZone» должно содержать корректный IANA time zone", 400);
  }
  if (!Array.isArray(data.weekdays) || data.weekdays.length === 0) {
    throw new AppError("Поле «weekdays» должно быть непустым массивом", 400);
  }
  if (data.weekdays.some((weekday) => !Number.isInteger(weekday) || weekday < 1 || weekday > 7)) {
    throw new AppError("Элементы поля «weekdays» должны быть целыми числами от 1 до 7", 400);
  }
  const weekdays = data.weekdays as number[];
  if (new Set(weekdays).size !== weekdays.length) {
    throw new AppError("Элементы поля «weekdays» должны быть уникальными", 400);
  }
  if (data.intervalWeeks !== 1 && data.intervalWeeks !== 2) {
    throw new AppError("Поле «intervalWeeks» должно иметь значение 1 или 2", 400);
  }

  const intervalWeeks: 1 | 2 = data.intervalWeeks;
  const base = {
    startDate: startDate.value,
    localTime: data.localTime,
    timeZone: data.timeZone,
    weekdays,
    intervalWeeks,
  };
  if (data.endMode === "date") {
    const endDate = parseCalendarDate(data.endDate, "endDate");
    if (endDate.date.getTime() < startDate.date.getTime()) {
      throw new AppError("Поле «endDate» не может быть раньше «startDate»", 400);
    }
    return { ...base, endMode: "date", endDate: endDate.value };
  }
  if (
    !Number.isInteger(data.occurrenceCount)
    || (data.occurrenceCount as number) < 1
    || (data.occurrenceCount as number) > 100
  ) {
    throw new AppError("Поле «occurrenceCount» должно быть целым числом от 1 до 100", 400);
  }
  return {
    ...base,
    endMode: "count",
    occurrenceCount: data.occurrenceCount as number,
  };
}

function isoWeekday(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function calendarDateString(date: Date): string {
  const year = date.getUTCFullYear();
  if (year < 0 || year > 9999) {
    throw new AppError("Правило повторения выходит за пределы поддерживаемого календаря", 400);
  }
  return `${String(year).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

interface ExpectedOccurrence {
  date: string;
  weekday: number;
}

function expectedOccurrences(recurrence: LessonSeriesRecurrence): ExpectedOccurrence[] {
  const startDate = parseCalendarDate(recurrence.startDate, "startDate").date;
  const monday = addCalendarDays(startDate, -(isoWeekday(startDate) - 1));
  const weekdays = [...recurrence.weekdays].sort((left, right) => left - right);
  const endDate = recurrence.endMode === "date"
    ? parseCalendarDate(recurrence.endDate, "endDate").date
    : undefined;
  const expected: ExpectedOccurrence[] = [];

  for (let weekIndex = 0; ; weekIndex += recurrence.intervalWeeks) {
    const weekStart = addCalendarDays(monday, weekIndex * 7);
    if (endDate && weekStart.getTime() > endDate.getTime()) break;
    for (const weekday of weekdays) {
      const candidate = addCalendarDays(weekStart, weekday - 1);
      if (candidate.getTime() < startDate.getTime()) continue;
      if (endDate && candidate.getTime() > endDate.getTime()) continue;
      expected.push({ date: calendarDateString(candidate), weekday });
      if (expected.length > 100) {
        throw new AppError("Правило повторения создаёт больше 100 уроков", 400);
      }
      if (
        recurrence.endMode === "count"
        && expected.length === recurrence.occurrenceCount
      ) {
        return expected;
      }
    }
  }
  return expected;
}

interface LocalDateTime {
  date: string;
  weekday: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

const WEEKDAY_BY_NAME: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function localDateTime(formatter: Intl.DateTimeFormat, date: Date): LocalDateTime {
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    date: `${String(Number(parts.year)).padStart(4, "0")}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_BY_NAME[parts.weekday],
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    millisecond: date.getUTCMilliseconds(),
  };
}

function validateSeriesSchedule(
  value: unknown,
  recurrence: LessonSeriesRecurrence
): Date[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    throw new AppError("Поле «occurrenceStartsAt» должно быть массивом от 1 до 100 дат", 400);
  }
  const expected = expectedOccurrences(recurrence);
  if (value.length !== expected.length) {
    throw new AppError("Поле «occurrenceStartsAt» содержит пропущенные или лишние даты", 400);
  }
  const dates = value.map((item, index) => isoDate(item, `occurrenceStartsAt[${index}]`));
  const timestamps = dates.map((date) => date.getTime());
  if (new Set(timestamps).size !== timestamps.length) {
    throw new AppError("Даты начала уроков должны быть уникальными", 400);
  }
  if (timestamps.some((timestamp, index) => index > 0 && timestamp <= timestamps[index - 1])) {
    throw new AppError("Даты начала уроков должны быть строго отсортированы по возрастанию", 400);
  }

  const formatter = new Intl.DateTimeFormat("en-US-u-ca-iso8601-nu-latn", {
    timeZone: recurrence.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const [expectedHour, expectedMinute] = recurrence.localTime.split(":").map(Number);
  dates.forEach((date, index) => {
    const local = localDateTime(formatter, date);
    const expectedOccurrence = expected[index];
    if (
      local.date !== expectedOccurrence.date
      || local.weekday !== expectedOccurrence.weekday
      || local.hour !== expectedHour
      || local.minute !== expectedMinute
      || local.second !== 0
      || local.millisecond !== 0
    ) {
      throw new AppError(
        `Дата occurrenceStartsAt[${index}] не соответствует правилу повторения`,
        400
      );
    }
  });
  return dates;
}

function parseSeriesLesson(value: unknown): CreateLessonSeriesDto["lesson"] {
  const data = asObject(value);
  const keys = [
    "studentId",
    "durationMinutes",
    "price",
    "status",
    "isPaid",
    "notes",
  ] as const;
  requireExactKeys(data, keys, "Объект «lesson»");
  if (data.status !== "scheduled") {
    throw new AppError("Поле «status» должно иметь значение «scheduled»", 400);
  }
  if (data.isPaid !== false) {
    throw new AppError("Поле «isPaid» должно иметь значение false", 400);
  }
  const notes = optionalString(data, "notes", "Заметки", 2000);
  return {
    studentId: requiredString(data, "studentId", "Ученик", 40),
    durationMinutes: duration(
      requiredNumber(data, "durationMinutes", "Продолжительность", 15, 480)
    ),
    price: requiredNumber(data, "price", "Стоимость", 0, 1_000_000),
    status: "scheduled",
    isPaid: false,
    notes: notes ?? null,
  };
}

function parseCreateSeries(input: unknown): CreateLessonSeriesDto {
  const data = asObject(input);
  requireExactKeys(
    data,
    ["lesson", "recurrence", "occurrenceStartsAt"],
    "Запрос серии"
  );
  const recurrence = parseRecurrence(data.recurrence);
  return {
    lesson: parseSeriesLesson(data.lesson),
    recurrence,
    occurrenceStartsAt: validateSeriesSchedule(data.occurrenceStartsAt, recurrence),
  };
}

function parseUpdate(input: unknown): UpdateLessonDto {
  const data = asObject(input);
  const dto: UpdateLessonDto = {};
  if ("studentId" in data) dto.studentId = requiredString(data, "studentId", "Ученик", 40);
  if ("startsAt" in data) dto.startsAt = isoDate(data.startsAt, "Дата и время");
  const durationMinutes = optionalNumber(data, "durationMinutes", "Продолжительность", 15, 480);
  if (durationMinutes !== undefined) dto.durationMinutes = duration(durationMinutes);
  const price = optionalNumber(data, "price", "Стоимость", 0, 1_000_000);
  if (price !== undefined) dto.price = price;
  const status = optionalEnum(data, "status", "Статус", LESSON_STATUSES);
  if (status !== undefined) dto.status = status;
  const isPaid = optionalBoolean(data, "isPaid", "Оплачен");
  if (isPaid !== undefined) dto.isPaid = isPaid;
  const notes = optionalString(data, "notes", "Заметки", 2000);
  if (notes !== undefined) dto.notes = notes;
  if (Object.keys(dto).length === 0) throw new AppError("Не переданы поля для изменения", 400);
  return dto;
}

function parseFilterDate(value: unknown, label: string): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new AppError(`Некорректный параметр «${label}»`, 400);
  return isoDate(value, label);
}

export const lessonService = {
  getAll(ownerId: string, query: Record<string, unknown> = {}): Promise<Lesson[]> {
    const filters: LessonFilters = {
      from: parseFilterDate(query.from, "from"),
      to: parseFilterDate(query.to, "to"),
      studentId: typeof query.studentId === "string" ? query.studentId : undefined,
      status: query.status
        ? optionalEnum({ status: query.status }, "status", "Статус", LESSON_STATUSES)
        : undefined,
    };
    return lessonRepository.findAll(ownerId, filters);
  },

  async getById(ownerId: string, id: string): Promise<Lesson> {
    const lesson = await lessonRepository.findById(ownerId, id);
    if (!lesson) throw new AppError("Урок не найден", 404);
    return lesson;
  },

  async create(ownerId: string, input: unknown): Promise<Lesson> {
    const dto = await parseCreate(ownerId, input);
    const lesson = await lessonRepository.create(ownerId, dto);
    if (!lesson) {
      throw new AppError("На это время уже запланирован другой урок", 409);
    }
    return lesson;
  },

  async createSeries(ownerId: string, input: unknown): Promise<Lesson[]> {
    const dto = parseCreateSeries(input);
    const result = await lessonRepository.createMany(
      ownerId,
      dto.lesson,
      dto.occurrenceStartsAt
    );
    if (!result.studentActive) throw new AppError("Активный ученик не найден", 400);
    if (result.conflict) {
      throw new AppError("На это время уже запланирован другой урок", 409);
    }
    return result.lessons;
  },

  async update(ownerId: string, id: string, input: unknown): Promise<Lesson> {
    const current = await this.getById(ownerId, id);
    const dto = parseUpdate(input);
    const studentId = dto.studentId ?? current.studentId;
    await ensureStudent(ownerId, studentId, studentId === current.studentId);
    const result = await lessonRepository.update(ownerId, id, dto);
    if (result.conflict) {
      throw new AppError("На это время уже запланирован другой урок", 409);
    }
    if (!result.lesson) throw new AppError("Урок не найден", 404);
    return result.lesson;
  },

  async delete(ownerId: string, id: string): Promise<void> {
    await this.getById(ownerId, id);
    await lessonRepository.delete(ownerId, id);
  },
};
