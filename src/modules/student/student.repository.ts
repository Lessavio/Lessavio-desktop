import { loadCollection, saveCollection } from "../../common/storage";
import { CreateStudentDto, Student, UpdateStudentDto } from "./student.model";

function revive(value: unknown): Student {
  const student = value as Student;
  return {
    ...student,
    ownerId: typeof student.ownerId === "string" ? student.ownerId : "",
    createdAt: new Date(student.createdAt),
    updatedAt: new Date(student.updatedAt),
  };
}

let students = loadCollection<Student>("students", revive);
let nextId = students.reduce((max, student) => Math.max(max, Number(student.id) || 0), 0) + 1;

function clone(student: Student): Student {
  return { ...student };
}

function persist(): void {
  saveCollection("students", students);
}

export const studentRepository = {
  findAll(ownerId: string, includeArchived = false): Student[] {
    return students
      .filter((student) => student.ownerId === ownerId && (includeArchived || !student.archived))
      .map(clone)
      .sort((a, b) => a.firstName.localeCompare(b.firstName, "ru"));
  },

  findById(ownerId: string, id: string): Student | undefined {
    const student = students.find((item) => item.ownerId === ownerId && item.id === id);
    return student ? clone(student) : undefined;
  },

  create(ownerId: string, dto: CreateStudentDto): Student {
    const now = new Date();
    const student: Student = {
      id: String(nextId++),
      ownerId,
      ...dto,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    students.push(student);
    persist();
    return clone(student);
  },

  update(ownerId: string, id: string, dto: UpdateStudentDto): Student | undefined {
    const index = students.findIndex((student) => student.ownerId === ownerId && student.id === id);
    if (index === -1) return undefined;
    students[index] = { ...students[index], ...dto, updatedAt: new Date() };
    persist();
    return clone(students[index]);
  },

  delete(ownerId: string, id: string): boolean {
    const index = students.findIndex((student) => student.ownerId === ownerId && student.id === id);
    if (index === -1) return false;
    students.splice(index, 1);
    persist();
    return true;
  },

  claimOwnerless(ownerId: string): number {
    let claimed = 0;
    students = students.map((student) => {
      if (student.ownerId) return student;
      claimed += 1;
      return { ...student, ownerId };
    });
    if (claimed > 0) persist();
    return claimed;
  },
};
