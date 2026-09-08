import { Check, Languages, LogOut, Mail, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  languageFlags,
  normalizeLanguage,
  supportedLanguages,
  type SupportedLanguage,
} from "../i18n";
import type { AuthUser } from "../types";

interface ProfileProps {
  user: AuthUser;
  onLogout: () => void;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "TU";
}

export function Profile({ user, onLogout }: ProfileProps) {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage);

  const changeLanguage = (next: SupportedLanguage) => {
    void i18n.changeLanguage(next);
  };

  return (
    <div className="profile-page">
      <section className="profile-section" aria-labelledby="profile-account-title">
        <div className="profile-section__heading">
          <span className="profile-section__icon"><UserRound size={20} /></span>
          <div>
            <h2 id="profile-account-title">{t("profile.account")}</h2>
            <p>{t("profile.accountDescription")}</p>
          </div>
        </div>
        <div className="profile-account-card">
          <span className="profile-account-card__avatar" aria-hidden="true">{initials(user.name)}</span>
          <div className="profile-account-card__identity">
            <strong>{user.name}</strong>
            <span><Mail size={15} />{user.email}</span>
          </div>
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-language-title">
        <div className="profile-section__heading">
          <span className="profile-section__icon"><Languages size={20} /></span>
          <div>
            <h2 id="profile-language-title">{t("profile.language")}</h2>
            <p>{t("profile.languageDescription")}</p>
          </div>
        </div>
        <div className="profile-language-grid">
          {supportedLanguages.map((code) => {
            const active = code === language;
            return (
              <button
                aria-pressed={active}
                className={`profile-language-card${active ? " profile-language-card--active" : ""}`}
                key={code}
                onClick={() => changeLanguage(code)}
                type="button"
              >
                <span className="profile-language-card__flag" aria-hidden="true">{languageFlags[code]}</span>
                <span className="profile-language-card__name">{t(`languages.${code}`)}</span>
                {active && <span className="profile-language-card__current"><Check size={15} />{t("profile.current")}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="profile-section profile-section--logout" aria-labelledby="profile-logout-title">
        <div className="profile-section__heading">
          <span className="profile-section__icon profile-section__icon--danger"><LogOut size={20} /></span>
          <div>
            <h2 id="profile-logout-title">{t("profile.logout")}</h2>
            <p>{t("profile.logoutDescription")}</p>
          </div>
        </div>
        <button className="button button--danger profile-logout" onClick={onLogout} type="button">
          <LogOut size={17} />{t("profile.logoutAction")}
        </button>
      </section>
    </div>
  );
}
