import { AlertTriangle, RotateCw } from "lucide-react";

interface LoadErrorProps {
  title: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
  fullPage?: boolean;
}

export function LoadError({ title, message, retryLabel, onRetry, fullPage = false }: LoadErrorProps) {
  return (
    <div className={`load-error${fullPage ? " load-error--page" : ""}`} role="alert">
      <span className="load-error__icon"><AlertTriangle size={25} /></span>
      <h2>{title}</h2>
      <p>{message}</p>
      <button className="button button--primary" onClick={onRetry} type="button">
        <RotateCw size={17} />{retryLabel}
      </button>
    </div>
  );
}
