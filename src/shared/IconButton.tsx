import type { ReactNode } from 'react';

export function IconButton(props: {
  label: string;
  children: ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={props.label}
      className={props.danger ? 'btn-icon danger' : 'btn-icon'}
      title={props.label}
      type="button"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
