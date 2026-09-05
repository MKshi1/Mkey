import type { ReactNode } from 'react';

export function DockButton(props: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={props.label}
      className={props.active ? 'nav-item active' : 'nav-item'}
      title={props.label}
      type="button"
      onClick={props.onClick}
    >
      {props.icon}
      <span className="tooltip">{props.label}</span>
    </button>
  );
}

export function StatCard(props: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="stat-icon-bg">{props.icon}</div>
      <div className="stat-info">
        <div className="stat-label">{props.label}</div>
        <div className="stat-value">{props.value}</div>
      </div>
    </div>
  );
}
