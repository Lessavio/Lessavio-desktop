import type { SupportedLanguage } from "../i18n";
import { normalizeLanguage } from "../i18n";
import type { Currency, Lesson, Student } from "../types";

const localeByLanguage: Record<SupportedLanguage, string> = {
  en: "en-US",
  uk: "uk-UA",
  ru: "ru-RU",
};

function locale(language?: string): string {
  return localeByLanguage[normalizeLanguage(language)];
}

export function formatCurrency(value: number, language: string | undefined, _currency: Currency): string {
  return new Intl.NumberFormat(locale(language), {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 0,
  }).format(value);
}

export function currencySymbol(_currency: Currency): "₴" {
  return "₴";
}

export function formatDayMonth(value: string | Date, language?: string): string {
  return new Intl.DateTimeFormat(locale(language), { day: "numeric", month: "short" }).format(new Date(value));
}

export function formatFullDate(value: string | Date, language?: string): string {
  return new Intl.DateTimeFormat(locale(language), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

export function formatMonthYear(value: string | Date, language?: string): string {
  return new Intl.DateTimeFormat(locale(language), { month: "long", year: "numeric" }).format(new Date(value));
}

export function formatTime(value: string | Date, language?: string): string {
  return new Intl.DateTimeFormat(locale(language), { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

export function studentName(student: Student | undefined, fallback = "Deleted student"): string {
  return student ? [student.firstName, student.lastName].filter(Boolean).join(" ") : fallback;
}

export function initials(student?: Student): string {
  if (!student) return "?";
  return [student.firstName, student.lastName]
    .filter(Boolean)
    .map((part) => part![0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function dateKey(value: string | Date): string {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function startOfMonth(value = new Date()): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function endOfMonth(value = new Date()): Date {
  return new Date(value.getFullYear(), value.getMonth() + 1, 1);
}

export function isInMonth(value: string, month = new Date()): boolean {
  const date = new Date(value);
  return date >= startOfMonth(month) && date < endOfMonth(month);
}

export function statusInfo(lesson: Lesson): { key: string; tone: string } {
  if (lesson.status === "cancelled") return { key: "status.cancelled", tone: "neutral" };
  if (lesson.status === "completed" && !lesson.isPaid) return { key: "status.unpaid", tone: "danger" };
  if (lesson.status === "completed") return { key: "status.completed", tone: "success" };
  return { key: "status.scheduled", tone: "info" };
}
