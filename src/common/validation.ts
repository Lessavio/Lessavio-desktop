import { AppError } from "./errors/AppError";

export type UnknownRecord = Record<string, unknown>;

export function asObject(value: unknown): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("Тело запроса должно быть объектом", 400);
  }
  return value as UnknownRecord;
}

export function requiredString(
  data: UnknownRecord,
  key: string,
  label: string,
  maxLength = 120
): string {
  const value = data[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`Поле «${label}» обязательно`, 400);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new AppError(`Поле «${label}» не должно превышать ${maxLength} символов`, 400);
  }
  return normalized;
}

export function optionalString(
  data: UnknownRecord,
  key: string,
  label: string,
  maxLength = 500
): string | null | undefined {
  if (!(key in data)) return undefined;
  const value = data[key];
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new AppError(`Поле «${label}» должно быть строкой`, 400);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new AppError(`Поле «${label}» не должно превышать ${maxLength} символов`, 400);
  }
  return normalized || null;
}

export function requiredNumber(
  data: UnknownRecord,
  key: string,
  label: string,
  min = 0,
  max = 10_000_000
): number {
  const value = data[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new AppError(`Поле «${label}» должно быть числом от ${min} до ${max}`, 400);
  }
  return value;
}

export function optionalNumber(
  data: UnknownRecord,
  key: string,
  label: string,
  min = 0,
  max = 10_000_000
): number | undefined {
  if (!(key in data)) return undefined;
  return requiredNumber(data, key, label, min, max);
}

export function optionalBoolean(
  data: UnknownRecord,
  key: string,
  label: string
): boolean | undefined {
  if (!(key in data)) return undefined;
  if (typeof data[key] !== "boolean") {
    throw new AppError(`Поле «${label}» должно быть true или false`, 400);
  }
  return data[key] as boolean;
}

export function optionalEnum<T extends string>(
  data: UnknownRecord,
  key: string,
  label: string,
  values: readonly T[]
): T | undefined {
  if (!(key in data)) return undefined;
  const value = data[key];
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new AppError(`Недопустимое значение поля «${label}»`, 400);
  }
  return value as T;
}

export function isoDate(value: unknown, label: string): Date {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`Поле «${label}» обязательно`, 400);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/.exec(value);
  if (!match) {
    throw new AppError(`Поле «${label}» должно содержать дату в формате ISO`, 400);
  }
  const date = new Date(value);
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const isExact = !Number.isNaN(date.getTime())
    && date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === second;
  if (!isExact) {
    throw new AppError(`Поле «${label}» должно содержать корректную дату`, 400);
  }
  return date;
}
