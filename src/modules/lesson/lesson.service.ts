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
  Lesson,
  LessonFilters,
  LESSON_STATUSES,
  LessonStatus,
  UpdateLessonDto,
} from "./lesson.model";
import { lessonRepository } from "./lesson.repository";

function duration(value: number): number {
  if (!Number.isInteger(value)) {
    throw new AppError("Продолжительность должна быть целым числом минут", 400);
  }
  return value;
}

function ensureStudent(ownerId: string, studentId: string, allowArchived = false) {
  const student = studentRepository.findById(ownerId, studentId);
  if (!student || (student.archived && !allowArchived)) {
    throw new AppError("Активный ученик не найден", 404);
  }
  return student;
}

function parseCreate(ownerId: string, input: unknown): CreateLessonDto {
  const data = asObject(input);
  const studentId = requiredString(data, "studentId", "Ученик", 40);
  const student = ensureStudent(ownerId, studentId);
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
  getAll(ownerId: string, query: Record<string, unknown> = {}): Lesson[] {
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

  getById(ownerId: string, id: string): Lesson {
    const lesson = lessonRepository.findById(ownerId, id);
    if (!lesson) throw new AppError("Урок не найден", 404);
    return lesson;
  },

  create(ownerId: string, input: unknown): Lesson {
    const dto = parseCreate(ownerId, input);
    if (
      dto.status !== "cancelled" &&
      lessonRepository.hasConflict(ownerId, dto.startsAt, dto.durationMinutes)
    ) {
      throw new AppError("На это время уже запланирован другой урок", 409);
    }
    return lessonRepository.create(ownerId, dto);
  },

  update(ownerId: string, id: string, input: unknown): Lesson {
    const current = this.getById(ownerId, id);
    const dto = parseUpdate(input);
    const studentId = dto.studentId ?? current.studentId;
    ensureStudent(ownerId, studentId, studentId === current.studentId);
    const candidate = {
      startsAt: dto.startsAt ?? current.startsAt,
      durationMinutes: dto.durationMinutes ?? current.durationMinutes,
      status: (dto.status ?? current.status) as LessonStatus,
    };
    if (
      candidate.status !== "cancelled" &&
      lessonRepository.hasConflict(ownerId, candidate.startsAt, candidate.durationMinutes, id)
    ) {
      throw new AppError("На это время уже запланирован другой урок", 409);
    }
    return lessonRepository.update(ownerId, id, dto) as Lesson;
  },

  delete(ownerId: string, id: string): void {
    this.getById(ownerId, id);
    lessonRepository.delete(ownerId, id);
  },
};
