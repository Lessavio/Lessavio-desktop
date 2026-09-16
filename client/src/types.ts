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

export interface PaymentEntry {
  id: string;
  ownerId: string;
  studentId: string;
  paymentPeriodId: string;
  amount: number;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPeriod {
  id: string;
  ownerId: string;
  studentId: string;
  month: string;
  timeZone: string;
  amount: number;
  startsAt: string;
  endsAt: string;
  paidAt: string;
  payments: PaymentEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPeriodPayload {
  studentId: string;
  month: string;
  timeZone: string;
  amount: number;
}

export interface PaymentEntryPayload {
  amount: number;
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
  paymentPeriodId: string | null;
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
