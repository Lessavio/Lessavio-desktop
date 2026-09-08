export type View = "dashboard" | "calendar" | "students" | "profile";
export type Theme = "light" | "dark";
export type Currency = "UAH";
export type LessonStatus = "scheduled" | "completed" | "cancelled";

export interface Student {
  id: string;
  firstName: string;
  lastName: string | null;
  defaultLessonPrice: number;
  phone: string | null;
  notes: string | null;
  color: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentPayload {
  firstName: string;
  lastName: string | null;
  defaultLessonPrice: number;
  phone: string | null;
  notes: string | null;
  color: string;
  archived?: boolean;
}

export interface Lesson {
  id: string;
  studentId: string;
  startsAt: string;
  durationMinutes: number;
  price: number;
  status: LessonStatus;
  isPaid: boolean;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LessonPayload {
  studentId: string;
  startsAt: string;
  durationMinutes: number;
  price: number;
  status: LessonStatus;
  isPaid: boolean;
  notes: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
