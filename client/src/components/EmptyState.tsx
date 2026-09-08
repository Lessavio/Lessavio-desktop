import { CalendarPlus2 } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  compact?: boolean;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ title, description, compact = false, action }: EmptyStateProps) {
  return (
    <div className={`empty-state${compact ? " empty-state--compact" : ""}`}>
      <div className="empty-state__icon"><CalendarPlus2 size={21} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <button className="button button--primary button--small" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}
