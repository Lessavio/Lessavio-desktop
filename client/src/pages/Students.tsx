import { CalendarClock, Phone, Plus, Search, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/EmptyState";
import { formatCurrency, formatDayMonth, formatTime, initials, studentName } from "../lib/format";
import type { Currency, Lesson, Student } from "../types";

interface StudentsProps {
  students: Student[];
  lessons: Lesson[];
  currency: Currency;
  onOpenStudent: (student: Student) => void;
  onAddStudent: () => void;
}

export function Students({ students, lessons, currency, onOpenStudent, onAddStudent }: StudentsProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const language = i18n.resolvedLanguage;
  const filtered = useMemo(() => students.filter((student) =>
    studentName(student).toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language))), [students, query, language]);

  const metrics = (studentId: string) => {
    const ownLessons = lessons.filter((lesson) => lesson.studentId === studentId);
    const completed = ownLessons.filter((lesson) => lesson.status === "completed").length;
    const debt = ownLessons
      .filter((lesson) => lesson.status === "completed" && !lesson.isPaid)
      .reduce((sum, lesson) => sum + lesson.price, 0);
    const next = ownLessons
      .filter((lesson) => lesson.status === "scheduled" && +new Date(lesson.startsAt) >= Date.now())
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
    return { completed, debt, next };
  };

  return (
    <section>
      <div className="section-toolbar">
        <div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("students.searchPlaceholder")} aria-label={t("students.searchLabel")} /></div>
        <button className="button button--primary" onClick={onAddStudent}><Plus size={18} />{t("layout.addStudent")}</button>
      </div>

      {filtered.length ? (
        <div className="student-grid">
          {filtered.map((student) => {
            const data = metrics(student.id);
            return (
              <button className={`student-card${student.archived ? " student-card--archived" : ""}`} key={student.id} onClick={() => onOpenStudent(student)} style={{ "--student-color": student.color } as React.CSSProperties}>
                <span className="student-card__accent" />
                {student.archived && <span className="student-card__archive-badge">{t("students.archiveBadge")}</span>}
                <div className="student-card__header">
                  <span className="person-avatar person-avatar--large" style={{ background: student.color }}>{initials(student)}</span>
                  <span className="student-card__identity"><strong>{studentName(student)}</strong><small><Phone size={12} />{student.archived ? t("students.archivedHint") : student.phone || t("students.phoneMissing")}</small></span>
                  <strong className="student-card__price">{formatCurrency(student.defaultLessonPrice, language, currency)}</strong>
                </div>
                <div className="student-card__metrics">
                  <span><WalletCards size={16} /><small>{t("students.debt")}</small><strong className={data.debt ? "text-danger" : ""}>{formatCurrency(data.debt, language, currency)}</strong></span>
                  <span><CalendarClock size={16} /><small>{t("students.completed")}</small><strong>{data.completed} {t("units.lesson", { count: data.completed })}</strong></span>
                </div>
                <div className="student-card__next"><span>{t("students.nextLesson")}</span><strong>{data.next ? `${formatDayMonth(data.next.startsAt, language)}, ${formatTime(data.next.startsAt, language)}` : t("students.notScheduled")}</strong></div>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={t(query ? "students.noResults" : "students.addFirst")}
          description={t(query ? "students.noResultsDescription" : "students.addFirstDescription")}
          action={query ? undefined : { label: t("layout.addStudent"), onClick: onAddStudent }}
        />
      )}
    </section>
  );
}
