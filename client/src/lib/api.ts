import type {
  AuthUser,
  Lesson,
  LessonPayload,
  LoginPayload,
  PaymentEntryPayload,
  PaymentPeriod,
  PaymentPeriodPayload,
  RegisterPayload,
  Student,
  StudentPayload,
} from "../types";

interface ApiErrorBody {
  message?: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");

  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers,
  });

  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as ApiErrorBody | T | null;
  if (!response.ok) {
    throw new ApiError(response.status, (body as ApiErrorBody | null)?.message || "REQUEST_FAILED");
  }
  return body as T;
}

export const api = {
  auth: {
    register: (payload: RegisterPayload) =>
      request<AuthUser>("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
    login: (payload: LoginPayload) =>
      request<AuthUser>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
    logout: () => request<void>("/api/auth/logout", { method: "POST" }),
    me: () => request<AuthUser>("/api/auth/me"),
  },
  students: {
    list: () => request<Student[]>("/api/students?includeArchived=true"),
    create: (payload: StudentPayload) =>
      request<Student>("/api/students", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: StudentPayload) =>
      request<Student>(`/api/students/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    delete: (id: string) => request<void>(`/api/students/${id}`, { method: "DELETE" }),
  },
  lessons: {
    list: () => request<Lesson[]>("/api/lessons"),
    create: (payload: LessonPayload) =>
      request<Lesson>("/api/lessons", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: LessonPayload) =>
      request<Lesson>(`/api/lessons/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    delete: (id: string) => request<void>(`/api/lessons/${id}`, { method: "DELETE" }),
  },
  paymentPeriods: {
    list: () => request<PaymentPeriod[]>("/api/payment-periods"),
    create: (payload: PaymentPeriodPayload) =>
      request<PaymentPeriod>("/api/payment-periods", { method: "POST", body: JSON.stringify(payload) }),
    delete: (id: string) => request<void>(`/api/payment-periods/${id}`, { method: "DELETE" }),
    addPayment: (periodId: string, payload: PaymentEntryPayload) =>
      request<PaymentPeriod>(`/api/payment-periods/${periodId}/payments`, { method: "POST", body: JSON.stringify(payload) }),
    updatePayment: (periodId: string, paymentId: string, payload: PaymentEntryPayload) =>
      request<PaymentPeriod>(`/api/payment-periods/${periodId}/payments/${paymentId}`, { method: "PATCH", body: JSON.stringify(payload) }),
    deletePayment: (periodId: string, paymentId: string) =>
      request<void>(`/api/payment-periods/${periodId}/payments/${paymentId}`, { method: "DELETE" }),
  },
};
