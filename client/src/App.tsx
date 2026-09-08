import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthScreen } from "./components/AuthScreen";
import { LessonEditor, StudentEditor } from "./components/EditorModals";
import { Layout } from "./components/Layout";
import { LoadError } from "./components/LoadError";
import { normalizeLanguage } from "./i18n";
import { ApiError, api } from "./lib/api";
import { localizedError } from "./lib/error";
import { Calendar } from "./pages/Calendar";
import { Dashboard } from "./pages/Dashboard";
import { Students } from "./pages/Students";
import { Profile } from "./pages/Profile";
import type { AuthUser, Lesson, LessonPayload, Student, StudentPayload, Theme, View } from "./types";

type StudentModal = { student?: Student } | null;
type LessonModal = { lesson?: Lesson; presetDate?: Date } | null;

interface ToastState {
  message: string;
  type: "success" | "error";
}

function initialView(): View {
  const hash = window.location.hash.slice(1);
  return hash === "calendar" || hash === "students" || hash === "profile" ? hash : "dashboard";
}

function initialTheme(): Theme {
  const stored = localStorage.getItem("tutorly-theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<View>(initialView);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [studentModal, setStudentModal] = useState<StudentModal>(null);
  const [lessonModal, setLessonModal] = useState<LessonModal>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const sessionStarted = useRef(false);

  const notify = useCallback((message: string, type: ToastState["type"] = "success") => {
    setToast({ message, type });
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setStudents([]);
    setLessons([]);
    setStudentModal(null);
    setLessonModal(null);
    setWorkspaceError(false);
    setWorkspaceLoading(false);
    setBusy(false);
    setToast(null);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setWorkspaceLoading(true);
    setWorkspaceError(false);
    try {
      const [nextStudents, nextLessons] = await Promise.all([api.students.list(), api.lessons.list()]);
      setStudents(nextStudents);
      setLessons(nextLessons);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
      } else {
        setWorkspaceError(true);
      }
    } finally {
      setWorkspaceLoading(false);
    }
  }, [clearSession]);

  const resolveSession = useCallback(async () => {
    setSessionLoading(true);
    setSessionError(false);
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      await loadWorkspace();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
      } else {
        setSessionError(true);
      }
    } finally {
      setSessionLoading(false);
    }
  }, [clearSession, loadWorkspace]);

  useEffect(() => {
    if (sessionStarted.current) return;
    sessionStarted.current = true;
    void resolveSession();
  }, [resolveSession]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("tutorly-theme", theme);
  }, [theme]);
  useEffect(() => {
    const language = normalizeLanguage(i18n.resolvedLanguage);
    document.documentElement.lang = language;
    document.title = t("meta.title");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.description"));
    localStorage.setItem("tutorly-language", language);
  }, [i18n.resolvedLanguage, t]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleAuthenticated = async (authenticatedUser: AuthUser) => {
    setUser(authenticatedUser);
    await loadWorkspace();
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Local session state must still be cleared if the service is unavailable.
    } finally {
      clearSession();
    }
  };

  const handleMutationError = (error: unknown, fallbackKey: string) => {
    if (error instanceof ApiError && error.status === 401) {
      clearSession();
      return;
    }
    notify(localizedError(error, t, fallbackKey), "error");
  };

  const navigate = (next: View) => {
    setView(next);
    window.history.replaceState(null, "", `#${next}`);
  };

  const openLesson = (lesson?: Lesson, presetDate?: Date) => {
    if (!students.some((student) => !student.archived)) {
      notify(t("errors.addStudentFirst"), "error");
      setStudentModal({});
      return;
    }
    setLessonModal({ lesson, presetDate });
  };

  const saveStudent = async (payload: StudentPayload) => {
    setBusy(true);
    try {
      if (studentModal?.student) {
        await api.students.update(studentModal.student.id, payload);
        notify(t("toast.studentUpdated"));
      } else {
        await api.students.create(payload);
        notify(t("toast.studentAdded"));
      }
      setStudentModal(null);
      await loadWorkspace();
    } catch (error) {
      handleMutationError(error, "errors.saveStudentFailed");
    } finally {
      setBusy(false);
    }
  };

  const deleteStudent = async () => {
    if (!studentModal?.student) return;
    setBusy(true);
    try {
      await api.students.delete(studentModal.student.id);
      setStudentModal(null);
      notify(t("toast.studentDeleted"));
      await loadWorkspace();
    } catch (error) {
      handleMutationError(error, "errors.deleteStudentFailed");
    } finally {
      setBusy(false);
    }
  };

  const saveLesson = async (payload: LessonPayload) => {
    setBusy(true);
    try {
      if (lessonModal?.lesson) {
        await api.lessons.update(lessonModal.lesson.id, payload);
        notify(t("toast.lessonUpdated"));
      } else {
        await api.lessons.create(payload);
        notify(t("toast.lessonScheduled"));
      }
      setLessonModal(null);
      await loadWorkspace();
    } catch (error) {
      handleMutationError(error, "errors.saveLessonFailed");
    } finally {
      setBusy(false);
    }
  };

  const deleteLesson = async () => {
    if (!lessonModal?.lesson) return;
    setBusy(true);
    try {
      await api.lessons.delete(lessonModal.lesson.id);
      setLessonModal(null);
      notify(t("toast.lessonDeleted"));
      await loadWorkspace();
    } catch (error) {
      handleMutationError(error, "errors.deleteLessonFailed");
    } finally {
      setBusy(false);
    }
  };

  if (sessionLoading) {
    return <div className="loading-screen loading-screen--page"><LoaderCircle className="spin" size={28} /><span>{t("toast.loading")}</span></div>;
  }

  if (sessionError) {
    return <LoadError fullPage title={t("loadError.serviceTitle")} message={t("loadError.serviceMessage")} retryLabel={t("loadError.retry")} onRetry={() => void resolveSession()} />;
  }

  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  const currency = user.currency;
  const page = view === "profile" ? (
    <Profile user={user} onLogout={() => void logout()} />
  ) : workspaceLoading ? (
    <div className="loading-screen"><LoaderCircle className="spin" size={28} /><span>{t("toast.loading")}</span></div>
  ) : workspaceError ? (
    <LoadError title={t("loadError.workspaceTitle")} message={t("loadError.workspaceMessage")} retryLabel={t("loadError.retry")} onRetry={() => void loadWorkspace()} />
  ) : view === "calendar" ? (
    <Calendar students={students} lessons={lessons} onOpenLesson={(lesson) => openLesson(lesson)} onAddLesson={(date) => openLesson(undefined, date)} />
  ) : view === "students" ? (
    <Students students={students} lessons={lessons} currency={currency} onOpenStudent={(student) => setStudentModal({ student })} onAddStudent={() => setStudentModal({})} />
  ) : (
    <Dashboard students={students} lessons={lessons} currency={currency} onOpenLesson={(lesson) => openLesson(lesson)} onAddLesson={() => openLesson()} onViewChange={navigate} />
  );

  return (
    <>
      <Layout
        view={view}
        theme={theme}
        user={user}
        onViewChange={navigate}
        onThemeChange={() => setTheme(theme === "light" ? "dark" : "light")}
        onLogout={() => void logout()}
        onAddStudent={() => setStudentModal({})}
        onAddLesson={() => openLesson()}
      >
        {page}
      </Layout>

      {studentModal && (
        <StudentEditor
          key={studentModal.student?.id || "new-student"}
          student={studentModal.student}
          currency={currency}
          busy={busy}
          onClose={() => !busy && setStudentModal(null)}
          onSave={saveStudent}
          onDelete={deleteStudent}
        />
      )}
      {lessonModal && (
        <LessonEditor
          key={lessonModal.lesson?.id || `new-${lessonModal.presetDate?.toISOString() || "lesson"}`}
          lesson={lessonModal.lesson}
          presetDate={lessonModal.presetDate}
          students={students}
          currency={currency}
          busy={busy}
          onClose={() => !busy && setLessonModal(null)}
          onSave={saveLesson}
          onDelete={deleteLesson}
        />
      )}

      {toast && (
        <div className={`toast toast--${toast.type}`} role="status">
          {toast.type === "success" ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label={t("common.close")}><X size={16} /></button>
        </div>
      )}
    </>
  );
}
