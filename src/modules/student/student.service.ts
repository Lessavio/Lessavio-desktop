import { AppError } from "../../common/errors/AppError";
import {
  asObject,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requiredNumber,
  requiredString,
} from "../../common/validation";
import { CreateStudentDto, Student, UpdateStudentDto } from "./student.model";
import { studentRepository } from "./student.repository";

const DEFAULT_COLOR = "#6c5ce7";
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function validateColor(value: unknown): string {
  if (value === undefined || value === null || value === "") return DEFAULT_COLOR;
  if (typeof value !== "string" || !COLOR_PATTERN.test(value)) {
    throw new AppError("Цвет должен быть в формате #RRGGBB", 400);
  }
  return value.toLowerCase();
}

function parseCreate(input: unknown): CreateStudentDto {
  const data = asObject(input);
  return {
    firstName: requiredString(data, "firstName", "Имя", 80),
    lastName: optionalString(data, "lastName", "Фамилия", 80) ?? null,
    defaultLessonPrice: requiredNumber(data, "defaultLessonPrice", "Стоимость урока", 0, 1_000_000),
    phone: optionalString(data, "phone", "Телефон", 40) ?? null,
    notes: optionalString(data, "notes", "Заметки", 2000) ?? null,
    color: validateColor(data.color),
  };
}

function parseUpdate(input: unknown): UpdateStudentDto {
  const data = asObject(input);
  const dto: UpdateStudentDto = {};
  if ("firstName" in data) dto.firstName = requiredString(data, "firstName", "Имя", 80);
  const lastName = optionalString(data, "lastName", "Фамилия", 80);
  if (lastName !== undefined) dto.lastName = lastName;
  const price = optionalNumber(data, "defaultLessonPrice", "Стоимость урока", 0, 1_000_000);
  if (price !== undefined) dto.defaultLessonPrice = price;
  const phone = optionalString(data, "phone", "Телефон", 40);
  if (phone !== undefined) dto.phone = phone;
  const notes = optionalString(data, "notes", "Заметки", 2000);
  if (notes !== undefined) dto.notes = notes;
  if ("color" in data) dto.color = validateColor(data.color);
  const archived = optionalBoolean(data, "archived", "Архивирован");
  if (archived !== undefined) dto.archived = archived;
  if (Object.keys(dto).length === 0) throw new AppError("Не переданы поля для изменения", 400);
  return dto;
}

export const studentService = {
  getAll(ownerId: string, includeArchived = false): Promise<Student[]> {
    return studentRepository.findAll(ownerId, includeArchived);
  },

  async getById(ownerId: string, id: string): Promise<Student> {
    const student = await studentRepository.findById(ownerId, id);
    if (!student) throw new AppError("Ученик не найден", 404);
    return student;
  },

  create(ownerId: string, input: unknown): Promise<Student> {
    return studentRepository.create(ownerId, parseCreate(input));
  },

  async update(ownerId: string, id: string, input: unknown): Promise<Student> {
    await this.getById(ownerId, id);
    const student = await studentRepository.update(ownerId, id, parseUpdate(input));
    if (!student) throw new AppError("Ученик не найден", 404);
    return student;
  },

  async delete(ownerId: string, id: string): Promise<void> {
    const result = await studentRepository.deleteIfNoLessons(ownerId, id);
    if (result === "notFound") throw new AppError("Ученик не найден", 404);
    if (result === "hasLessons") {
      throw new AppError("У ученика есть история занятий. Переместите его в архив", 409);
    }
  },
};
