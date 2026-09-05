import { useState, type FormEvent } from 'react';
import { Save, Sparkles } from 'lucide-react';
import { EditorDialog, Field } from '../../shared/EditorDialog';
import type { CredentialForm, CredentialInput } from '../vault/types';

export function CredentialEditorDialog(props: {
  initial: CredentialForm;
  busy: boolean;
  onClose: () => void;
  onGeneratePassword: () => Promise<string>;
  onSubmit: (credential: CredentialInput) => void | Promise<void>;
}) {
  const [form, setForm] = useState(props.initial);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');

  async function generatePassword() {
    setGenerating(true);
    setGenerationError('');
    try {
      const password = await props.onGeneratePassword();
      setForm((current) => ({ ...current, password }));
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : String(error));
    } finally {
      setGenerating(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void props.onSubmit({
      id: form.id || null,
      label: form.label,
      username: form.username,
      password: form.password,
      note: form.note,
    });
  }

  return (
    <EditorDialog
      title={form.id ? '编辑账号密码' : '新增账号密码'}
      onClose={props.onClose}
    >
      <form className="editor-form" onSubmit={submit}>
        <Field label="显示名称">
          <input
            aria-label="显示名称"
            value={form.label}
            onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
          />
        </Field>
        <Field label="账号">
          <input
            aria-label="账号"
            required
            value={form.username}
            onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
          />
        </Field>
        <Field label="密码">
          <div className="inline-field">
            <input
              aria-label="密码"
              required
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
            <button
              className="btn btn-secondary"
              disabled={generating}
              type="button"
              onClick={() => void generatePassword()}
            >
              <Sparkles size={14} />
              生成密码
            </button>
          </div>
          {generationError ? <span className="form-error" role="alert">{generationError}</span> : null}
        </Field>
        <Field label="备注">
          <textarea
            aria-label="备注"
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
          />
        </Field>
        <div className="dialog-actions">
          <button className="btn btn-secondary" type="button" onClick={props.onClose}>取消</button>
          <button className="btn btn-primary" disabled={props.busy} type="submit">
            <Save size={15} />
            保存账密
          </button>
        </div>
      </form>
    </EditorDialog>
  );
}
