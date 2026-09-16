import { ArrowUpRight, CalendarCheck2, CircleDollarSign, Clock3, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/EmptyState";
import {
  formatCurrency,
  formatDayMonth,
  formatTime,
  initials,
  isInMonth,
  statusInfo,
  studentName,
} from "../lib/format";
import type { Currency, Lesson, PaymentPeriod, Student, View } from "../types";

interface DashboardProps {
  students: Student[];
  lessons: Lesson[];
  paymentPeriods: PaymentPeriod[];
  currency: Currency;
  onOpenLesson: (lesson: Lesson) => void;
  onAddLesson: () => void;
  onViewChange: (view: View) => void;
}

export function Dashboard({ students, lessons, paymentPeriods, currency, onOpenLesson, onAddLesson, onViewChange }: DashboardProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const monthLessons = lessons.filter((lesson) => isInMonth(lesson.startsAt) && lesson.status !== "cancelled");
  const manualPaymentsThisMonth = lessons.filter((lesson) => (
    lesson.isPaid
    && !lesson.paymentPeriodId
    && lesson.paidAt
    && isInMonth(lesson.paidAt)
  ));
  const installmentPaymentsThisMonth = paymentPeriods
    .flatMap((period) => period.payments)
    .filter((payment) => isInMonth(payment.paidAt));
  const receivedPaymentCount = manualPaymentsThisMonth.length + installmentPaymentsThisMonth.length;
  const unpaid = lessons.filter((lesson) => lesson.status === "completed" && !lesson.isPaid);
  const income = manualPaymentsThisMonth.reduce((sum, lesson) => sum + lesson.price, 0)
    + installmentPaymentsThisMonth.reduce((sum, payment) => sum + payment.amount, 0);
  const debtTotal = unpaid.reduce((sum, lesson) => sum + lesson.price, 0);
  const now = Date.now();
  const upcoming = lessons
    .filter((lesson) => new Date(lesson.startsAt).getTime() >= now && lesson.status !== "cancelled")
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 6);

  const debts = unpaid.reduce<Map<string, { total: number; count: number }>>((map, lesson) => {
    const current = map.get(lesson.studentId) ?? { total: 0, count: 0 };
    current.total += lesson.price;
    current.count += 1;
    map.set(lesson.studentId, current);
    return map;
  }, new Map());

  const studentById = (id: string) => students.find((student) => student.id === id);
  const displayName = (student?: Student) => studentName(student, t("errors.studentNotFound"));
  const stats = [
    {
      label: t("dashboard.monthlyIncome"),
      value: formatCurrency(income, language, currency),
      meta: t("dashboard.receivedPayments", { count: receivedPaymentCount }),
      icon: CircleDollarSign,
      tone: "violet",
      featured: true,
    },
    {
      label: t("dashboard.awaitingPayment"),
      value: formatCurrency(debtTotal, language, currency),
      meta: unpaid.length ? `${unpaid.length} ${t("units.lesson", { count: unpaid.length })}` : t("dashboard.noDebts"),
      icon: Clock3,
      tone: "orange",
    },
    {
      label: t("dashboard.lessonsThisMonth"),
      value: String(monthLessons.length),
      meta: t("dashboard.excludingCancelled"),
      icon: CalendarCheck2,
      tone: "blue",
    },
    {
      label: t("dashboard.activeStudents"),
      value: String(students.filter((student) => !student.archived).length),
      meta: t("dashboard.inYourDatabase"),
      icon: Users,
      tone: "green",
    },
  ];

  return (
    <>
      <section className="stats-grid" aria-label={t("dashboard.mainStats")}>
        {stats.map(({ label, value, meta, icon: Icon, tone, featured }) => (
          <article className={`stat-card stat-card--${tone}${featured ? " stat-card--featured" : ""}`} key={label}>
            <span className="stat-card__icon"><Icon size={20} /></span>
            <span className="stat-card__label">{label}</span>
            <strong>{value}</strong>
            <span className="stat-card__meta">{meta}</span>
            {featured && <span className="stat-card__orb" />}
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel schedule-panel">
          <header className="panel__header">
            <div><p className="eyebrow">{t("dashboard.schedule")}</p><h2>{t("dashboard.upcomingLessons")}</h2></div>
            <button className="link-button" onClick={() => onViewChange("calendar")}>{t("dashboard.fullCalendar")} <ArrowUpRight size={15} /></button>
          </header>
          {upcoming.length ? (
            <div className="lesson-list">
              {upcoming.map((lesson) => {
                const student = studentById(lesson.studentId);
                const status = statusInfo(lesson);
                return (
                  <button className="lesson-row" key={lesson.id} onClick={() => onOpenLesson(lesson)}>
                    <time>{formatTime(lesson.startsAt, language)}</time>
                    <span className="lesson-row__line" style={{ background: student?.color }} />
                    <span className="lesson-row__person">
                      <strong>{displayName(student)}</strong>
                      <small>{formatDayMonth(lesson.startsAt, language)} · {t("common.minutesShort", { count: lesson.durationMinutes })} · {formatCurrency(lesson.price, language, currency)}</small>
                    </span>
                    <span className={`status status--${status.tone}`}>{t(status.key)}</span>
                  </button>
                );
              })}
            </div>
          ) : <EmptyState compact title={t("dashboard.scheduleClear")} description={t("dashboard.scheduleClearDescription")} action={{ label: t("layout.addLesson"), onClick: onAddLesson }} />}
        </section>

        <section className="panel debt-panel">
          <header className="panel__header"><div><p className="eyebrow">{t("dashboard.paymentTracking")}</p><h2>{t("dashboard.outstandingPayments")}</h2></div></header>
          {debts.size ? (
            <div className="debt-list">
              {[...debts.entries()].map(([studentId, debt]) => {
                const student = studentById(studentId);
                return (
                  <div className="debt-row" key={studentId}>
                    <span className="person-avatar" style={{ background: student?.color }}>{initials(student)}</span>
                    <span><strong>{displayName(student)}</strong><small>{debt.count} {t("units.lesson", { count: debt.count })}</small></span>
                    <strong className="debt-row__sum">{formatCurrency(debt.total, language, currency)}</strong>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState compact title={t("dashboard.allPaymentsReceived")} description={t("dashboard.allPaymentsDescription")} />}
        </section>
      </div>
    </>
  );
}
