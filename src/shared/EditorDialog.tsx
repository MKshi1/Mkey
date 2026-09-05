import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function EditorDialog(props: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="dialog-overlay" onClick={props.onClose}>
      <section
        aria-label={props.title}
        aria-modal="true"
        className="dialog-panel"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <h3>{props.title}</h3>
          </div>
          <button aria-label="关闭" className="btn-icon" title="关闭" type="button" onClick={props.onClose}>
            <X size={14} />
          </button>
        </div>
        {props.children}
      </section>
    </div>
  );
}

export function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="field-group">
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}
