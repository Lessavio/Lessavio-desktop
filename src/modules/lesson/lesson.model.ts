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
  paymentPeriodId: string | null;
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

interface LessonSeriesRecurrenceBase {
  startDate: string;
  localTime: string;
  timeZone: string;
  weekdays: number[];
  intervalWeeks: 1 | 2;
}

export type LessonSeriesRecurrence = LessonSeriesRecurrenceBase & (
  | {
    endMode: "date";
    endDate: string;
    occurrenceCount?: never;
  }
  | {
    endMode: "count";
    occurrenceCount: number;
    endDate?: never;
  }
);

export interface CreateLessonSeriesLessonDto {
  studentId: string;
  durationMinutes: number;
  price: number;
  status: "scheduled";
  isPaid: false;
  notes: string | null;
}

export interface CreateLessonSeriesDto {
  lesson: CreateLessonSeriesLessonDto;
  recurrence: LessonSeriesRecurrence;
  occurrenceStartsAt: Date[];
}

export interface CreateLessonSeriesResult {
  lessons: Lesson[];
  studentActive: boolean;
  conflict: boolean;
}

export interface LessonFilters {
  from?: Date;
  to?: Date;
  studentId?: string;
  status?: LessonStatus;
}
