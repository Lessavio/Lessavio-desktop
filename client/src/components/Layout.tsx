import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Sun,
  UserRound,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizeLanguage } from "../i18n";
import { capitalize, formatFullDate } from "../lib/format";
import type { AuthUser, Theme, View } from "../types";

interface LayoutProps {
  children: ReactNode;
  view: View;
  theme: Theme;
  user: AuthUser;
  onViewChange: (view: View) => void;
  onThemeChange: () => void;
  onLogout: () => void;
  onAddStudent: () => void;
  onAddLesson: () => void;
}

const navConfig: Array<{ view: View; key: string; icon: typeof LayoutDashboard }> = [
  { view: "dashboard", key: "nav.overview", icon: LayoutDashboard },
  { view: "calendar", key: "nav.calendar", icon: CalendarDays },
  { view: "students", key: "nav.students", icon: Users },
  { view: "profile", key: "nav.profile", icon: UserRound },
];

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "TU";
}

export function Layout({
  children,
  view,
  theme,
  user,
  onViewChange,
  onThemeChange,
  onLogout,
  onAddStudent,
  onAddLesson,
}: LayoutProps) {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage);
  const items = navConfig.map((item) => ({ ...item, label: t(item.key) }));
  const titles: Record<View, { eyebrow: string; title: string }> = {
    dashboard: {
      eyebrow: t("layout.dashboardEyebrow", { date: capitalize(formatFullDate(new Date(), language)) }),
      title: t("layout.welcome"),
    },
    calendar: { eyebrow: t("layout.scheduleEyebrow"), title: t("layout.calendarTitle") },
    students: { eyebrow: t("layout.studentsEyebrow"), title: t("layout.studentsTitle") },
    profile: { eyebrow: t("layout.profileEyebrow"), title: t("layout.profileTitle") },
  };

  const navigate = (next: View) => {
    onViewChange(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("dashboard")} aria-label={t("layout.home")}>
          <span className="brand__mark">T</span>
          <span className="brand__name">Tutorly</span>
        </button>

        <nav className="sidebar__nav" aria-label={t("nav.main")}>
          {items.map(({ view: itemView, label, icon: Icon }) => (
            <button
              className={`nav-item${view === itemView ? " nav-item--active" : ""}`}
              key={itemView}
              onClick={() => navigate(itemView)}
            >
              <Icon size={20} />
              <span>{label}</span>
              {view === itemView && <ChevronRight className="nav-item__arrow" size={16} />}
            </button>
          ))}
        </nav>

        <div className="quick-card">
          <span className="quick-card__icon"><CalendarDays size={19} /></span>
          <p>{t("layout.nextFreeTime")}</p>
          <strong>{t("layout.addNewLesson")}</strong>
          <button className="button button--light button--small" onClick={onAddLesson}>{t("layout.schedule")}</button>
        </div>

        <div className="profile-card">
          <button
            aria-label={t("nav.profile")}
            className="profile-card__identity"
            onClick={() => navigate("profile")}
            type="button"
          >
            <span className="profile-card__avatar" aria-hidden="true">{initials(user.name)}</span>
            <span className="profile-card__details"><strong title={user.name}>{user.name}</strong><span title={user.email}>{user.email}</span></span>
          </button>
          <button className="profile-card__logout" onClick={onLogout} aria-label={t("auth.logout")} title={t("auth.logout")}><LogOut size={17} /></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{titles[view].eyebrow}</p>
            <h1>{titles[view].title}</h1>
          </div>
          <div className="topbar__actions">
            <button className="icon-button topbar__icon" onClick={onThemeChange} aria-label={t("layout.switchTheme")}>
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <button className="icon-button topbar__icon" aria-label={t("layout.notifications")}><Bell size={19} /></button>
            <button className="button button--secondary topbar__student" onClick={onAddStudent}>{t("layout.addStudent")}</button>
            <button className="button button--primary" onClick={onAddLesson}><Plus size={18} /><span>{t("layout.newLesson")}</span></button>
          </div>
        </header>
        <div className="page-enter" key={`${view}-${language}`}>{children}</div>
      </main>

      <nav className="mobile-nav" aria-label={t("nav.mobile")}>
        {items.slice(0, 2).map(({ view: itemView, label, icon: Icon }) => (
          <button className={view === itemView ? "active" : ""} key={itemView} onClick={() => navigate(itemView)}><Icon size={20} /><span>{label}</span></button>
        ))}
        <button className="mobile-nav__add" onClick={onAddLesson} aria-label={t("layout.addLesson")}><Plus size={24} /></button>
        <button className={view === "students" ? "active" : ""} onClick={() => navigate("students")}><Users size={20} /><span>{t("nav.students")}</span></button>
        <button className={view === "profile" ? "active" : ""} onClick={() => navigate("profile")}><UserRound size={20} /><span>{t("nav.profile")}</span></button>
      </nav>
    </div>
  );
}
