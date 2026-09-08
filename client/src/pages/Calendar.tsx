import { ChevronLeft, ChevronRight, Clock3, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { capitalize, dateKey, formatMonthYear, formatTime, startOfMonth, studentName } from "../lib/format";
import type { Lesson, Student } from "../types";

interface CalendarProps {
  students: Student[];
  lessons: Lesson[];
  onOpenLesson: (lesson: Lesson) => void;
  onAddLesson: (date?: Date) => void;
}

const weekDayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function Calendar({ students, lessons, onOpenLesson, onAddLesson }: CalendarProps) {
  const { t, i18n } = useTranslation();
  const [month, setMonth] = useState(startOfMonth());
  const language = i18n.resolvedLanguage;
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);
  const today = dateKey(new Date());
  const studentById = (id: string) => students.find((student) => student.id === id);
  const displayName = (student?: Student) => studentName(student, t("errors.studentNotFound"));

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });

  const moveMonth = (direction: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + direction, 1));

  return (
    <section className="panel calendar-panel">
      <header className="calendar-toolbar">
        <div><p className="eyebrow">{t("calendar.monthlyPlan")}</p><h2>{capitalize(formatMonthYear(month, language))}</h2></div>
        <div className="calendar-toolbar__actions">
          <button className="button button--secondary button--small" onClick={() => setMonth(startOfMonth())}>{t("calendar.today")}</button>
          <span className="segmented-buttons">
            <button className="icon-button" onClick={() => moveMonth(-1)} aria-label={t("calendar.previousMonth")}><ChevronLeft size={19} /></button>
            <button className="icon-button" onClick={() => moveMonth(1)} aria-label={t("calendar.nextMonth")}><ChevronRight size={19} /></button>
          </span>
        </div>
      </header>

      <div className="calendar-weekdays">{weekDayKeys.map((day) => <span key={day}>{t(`calendar.weekdays.${day}`)}</span>)}</div>
      <div className="calendar-grid">
        {days.map((day) => {
          const key = dateKey(day);
          const ownLessons = lessons
            .filter((lesson) => dateKey(lesson.startsAt) === key)
            .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
          const outside = day.getMonth() !== month.getMonth();
          return (
            <div className={`calendar-day${outside ? " calendar-day--outside" : ""}${key === today ? " calendar-day--today" : ""}`} key={key}>
              <button className="calendar-day__add" onClick={() => onAddLesson(new Date(`${key}T10:00`))} aria-label={t("calendar.addLessonDate", { date: key })}><Plus size={13} /></button>
              <span className="calendar-day__number">{day.getDate()}</span>
              <div className="calendar-day__events">
                {ownLessons.slice(0, 3).map((lesson) => {
                  const student = studentById(lesson.studentId);
                  return (
                    <button
                      className={`calendar-event calendar-event--${lesson.status}${lesson.status === "completed" && !lesson.isPaid ? " calendar-event--unpaid" : ""}`}
                      style={{ "--event-color": student?.color || "#8a849b" } as React.CSSProperties}
                      key={lesson.id}
                      onClick={() => onOpenLesson(lesson)}
                    >
                      <span className="calendar-event__time"><Clock3 size={10} aria-hidden="true" /><time>{formatTime(lesson.startsAt, language)}</time></span>
                      <span className="calendar-event__details">
                        <span className="calendar-event__student">{displayName(student)}</span>
                        <span className="calendar-event__duration">{t("common.minutesShort", { count: lesson.durationMinutes })}</span>
                      </span>
                    </button>
                  );
                })}
                {ownLessons.length > 3 && <span className="calendar-day__more">{t("calendar.more", { count: ownLessons.length - 3 })}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <footer className="calendar-legend">
        <span><i className="dot dot--info" />{t("status.scheduled")}</span>
        <span><i className="dot dot--success" />{t("status.completed")}</span>
        <span><i className="dot dot--danger" />{t("status.unpaid")}</span>
        <span><i className="dot dot--neutral" />{t("status.cancelled")}</span>
      </footer>
    </section>
  );
}
