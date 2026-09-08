import { loadCollection, saveCollection } from "../../common/storage";
import { CreateLessonDto, Lesson, LessonFilters, UpdateLessonDto } from "./lesson.model";

function revive(value: unknown): Lesson {
  const lesson = value as Lesson;
  return {
    ...lesson,
    ownerId: typeof lesson.ownerId === "string" ? lesson.ownerId : "",
    startsAt: new Date(lesson.startsAt),
    paidAt: lesson.paidAt ? new Date(lesson.paidAt) : null,
    createdAt: new Date(lesson.createdAt),
    updatedAt: new Date(lesson.updatedAt),
  };
}

let lessons = loadCollection<Lesson>("lessons", revive);
let nextId = lessons.reduce((max, lesson) => Math.max(max, Number(lesson.id) || 0), 0) + 1;

function clone(lesson: Lesson): Lesson {
  return { ...lesson };
}

function persist(): void {
  saveCollection("lessons", lessons);
}

export const lessonRepository = {
  findAll(ownerId: string, filters: LessonFilters = {}): Lesson[] {
    return lessons
      .filter((lesson) => {
        if (lesson.ownerId !== ownerId) return false;
        if (filters.from && lesson.startsAt < filters.from) return false;
        if (filters.to && lesson.startsAt >= filters.to) return false;
        if (filters.studentId && lesson.studentId !== filters.studentId) return false;
        if (filters.status && lesson.status !== filters.status) return false;
        return true;
      })
      .map(clone)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  },

  findById(ownerId: string, id: string): Lesson | undefined {
    const lesson = lessons.find((item) => item.ownerId === ownerId && item.id === id);
    return lesson ? clone(lesson) : undefined;
  },

  hasForStudent(ownerId: string, studentId: string): boolean {
    return lessons.some((lesson) => lesson.ownerId === ownerId && lesson.studentId === studentId);
  },

  hasConflict(
    ownerId: string,
    startsAt: Date,
    durationMinutes: number,
    excludeId?: string
  ): boolean {
    const end = startsAt.getTime() + durationMinutes * 60_000;
    return lessons.some((lesson) => {
      if (
        lesson.ownerId !== ownerId ||
        lesson.id === excludeId ||
        lesson.status === "cancelled"
      ) {
        return false;
      }
      const lessonEnd = lesson.startsAt.getTime() + lesson.durationMinutes * 60_000;
      return startsAt.getTime() < lessonEnd && end > lesson.startsAt.getTime();
    });
  },

  create(ownerId: string, dto: CreateLessonDto): Lesson {
    const now = new Date();
    const lesson: Lesson = {
      id: String(nextId++),
      ownerId,
      ...dto,
      paidAt: dto.isPaid ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    lessons.push(lesson);
    persist();
    return clone(lesson);
  },

  update(ownerId: string, id: string, dto: UpdateLessonDto): Lesson | undefined {
    const index = lessons.findIndex((lesson) => lesson.ownerId === ownerId && lesson.id === id);
    if (index === -1) return undefined;
    const current = lessons[index];
    const paidAt = dto.isPaid === undefined
      ? current.paidAt
      : dto.isPaid
        ? current.paidAt ?? new Date()
        : null;
    lessons[index] = { ...current, ...dto, paidAt, updatedAt: new Date() };
    persist();
    return clone(lessons[index]);
  },

  delete(ownerId: string, id: string): boolean {
    const index = lessons.findIndex((lesson) => lesson.ownerId === ownerId && lesson.id === id);
    if (index === -1) return false;
    lessons.splice(index, 1);
    persist();
    return true;
  },

  claimOwnerless(ownerId: string): number {
    let claimed = 0;
    lessons = lessons.map((lesson) => {
      if (lesson.ownerId) return lesson;
      claimed += 1;
      return { ...lesson, ownerId };
    });
    if (claimed > 0) persist();
    return claimed;
  },
};
