import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { EditorDialog, Field } from '../../shared/EditorDialog';
import type { EntryForm, SiteInput } from '../vault/types';

const accentOptions = ['#C2185B', '#0F8494', '#5F7D69', '#D06B54', '#7C6BAF', '#49535F'];

function splitTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function EntryEditorDialog(props: {
  initial: EntryForm;
  busy: boolean;
  onClose: () => void;
  onSubmit: (entry: SiteInput) => void | Promise<void>;
}) {
  const [form, setForm] = useState(props.initial);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void props.onSubmit({
      id: form.id || null,
      kind: form.kind,
      name: form.name,
      domain: form.kind === 'folder' ? '' : form.domain,
      description: form.description,
      tags: splitTags(form.tags),
      accent: form.accent,
      favorite: form.favorite,
    });
  }

  return (
    <EditorDialog
      title={form.id ? '编辑条目' : '新建条目'}
      onClose={props.onClose}
    >
      <form className="editor-form" onSubmit={submit}>
        <Field label="类型">
          <div className="kind-switcher">
            <button
              className={form.kind === 'site' ? 'kind-chip active' : 'kind-chip'}
              type="button"
              onClick={() => setForm((current) => ({ ...current, kind: 'site' }))}
            >
              网站
            </button>
            <button
              className={form.kind === 'folder' ? 'kind-chip active' : 'kind-chip'}
              type="button"
              onClick={() => setForm((current) => ({ ...current, kind: 'folder', domain: '' }))}
            >
              非网站
            </button>
          </div>
        </Field>
        <Field label="名称">
          <input
            aria-label="名称"
            required
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>
        {form.kind === 'site' ? (
          <Field label="网址 / 域名">
            <input
              aria-label="网址 / 域名"
              required
              value={form.domain}
              onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
            />
          </Field>
        ) : null}
        <Field label="描述">
          <textarea
            aria-label="描述"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </Field>
        <Field label="标签">
          <input
            aria-label="标签"
            placeholder="工作, 常用"
            value={form.tags}
            onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
          />
        </Field>
        <div className="field-group">
          <span>颜色</span>
          <div className="accent-picker">
            {accentOptions.map((accent) => (
              <button
                aria-label={`选择颜色 ${accent}`}
                className={form.accent === accent ? 'accent-swatch active' : 'accent-swatch'}
                key={accent}
                style={{ backgroundColor: accent }}
                type="button"
                onClick={() => setForm((current) => ({ ...current, accent }))}
              />
            ))}
          </div>
        </div>
        <label className="check-row">
          <input
            aria-label="收藏条目"
            checked={form.favorite}
            type="checkbox"
            onChange={(event) => setForm((current) => ({ ...current, favorite: event.target.checked }))}
          />
          <span>收藏条目</span>
        </label>
        <div className="dialog-actions">
          <button className="btn btn-secondary" type="button" onClick={props.onClose}>取消</button>
          <button className="btn btn-primary" disabled={props.busy} type="submit">
            <Save size={15} />
            保存条目
          </button>
        </div>
      </form>
    </EditorDialog>
  );
}
