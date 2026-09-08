export const LESSON_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export interface Lesson {
  id: string;
  ownerId: string;
  studentId: string;
  startsAt: Date;
  durationMinutes: number;
  price: number;
  status: LessonStatus;
  isPaid: boolean;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLessonDto {
  studentId: string;
  startsAt: Date;
  durationMinutes: number;
  price: number;
  status: LessonStatus;
  isPaid: boolean;
  notes: string | null;
}

export type UpdateLessonDto = Partial<CreateLessonDto>;

export interface LessonFilters {
  from?: Date;
  to?: Date;
  studentId?: string;
  status?: LessonStatus;
}
