import { Languages, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { languageFlags, normalizeLanguage, supportedLanguages, type SupportedLanguage } from "../i18n";
import { api } from "../lib/api";
import type { AuthUser } from "../types";

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => Promise<void>;
}

type AuthMode = "login" | "register";

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const language = normalizeLanguage(i18n.resolvedLanguage);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setErrorKey(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setErrorKey(null);
    try {
      const user = mode === "register"
        ? await api.auth.register({ name: name.trim(), email: email.trim(), password })
        : await api.auth.login({ email: email.trim(), password });
      setPassword("");
      await onAuthenticated(user);
    } catch {
      setErrorKey(mode === "register" ? "auth.registerError" : "auth.loginError");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-screen__glow" aria-hidden="true" />
      <header className="auth-screen__header">
        <div className="auth-brand"><span className="auth-brand__mark">T</span><strong>Tutorly</strong></div>
        <label className="language-switcher auth-language" aria-label={t("languages.label")}>
          <Languages size={17} />
          <select value={language} onChange={(event) => void i18n.changeLanguage(event.target.value as SupportedLanguage)}>
            {supportedLanguages.map((code) => <option key={code} value={code}>{languageFlags[code]} {t(`languages.${code}`)}</option>)}
          </select>
        </label>
      </header>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card__intro">
          <span className="auth-card__icon"><LockKeyhole size={24} /></span>
          <p className="eyebrow">{t("auth.eyebrow")}</p>
          <h1 id="auth-title">{t(mode === "login" ? "auth.loginTitle" : "auth.registerTitle")}</h1>
          <p>{t(mode === "login" ? "auth.loginDescription" : "auth.registerDescription")}</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && (
            <label className="field auth-field">
              <span><UserRound size={15} />{t("auth.name")}</span>
              <input
                autoComplete="name"
                disabled={busy}
                name="name"
                onChange={(event) => setName(event.target.value)}
                placeholder={t("auth.namePlaceholder")}
                required
                value={name}
              />
            </label>
          )}
          <label className="field auth-field">
            <span><Mail size={15} />{t("auth.email")}</span>
            <input
              autoComplete="email"
              disabled={busy}
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="field auth-field">
            <span><LockKeyhole size={15} />{t("auth.password")}</span>
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={busy}
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
              required
              type="password"
              value={password}
            />
            <small>{t("auth.passwordHint")}</small>
          </label>

          {errorKey && <div className="auth-error" role="alert">{t(errorKey)}</div>}

          <button className="button button--primary auth-submit" disabled={busy} type="submit">
            {busy && <LoaderCircle className="spin" size={18} />}
            {t(busy ? "auth.submitting" : mode === "login" ? "auth.loginAction" : "auth.registerAction")}
          </button>
        </form>

        <div className="auth-toggle">
          <span>{t(mode === "login" ? "auth.noAccount" : "auth.haveAccount")}</span>
          <button className="link-button" disabled={busy} onClick={() => changeMode(mode === "login" ? "register" : "login")} type="button">
            {t(mode === "login" ? "auth.createAccount" : "auth.backToLogin")}
          </button>
        </div>
      </section>
    </main>
  );
}
