import { Banknote, CalendarDays, Clock3, Minus, Plus, Trash2, UserRound, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { currencySymbol, dateKey, studentName } from "../lib/format";
import type { Currency, Lesson, LessonPayload, LessonStatus, Student, StudentPayload } from "../types";

interface ModalProps {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
}

function Modal({ title, eyebrow, children, onClose }: ModalProps) {
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
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal__header">
          <div><p className="eyebrow">{eyebrow}</p><h2 id="modal-title">{title}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("common.close")}><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

interface StudentEditorProps {
  student?: Student;
  currency: Currency;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: StudentPayload) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function StudentEditor({ student, currency, busy, onClose, onSave, onDelete }: StudentEditorProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    firstName: student?.firstName || "",
    lastName: student?.lastName || "",
    defaultLessonPrice: String(student?.defaultLessonPrice ?? ""),
    phone: student?.phone || "",
    notes: student?.notes || "",
    color: student?.color || "#6254d9",
    archived: student?.archived || false,
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
  currency: Currency;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: LessonPayload) => Promise<void>;
  onDelete: () => Promise<void>;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const FIVE_MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
const QUICK_TIMES = ["09:00", "12:00", "15:00", "18:00"];
const DURATION_PRESETS = [30, 45, 60, 90, 120];

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

export function LessonEditor({ lesson, presetDate, students, currency, busy, onClose, onSave, onDelete }: LessonEditorProps) {
  const { t } = useTranslation();
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
    isPaid: lesson?.isPaid || false,
    notes: lesson?.notes || "",
  });

  const [selectedHour = "00", selectedMinute = "00"] = form.time.split(":");
  const minuteOptions = Array.from(new Set([...FIVE_MINUTE_OPTIONS, selectedMinute]))
    .sort((left, right) => Number(left) - Number(right));

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
    await onSave({
      studentId: form.studentId,
      startsAt: new Date(`${form.date}T${form.time}`).toISOString(),
      durationMinutes: Number(form.durationMinutes),
      price: Number(form.price),
      status: form.status,
      isPaid: form.isPaid,
      notes: form.notes || null,
    });
  };

  const remove = async () => {
    if (window.confirm(t("lessonForm.deleteConfirm"))) await onDelete();
  };

  return (
    <Modal title={t(lesson ? "lessonForm.editTitle" : "lessonForm.newTitle")} eyebrow={t("lessonForm.eyebrow")} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-section-title"><UserRound size={17} /><span>{t("lessonForm.studentSection")}</span></div>
        <label className="field"><span>{t("lessonForm.student")}</span><select required value={form.studentId} onChange={(event) => selectStudent(event.target.value)}><option value="">{t("lessonForm.selectStudent")}</option>{students.filter((student) => !student.archived || student.id === lesson?.studentId).map((student) => <option key={student.id} value={student.id}>{studentName(student)}{student.archived ? t("lessonForm.archivedSuffix") : ""}</option>)}</select></label>
        <div className="form-section-title"><CalendarDays size={17} /><span>{t("lessonForm.dateTime")}</span></div>
        <div className="lesson-date-time">
          <label className="field lesson-date-field"><span>{t("lessonForm.date")}</span><input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
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
          <label className="field lesson-price-field"><span><Banknote size={13} />{t("lessonForm.price")}</span><div className="input-addon"><input required type="number" min="0" max="1000000" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /><span>{currencySymbol(currency)}</span></div></label>
        </div>
        <label className="field"><span>{t("lessonForm.status")}</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LessonStatus })}><option value="scheduled">{t("status.scheduled")}</option><option value="completed">{t("status.completed")}</option><option value="cancelled">{t("status.cancelled")}</option></select></label>
        <label className="switch-row switch-row--paid"><span><strong>{t("lessonForm.paid")}</strong><small>{t("lessonForm.paidDescription")}</small></span><input type="checkbox" checked={form.isPaid} onChange={(event) => setForm({ ...form, isPaid: event.target.checked })} /></label>
        <label className="field"><span>{t("lessonForm.notes")}</span><textarea rows={3} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={t("lessonForm.notesPlaceholder")} /></label>
        <footer className="modal__actions">
          {lesson && <button className="button button--danger button--small" disabled={busy} type="button" onClick={remove}><Trash2 size={15} />{t("common.delete")}</button>}
          <span className="spacer" />
          <button className="button button--secondary" disabled={busy} type="button" onClick={onClose}>{t("common.cancel")}</button>
          <button className="button button--primary" disabled={busy} type="submit">{t(busy ? "common.saving" : "common.save")}</button>
        </footer>
      </form>
    </Modal>
  );
}
