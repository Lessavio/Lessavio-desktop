import { Banknote, CalendarDays, Clock3, Minus, Plus, Trash2, UserRound, WalletCards, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { currencySymbol, dateKey, formatCurrency, studentName } from "../lib/format";
import type { Currency, Lesson, LessonPayload, LessonSeriesPayload, LessonStatus, PaymentEntry, PaymentEntryPayload, PaymentPeriod, PaymentPeriodPayload, Student, StudentPayload } from "../types";

interface ModalProps {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
  size?: "default" | "wide";
}

function Modal({ title, eyebrow, children, onClose, size = "default" }: ModalProps) {
  const { t } = useTranslation();
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={size === "wide" ? "modal modal--wide" : "modal"} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal__header">
          <div><p className="eyebrow">{eyebrow}</p><h2 id="modal-title">{title}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("common.close")}><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function currentLocalMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function paymentPeriodPayload(studentId: string, month: string, amount: number): PaymentPeriodPayload {
  return {
    studentId,
    month,
    amount,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function formatPaymentMonth(month: string, locale: string | undefined): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })
    .format(new Date(year, monthNumber - 1, 1));
}

function paymentAmount(value: string): number | null {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount >= 0.01 && amount <= 1_000_000 ? amount : null;
}

interface StudentEditorProps {
  student?: Student;
  lessons: Lesson[];
  periods: PaymentPeriod[];
  currency: Currency;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: StudentPayload) => Promise<void>;
  onDelete: () => Promise<void>;
  onCreatePaymentPeriod: (payload: PaymentPeriodPayload) => Promise<void>;
  onAddPayment: (periodId: string, payload: PaymentEntryPayload) => Promise<boolean>;
  onUpdatePayment: (periodId: string, paymentId: string, payload: PaymentEntryPayload) => Promise<boolean>;
  onDeletePayment: (periodId: string, paymentId: string) => Promise<boolean>;
  onDeletePaymentPeriod: (id: string) => Promise<void>;
}

