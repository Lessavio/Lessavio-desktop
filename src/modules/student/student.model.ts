export interface Student {
  id: string;
  ownerId: string;
  firstName: string;
  lastName: string | null;
  defaultLessonPrice: number;
  phone: string | null;
  notes: string | null;
  color: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStudentDto {
  firstName: string;
  lastName: string | null;
  defaultLessonPrice: number;
  phone: string | null;
  notes: string | null;
  color: string;
}

export type UpdateStudentDto = Partial<Omit<CreateStudentDto, "firstName">> & {
  firstName?: string;
  archived?: boolean;
};