export function StudentEditor({
  student,
  lessons,
  periods,
  currency,
  busy,
  onClose,
  onSave,
  onDelete,
  onCreatePaymentPeriod,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onDeletePaymentPeriod,
}: StudentEditorProps) {
  const { t, i18n } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState(currentLocalMonth);
  const [newPaymentAmount, setNewPaymentAmount] = useState(String(student?.defaultLessonPrice ?? ""));
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [form, setForm] = useState({
    firstName: student?.firstName || "",
    lastName: student?.lastName || "",
    defaultLessonPrice: String(student?.defaultLessonPrice ?? ""),
    phone: student?.phone || "",
    notes: student?.notes || "",
    color: student?.color || "#6254d9",
    archived: student?.archived || false,
  });
  const sortedPeriods = [...periods].sort((left, right) => right.month.localeCompare(left.month));
  const selectedPeriod = periods.find((period) => period.month === selectedMonth);
  const newAmount = paymentAmount(newPaymentAmount);
  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSave({
      firstName: form.firstName,
      lastName: form.lastName || null,
      defaultLessonPrice: Number(form.defaultLessonPrice),
      phone: form.phone || null,
      notes: form.notes || null,
      color: form.color,
      ...(student ? { archived: form.archived } : {}),
    });
  };

  const remove = async () => {
    if (window.confirm(t("studentForm.deleteConfirm"))) await onDelete();
  };

  const recordPayment = async () => {
    if (!student || !selectedMonth || newAmount === null) return;
    if (selectedPeriod) {
      await onAddPayment(selectedPeriod.id, { amount: newAmount });
    } else {
      await onCreatePaymentPeriod(paymentPeriodPayload(student.id, selectedMonth, newAmount));
    }
  };

  const beginPaymentEdit = (payment: PaymentEntry) => {
    setEditingPaymentId(payment.id);
    setEditingAmount(String(payment.amount));
  };

  const savePaymentEdit = async (periodId: string, paymentId: string) => {
    const amount = paymentAmount(editingAmount);
    if (amount === null) return;
    if (await onUpdatePayment(periodId, paymentId, { amount })) setEditingPaymentId(null);
  };

  const removePayment = async (period: PaymentPeriod, payment: PaymentEntry) => {
    const amount = formatCurrency(payment.amount, i18n.resolvedLanguage, currency);
    const date = dateFormatter.format(new Date(payment.paidAt));
    if (window.confirm(t("studentForm.paymentDeleteConfirm", { amount, date }))) {
      await onDeletePayment(period.id, payment.id);
    }
  };

  const removePeriod = async (period: PaymentPeriod) => {
    const month = formatPaymentMonth(period.month, i18n.resolvedLanguage);
    if (window.confirm(t("studentForm.paymentPeriodDeleteConfirm", { month }))) await onDeletePaymentPeriod(period.id);
  };

  return (
    <Modal title={t(student ? "studentForm.editTitle" : "studentForm.newTitle")} eyebrow={t("studentForm.eyebrow")} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-section-title"><UserRound size={17} /><span>{t("studentForm.mainInfo")}</span></div>
        <div className="form-grid form-grid--two">
          <label className="field"><span>{t("studentForm.firstName")}</span><input autoFocus required maxLength={80} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder={t("studentForm.firstNamePlaceholder")} /></label>
          <label className="field"><span>{t("studentForm.lastName")}</span><input maxLength={80} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder={t("studentForm.lastNamePlaceholder")} /></label>
        </div>
        <div className="form-grid form-grid--two">
          <label className="field"><span>{t("studentForm.lessonPrice")}</span><div className="input-addon"><input required type="number" min="0" max="1000000" value={form.defaultLessonPrice} onChange={(event) => setForm({ ...form, defaultLessonPrice: event.target.value })} placeholder="1500" /><span>{currencySymbol(currency)}</span></div></label>
          <label className="field"><span>{t("studentForm.phone")}</span><input type="tel" maxLength={40} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder={t("studentForm.phonePlaceholder")} /></label>
        </div>
        <label className="field"><span>{t("studentForm.calendarColor")}</span><div className="color-picker"><input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /><span style={{ background: form.color }} /><strong>{form.color.toUpperCase()}</strong></div></label>
        <label className="field"><span>{t("studentForm.notes")}</span><textarea rows={3} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={t("studentForm.notesPlaceholder")} /></label>
        {student && (
          <section className="payment-periods" aria-labelledby="payment-periods-title" aria-busy={busy}>
            <div className="form-section-title"><WalletCards size={17} /><span id="payment-periods-title">{t("studentForm.monthlyPayments")}</span></div>
            <p className="payment-periods__intro">{t("studentForm.monthlyPaymentsDescription")}</p>
            <div className="payment-periods__add">
              <label className="field"><span>{t("studentForm.paymentMonth")}</span><input type="month" value={selectedMonth} disabled={busy} onChange={(event) => setSelectedMonth(event.target.value)} /></label>
              <label className="field"><span>{t("studentForm.paymentAmount")}</span><div className="input-addon"><input type="text" inputMode="decimal" value={newPaymentAmount} disabled={busy} aria-invalid={newPaymentAmount !== "" && newAmount === null} onChange={(event) => setNewPaymentAmount(event.target.value)} /><span>{currencySymbol(currency)}</span></div></label>
              <button className="button button--primary button--small" type="button" disabled={busy || !selectedMonth || newAmount === null} onClick={() => void recordPayment()}><Plus size={15} />{t(selectedPeriod ? "studentForm.addPayment" : "studentForm.recordPayment")}</button>
            </div>
            <small className="payment-periods__hint">{t("studentForm.paymentAmountHint")}</small>
            <small className="payment-periods__timezone">{t("studentForm.paymentTimeZone", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</small>
            {sortedPeriods.length > 0 ? (
              <ul className="payment-periods__list">
                {sortedPeriods.map((period) => {
                  const payments = [...period.payments].sort((left, right) => right.paidAt.localeCompare(left.paidAt));
                  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
                  const month = formatPaymentMonth(period.month, i18n.resolvedLanguage);
                  const linkedLessons = lessons.filter((lesson) => lesson.paymentPeriodId === period.id);
                  const linkedTotal = linkedLessons.reduce((sum, lesson) => sum + lesson.price, 0);
                  const remaining = Math.max(total - linkedTotal, 0);
                  return (
                    <li className="payment-period" key={period.id}>
                      <header className="payment-period__header">
                        <span><strong>{month}</strong><small>{t("studentForm.paymentTotal", { total: formatCurrency(total, i18n.resolvedLanguage, currency) })} · {period.timeZone}</small></span>
                        <button className="icon-button payment-periods__delete" type="button" disabled={busy} onClick={() => void removePeriod(period)} aria-label={t("studentForm.deletePaymentPeriodForMonth", { month })}><Trash2 size={16} /></button>
                      </header>
                      <div className="payment-period__coverage">
                        <span>{t("studentForm.linkedLessons", { count: linkedLessons.length })}</span>
                        <span>{t("studentForm.linkedPrice", { total: formatCurrency(linkedTotal, i18n.resolvedLanguage, currency) })}</span>
                        <span>{t("studentForm.remainingBalance", { remaining: formatCurrency(remaining, i18n.resolvedLanguage, currency) })}</span>
                      </div>
                      <p className="payment-period__history-title">{t("studentForm.paymentHistory")}</p>
                      <ul className="payment-period__history" aria-label={t("studentForm.paymentHistoryForMonth", { month })}>
                        {payments.map((payment) => {
                          const editing = editingPaymentId === payment.id;
                          const formattedDate = dateFormatter.format(new Date(payment.paidAt));
                          const validEditingAmount = paymentAmount(editingAmount);
                          return (
                            <li className="payment-entry" key={payment.id}>
                              <span className="payment-entry__date">{formattedDate}</span>
                              {editing ? (
                                <div className="payment-entry__edit">
                                  <div className="input-addon"><input autoFocus type="text" inputMode="decimal" value={editingAmount} disabled={busy} aria-label={t("studentForm.paymentEditAmount")} aria-invalid={editingAmount !== "" && validEditingAmount === null} onChange={(event) => setEditingAmount(event.target.value)} /><span>{currencySymbol(currency)}</span></div>
                                  <button className="button button--primary button--small" type="button" disabled={busy || validEditingAmount === null} onClick={() => void savePaymentEdit(period.id, payment.id)}>{t("common.save")}</button>
                                  <button className="button button--secondary button--small" type="button" disabled={busy} onClick={() => setEditingPaymentId(null)}>{t("common.cancel")}</button>
                                </div>
                              ) : (
                                <>
                                  <strong className="payment-entry__amount">{formatCurrency(payment.amount, i18n.resolvedLanguage, currency)}</strong>
                                  <div className="payment-entry__actions">
                                    <button className="button button--secondary button--small" type="button" disabled={busy} onClick={() => beginPaymentEdit(payment)}>{t("common.edit")}</button>
                                    <button className="icon-button payment-periods__delete" type="button" disabled={busy} onClick={() => void removePayment(period, payment)} aria-label={t("studentForm.deletePayment", { amount: formatCurrency(payment.amount, i18n.resolvedLanguage, currency), date: formattedDate })}><Trash2 size={15} /></button>
                                  </div>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="payment-periods__empty">{t("studentForm.noPaymentPeriods")}</p>}
          </section>
        )}
        {student && (
          <label className="switch-row"><span><strong>{t("studentForm.moveToArchive")}</strong><small>{t("studentForm.archiveDescription")}</small></span><input type="checkbox" checked={form.archived} onChange={(event) => setForm({ ...form, archived: event.target.checked })} /></label>
        )}
        <footer className="modal__actions">
          {student && <button className="button button--danger button--small" disabled={busy} type="button" onClick={remove}><Trash2 size={15} />{t("common.delete")}</button>}
          <span className="spacer" />
          <button className="button button--secondary" disabled={busy} type="button" onClick={onClose}>{t("common.cancel")}</button>
          <button className="button button--primary" disabled={busy} type="submit">{t(busy ? "common.saving" : "common.save")}</button>
        </footer>
      </form>
    </Modal>
  );
}

interface LessonEditorProps {
  lesson?: Lesson;
  presetDate?: Date;
  students: Student[];
  lessons: Lesson[];
  periods: PaymentPeriod[];
  currency: Currency;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: LessonPayload) => Promise<void>;
  onSaveSeries: (payload: LessonSeriesPayload) => Promise<void>;
  onDelete: () => Promise<void>;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const FIVE_MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
const QUICK_TIMES = ["09:00", "12:00", "15:00", "18:00"];
const DURATION_PRESETS = [30, 45, 60, 90, 120];
const WEEKDAYS = [
  { value: 1, key: "mon" },
  { value: 2, key: "tue" },
  { value: 3, key: "wed" },
  { value: 4, key: "thu" },
  { value: 5, key: "fri" },
  { value: 6, key: "sat" },
  { value: 7, key: "sun" },
] as const;
const SERIES_PREVIEW_LIMIT = 6;

interface GeneratedOccurrence {
  date: Date;
  iso: string;
}

interface RecurrenceGeneration {
  occurrences: GeneratedOccurrence[];
  invalidWallTime: boolean;
  tooMany: boolean;
}

function isoWeekday(value: Date): number {
  return value.getDay() || 7;
}

function parseCalendarDate(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(`${value}T12:00`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
    ? parsed
    : null;
}

function generateRecurrence(
  startDate: string,
  localTimeValue: string,
  weekdays: number[],
  intervalWeeksValue: number,
  endMode: "date" | "count",
  endDate: string,
  occurrenceCount: number,
): RecurrenceGeneration {
  const start = parseCalendarDate(startDate);
  const end = endMode === "date" ? parseCalendarDate(endDate) : null;
  if (!start || weekdays.length === 0 || ![1, 2].includes(intervalWeeksValue)
    || (endMode === "date" && (!end || endDate < startDate))
    || (endMode === "count" && (!Number.isInteger(occurrenceCount) || occurrenceCount < 1 || occurrenceCount > 100))) {
    return { occurrences: [], invalidWallTime: false, tooMany: false };
  }

  const monday = new Date(start);
  monday.setDate(monday.getDate() - (isoWeekday(start) - 1));
  const sortedWeekdays = [...weekdays].sort((left, right) => left - right);
  const occurrences: GeneratedOccurrence[] = [];
  let invalidWallTime = false;

  for (let weekIndex = 0; ; weekIndex += 1) {
    const weekMonday = new Date(monday);
    weekMonday.setDate(monday.getDate() + weekIndex * intervalWeeksValue * 7);
    if (endMode === "date" && dateKey(weekMonday) > endDate) break;

    for (const weekday of sortedWeekdays) {
      const calendarDate = new Date(weekMonday);
      calendarDate.setDate(weekMonday.getDate() + weekday - 1);
      const candidateDate = dateKey(calendarDate);
      if (candidateDate < startDate || (endMode === "date" && candidateDate > endDate)) continue;

      const [year, month, day] = candidateDate.split("-").map(Number);
      const [hour, minute] = localTimeValue.split(":").map(Number);
      const startsAt = new Date(`${candidateDate}T${localTimeValue}`);
      if (startsAt.getFullYear() !== year
        || startsAt.getMonth() !== month - 1
        || startsAt.getDate() !== day
        || startsAt.getHours() !== hour
        || startsAt.getMinutes() !== minute) {
        invalidWallTime = true;
      }
      occurrences.push({ date: startsAt, iso: startsAt.toISOString() });

      if (endMode === "date" && occurrences.length > 100) {
        return { occurrences, invalidWallTime, tooMany: true };
      }
      if (endMode === "count" && occurrences.length === occurrenceCount) {
        return { occurrences, invalidWallTime, tooMany: false };
      }
    }
  }

  return { occurrences, invalidWallTime, tooMany: false };
}

function roundTime(value: Date): Date {
  const date = new Date(value);
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() <= 30 ? 30 : 60);
  return date;
}

function localTime(value: Date): string {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function shiftTime(value: string, difference: number): string {
  const [hours, minutes] = value.split(":").map(Number);
  const current = (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  const shifted = (current + difference + 24 * 60) % (24 * 60);
  return `${String(Math.floor(shifted / 60)).padStart(2, "0")}:${String(shifted % 60).padStart(2, "0")}`;
}

function clampDuration(value: string | number): string {
  const parsed = Number(value);
  const normalized = Number.isFinite(parsed) ? Math.round(parsed) : 15;
  return String(Math.min(480, Math.max(15, normalized)));
}

export function LessonEditor({ lesson, presetDate, students, lessons, periods, currency, busy, onClose, onSave, onSaveSeries, onDelete }: LessonEditorProps) {
  const { t, i18n } = useTranslation();
  const initialDate = lesson ? new Date(lesson.startsAt) : roundTime(presetDate || new Date());
  const initialStudent = students.find((student) => student.id === lesson?.studentId)
    || students.find((student) => !student.archived);
  const [form, setForm] = useState({
    studentId: lesson?.studentId || initialStudent?.id || "",
    date: dateKey(initialDate),
    time: localTime(initialDate),
    durationMinutes: String(lesson?.durationMinutes ?? 60),
    price: String(lesson?.price ?? initialStudent?.defaultLessonPrice ?? ""),
    status: (lesson?.status || "scheduled") as LessonStatus,
    manualPaid: Boolean(lesson?.isPaid && !lesson.paymentPeriodId),
    notes: lesson?.notes || "",
  });
  const [recurring, setRecurring] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([isoWeekday(initialDate)]);
  const [intervalWeeks, setIntervalWeeks] = useState<"1" | "2">("1");
  const [endMode, setEndMode] = useState<"date" | "count">("count");
  const [seriesEndDate, setSeriesEndDate] = useState(dateKey(initialDate));
  const [seriesCount, setSeriesCount] = useState("4");

  const seriesMode = !lesson && recurring;
  const [selectedHour = "00", selectedMinute = "00"] = form.time.split(":");
  const minuteOptions = Array.from(new Set([...FIVE_MINUTE_OPTIONS, selectedMinute]))
    .sort((left, right) => Number(left) - Number(right));
  const baseStart = new Date(`${form.date}T${form.time}`);
  const lessonStartsAt = baseStart.getTime();
  const parsedDuration = Number(form.durationMinutes);
  const parsedInterval = Number(intervalWeeks);
  const parsedCount = Number(seriesCount);
  const parsedPrice = Number(form.price);
  const baseWallTimeValid = baseStart.getFullYear() === Number(form.date.slice(0, 4))
    && baseStart.getMonth() === Number(form.date.slice(5, 7)) - 1
    && baseStart.getDate() === Number(form.date.slice(8, 10))
    && baseStart.getHours() === Number(selectedHour)
    && baseStart.getMinutes() === Number(selectedMinute);
  const priceValid = form.price.trim() !== ""
    && Number.isFinite(parsedPrice)
    && parsedPrice >= 0
    && parsedPrice <= 1_000_000;
  const commonValid = Boolean(form.studentId) && Number.isFinite(lessonStartsAt) && baseWallTimeValid
    && Number.isInteger(parsedDuration) && parsedDuration >= 15 && parsedDuration <= 480
    && (form.price.trim() === "" || priceValid);
  const endDateValid = endMode === "count"
    || (Boolean(parseCalendarDate(seriesEndDate)) && seriesEndDate >= form.date);
  const recurrenceValid = selectedWeekdays.length > 0
    && (parsedInterval === 1 || parsedInterval === 2)
    && endDateValid
    && (endMode === "date" || (Number.isInteger(parsedCount) && parsedCount >= 1 && parsedCount <= 100));
  const recurrence = seriesMode
    ? generateRecurrence(form.date, form.time, selectedWeekdays, parsedInterval, endMode, seriesEndDate, parsedCount)
    : { occurrences: [], invalidWallTime: false, tooMany: false };
  const generatedStarts = recurrence.occurrences;
  const conflictingStarts = generatedStarts.filter((candidate) => {
    const candidateStart = candidate.date.getTime();
    const candidateEnd = candidateStart + parsedDuration * 60_000;
    return Number.isFinite(candidateEnd) && lessons.some((existing) => {
      if (existing.status === "cancelled") return false;
      const existingStart = new Date(existing.startsAt).getTime();
      const existingEnd = existingStart + existing.durationMinutes * 60_000;
      return candidateStart < existingEnd && candidateEnd > existingStart;
    });
  });
  const seriesInvalid = seriesMode && (!commonValid || !priceValid || !recurrenceValid
    || recurrence.invalidWallTime || recurrence.tooMany || generatedStarts.length === 0
    || (endMode === "count" && generatedStarts.length !== parsedCount));
  const seriesConflict = seriesMode && conflictingStarts.length > 0;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const previewFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: "medium", timeStyle: "short" });
  const previewStarts = generatedStarts.slice(0, SERIES_PREVIEW_LIMIT);
  const previewRemaining = Math.max(generatedStarts.length - previewStarts.length, 0);

  const toggleWeekday = (weekday: number) => {
    setSelectedWeekdays((current) => current.includes(weekday)
      ? current.filter((value) => value !== weekday)
      : [...current, weekday].sort((left, right) => left - right));
  };

  const coveringPeriod = form.status === "cancelled" || !Number.isFinite(lessonStartsAt) ? undefined : periods.find((period) => (
    period.studentId === form.studentId
    && lessonStartsAt >= new Date(period.startsAt).getTime()
    && lessonStartsAt < new Date(period.endsAt).getTime()
  ));
  const linkedPeriod = lesson?.paymentPeriodId
    ? periods.find((period) => period.id === lesson.paymentPeriodId)
    : undefined;
  const remainsInLinkedPeriod = Boolean(linkedPeriod)
    && form.status !== "cancelled"
    && form.studentId === linkedPeriod?.studentId
    && Number.isFinite(lessonStartsAt)
    && lessonStartsAt >= new Date(linkedPeriod!.startsAt).getTime()
    && lessonStartsAt < new Date(linkedPeriod!.endsAt).getTime();
  const automaticPayment = !form.manualPaid && remainsInLinkedPeriod ? linkedPeriod : undefined;
  const coverageHint = !lesson && !form.manualPaid && coveringPeriod
    ? t("lessonForm.coverageAfterSave")
    : t("lessonForm.paidDescription");
  const effectiveIsPaid = Boolean(automaticPayment) || form.manualPaid;

  const selectStudent = (id: string) => {
    const student = students.find((item) => item.id === id);
    setForm((current) => ({ ...current, studentId: id, price: lesson ? current.price : String(student?.defaultLessonPrice ?? "") }));
  };

  const setTimePart = (hour: string, minute: string) => {
    setForm((current) => ({ ...current, time: `${hour}:${minute}` }));
  };

  const adjustTime = (difference: number) => {
    setForm((current) => ({ ...current, time: shiftTime(current.time, difference) }));
  };

  const adjustDuration = (difference: number) => {
    setForm((current) => ({
      ...current,
      durationMinutes: clampDuration(Number(clampDuration(current.durationMinutes)) + difference),
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (seriesMode) {
      if (seriesInvalid || seriesConflict) return;
      await onSaveSeries({
        lesson: {
          studentId: form.studentId,
          durationMinutes: parsedDuration,
          price: parsedPrice,
          status: "scheduled",
          isPaid: false,
          notes: form.notes || null,
        },
        recurrence: endMode === "date"
          ? {
            startDate: form.date,
            localTime: form.time,
            timeZone,
            weekdays: [...selectedWeekdays].sort((left, right) => left - right),
            intervalWeeks: parsedInterval as 1 | 2,
            endMode: "date",
            endDate: seriesEndDate,
          }
          : {
            startDate: form.date,
            localTime: form.time,
            timeZone,
            weekdays: [...selectedWeekdays].sort((left, right) => left - right),
            intervalWeeks: parsedInterval as 1 | 2,
            endMode: "count",
            occurrenceCount: parsedCount,
          },
        occurrenceStartsAt: generatedStarts.map((start) => start.iso),
      });
      return;
    }
    await onSave({
      studentId: form.studentId,
      startsAt: baseStart.toISOString(),
      durationMinutes: parsedDuration,
      price: parsedPrice,
      status: form.status,
      isPaid: form.manualPaid,
      notes: form.notes || null,
    });
  };

  const remove = async () => {
    if (window.confirm(t("lessonForm.deleteConfirm"))) await onDelete();
  };

  return (
    <Modal title={t(lesson ? "lessonForm.editTitle" : "lessonForm.newTitle")} eyebrow={t("lessonForm.eyebrow")} onClose={onClose} size="wide">
      <form className="lesson-editor" onSubmit={submit}>
        <section className="editor-section editor-section--schedule" aria-labelledby="lesson-schedule-section-title">
          <div className="form-section-title"><UserRound size={17} /><span id="lesson-schedule-section-title">{t("lessonForm.studentSection")} · {t("lessonForm.dateTime")}</span></div>
          <div className="lesson-overview-grid">
            <label className="field lesson-student-field"><span>{t("lessonForm.student")}</span><select required value={form.studentId} onChange={(event) => selectStudent(event.target.value)}><option value="">{t("lessonForm.selectStudent")}</option>{students.filter((student) => !student.archived || student.id === lesson?.studentId).map((student) => <option key={student.id} value={student.id}>{studentName(student)}{student.archived ? t("lessonForm.archivedSuffix") : ""}</option>)}</select></label>
            <label className="field lesson-date-field"><span>{t(seriesMode ? "lessonForm.startDate" : "lessonForm.date")}</span><input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
            <div className="field lesson-time-field">
              <span><Clock3 size={13} />{t("lessonForm.time")}</span>
              <div className="time-picker" role="group" aria-label={t("lessonForm.time")}>
                <div className="time-picker__controls">
                  <button className="picker-step" type="button" onClick={() => adjustTime(-5)} aria-label={t("lessonForm.earlier")}><Minus size={17} /></button>
                  <label className="time-picker__select"><span>{t("lessonForm.hour")}</span><select required aria-label={t("lessonForm.hour")} value={selectedHour} onChange={(event) => setTimePart(event.target.value, selectedMinute)}>{HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}</select></label>
                  <span className="time-picker__separator" aria-hidden="true">:</span>
                  <label className="time-picker__select"><span>{t("lessonForm.minute")}</span><select required aria-label={t("lessonForm.minute")} value={selectedMinute} onChange={(event) => setTimePart(selectedHour, event.target.value)}>{minuteOptions.map((minute) => <option key={minute} value={minute}>{minute}</option>)}</select></label>
                  <button className="picker-step" type="button" onClick={() => adjustTime(5)} aria-label={t("lessonForm.later")}><Plus size={17} /></button>
                </div>
                <div className="time-picker__quick" role="group" aria-label={t("lessonForm.quickTime")}>
                  <span>{t("lessonForm.quickTime")}</span>
                  <div>{QUICK_TIMES.map((time) => <button className={form.time === time ? "preset-chip preset-chip--active" : "preset-chip"} type="button" aria-pressed={form.time === time} key={time} onClick={() => setForm((current) => ({ ...current, time }))}>{time}</button>)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {!lesson && (
          <section className="recurrence-card" aria-labelledby="lesson-recurrence-section-title">
            <label className="switch-row"><span><strong id="lesson-recurrence-section-title">{t("lessonForm.regularLesson")}</strong><small>{t("lessonForm.regularLessonDescription")}</small></span><input type="checkbox" checked={recurring} disabled={busy} onChange={(event) => setRecurring(event.target.checked)} /></label>
            {seriesMode && (
              <div className="recurrence-body">
                <div className="recurrence-config">
                  <fieldset className="weekday-selector">
                    <legend>{t("lessonForm.weekdays")}</legend>
                    <div role="group" aria-label={t("lessonForm.weekdays")}>
                      {WEEKDAYS.map((weekday) => (
                        <button
                          className={selectedWeekdays.includes(weekday.value) ? "weekday-chip weekday-chip--active" : "weekday-chip"}
                          type="button"
                          aria-pressed={selectedWeekdays.includes(weekday.value)}
                          key={weekday.value}
                          onClick={() => toggleWeekday(weekday.value)}
                        >
                          {t(`calendar.weekdays.${weekday.key}`)}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="recurrence-controls">
                    <label className="field"><span>{t("lessonForm.interval")}</span><select required value={intervalWeeks} onChange={(event) => setIntervalWeeks(event.target.value as "1" | "2")}><option value="1">{t("lessonForm.everyWeek")}</option><option value="2">{t("lessonForm.everyTwoWeeks")}</option></select></label>
                    <label className="field"><span>{t("lessonForm.endMode")}</span><select required value={endMode} onChange={(event) => setEndMode(event.target.value as "date" | "count")}><option value="date">{t("lessonForm.endOnDate")}</option><option value="count">{t("lessonForm.endAfterCount")}</option></select></label>
                  </div>
                  {endMode === "date" ? (
                    <label className="field recurrence-end-field"><span>{t("lessonForm.endDate")}</span><input required type="date" min={form.date} value={seriesEndDate} onChange={(event) => setSeriesEndDate(event.target.value)} /><small>{t("lessonForm.endDateInclusive")}</small></label>
                  ) : (
                    <label className="field recurrence-end-field"><span>{t("lessonForm.occurrenceCount")}</span><input required type="number" min="1" max="100" step="1" value={seriesCount} onChange={(event) => setSeriesCount(event.target.value)} /></label>
                  )}
                  <p className="recurrence-meta">{t("lessonForm.seriesModeHint", { timeZone })}</p>
                  {selectedWeekdays.length === 0 && <p className="recurrence-error" role="alert">{t("lessonForm.weekdaysRequired")}</p>}
                  {recurrence.tooMany && <p className="recurrence-error" role="alert">{t("lessonForm.seriesTooMany")}</p>}
                  {recurrence.invalidWallTime && <p className="recurrence-error" role="alert">{t("lessonForm.invalidLocalTime")}</p>}
                  {seriesInvalid && selectedWeekdays.length > 0 && !recurrence.tooMany && !recurrence.invalidWallTime && <p className="recurrence-error" role="alert">{t("errors.invalidLessonSeries")}</p>}
                </div>
                <aside className="recurrence-results">
                  {!seriesInvalid && seriesConflict && (
                    <div className="recurrence-warning" role="alert">
                      <strong>{t("lessonForm.seriesConflict", { count: conflictingStarts.length })}</strong>
                      <ul>{conflictingStarts.map((start) => <li key={start.iso}>{previewFormatter.format(start.date)}</li>)}</ul>
                    </div>
                  )}
                  {!seriesInvalid && generatedStarts.length > 0 && (
                    <div className="recurrence-preview-block">
                      <div className="form-section-title"><CalendarDays size={15} /><span>{t("lessonForm.seriesPreview", { count: generatedStarts.length })}</span></div>
                      <ol className="recurrence-preview">{previewStarts.map((start) => <li key={start.iso}>{previewFormatter.format(start.date)}</li>)}</ol>
                      <p className="recurrence-preview__meta">{previewRemaining > 0 ? t("lessonForm.previewRemaining", { count: previewRemaining }) : t("lessonForm.previewComplete")} · {t("lessonForm.previewTimeZone", { timeZone })}</p>
                    </div>
                  )}
                </aside>
              </div>
            )}
          </section>
        )}
        <section className="editor-section editor-section--details" aria-labelledby="lesson-details-section-title">
          <div className="form-section-title"><Banknote size={17} /><span id="lesson-details-section-title">{t("lessonForm.duration")} · {t("lessonForm.price")}</span></div>
          <div className="lesson-details-grid">
            <div className="field duration-field">
              <span><Clock3 size={13} />{t("lessonForm.duration")}</span>
              <div className="duration-control">
                <div className="duration-presets" role="group" aria-label={t("lessonForm.durationPresets")}>
                  <span>{t("lessonForm.durationPresets")}</span>
                  <div>{DURATION_PRESETS.map((minutes) => <button className={Number(form.durationMinutes) === minutes ? "preset-chip preset-chip--active" : "preset-chip"} type="button" aria-pressed={Number(form.durationMinutes) === minutes} key={minutes} onClick={() => setForm((current) => ({ ...current, durationMinutes: String(minutes) }))}>{minutes}</button>)}</div>
                </div>
                <div className="duration-stepper">
                  <button className="picker-step" type="button" onClick={() => adjustDuration(-5)} aria-label={t("lessonForm.decreaseDuration")}><Minus size={17} /></button>
                  <label className="duration-stepper__input"><span>{t("lessonForm.customDuration")}</span><input required type="number" min="15" max="480" step="1" value={form.durationMinutes} aria-label={t("lessonForm.customDuration")} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))} onBlur={() => setForm((current) => ({ ...current, durationMinutes: clampDuration(current.durationMinutes) }))} /></label>
                  <button className="picker-step" type="button" onClick={() => adjustDuration(5)} aria-label={t("lessonForm.increaseDuration")}><Plus size={17} /></button>
                </div>
              </div>
            </div>
            <div className="lesson-details-side">
              <label className="field lesson-price-field"><span><Banknote size={13} />{t("lessonForm.price")}</span><div className="input-addon"><input required type="number" min="0" max="1000000" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /><span>{currencySymbol(currency)}</span></div></label>
              {!seriesMode && (
                <>
                  <label className="field"><span>{t("lessonForm.status")}</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LessonStatus })}><option value="scheduled">{t("status.scheduled")}</option><option value="completed">{t("status.completed")}</option><option value="cancelled">{t("status.cancelled")}</option></select></label>
                  <label className={`switch-row switch-row--paid${automaticPayment ? " switch-row--automatic" : ""}`}><span><strong>{t("lessonForm.paid")}</strong><small>{automaticPayment ? t("lessonForm.automaticPayment", { month: formatPaymentMonth(automaticPayment.month, i18n.resolvedLanguage) }) : coverageHint}</small></span><input type="checkbox" checked={effectiveIsPaid} disabled={busy || Boolean(automaticPayment)} onChange={(event) => setForm({ ...form, manualPaid: event.target.checked })} /></label>
                </>
              )}
            </div>
          </div>
        </section>
        <section className="editor-section editor-section--notes" aria-labelledby="lesson-notes-section-title">
          <label className="field"><span id="lesson-notes-section-title">{t("lessonForm.notes")}</span><textarea rows={3} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={t("lessonForm.notesPlaceholder")} /></label>
        </section>
        <footer className="modal__actions">
          {lesson && <button className="button button--danger button--small" disabled={busy} type="button" onClick={remove}><Trash2 size={15} />{t("common.delete")}</button>}
          <span className="spacer" />
          <button className="button button--secondary" disabled={busy} type="button" onClick={onClose}>{t("common.cancel")}</button>
          <button className="button button--primary" disabled={busy || seriesInvalid || seriesConflict} type="submit">{t(busy ? "common.saving" : seriesMode ? "lessonForm.createSeries" : "common.save")}</button>
        </footer>
      </form>
    </Modal>
  );
}
