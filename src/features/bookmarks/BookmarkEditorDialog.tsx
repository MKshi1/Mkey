import { useState, type FormEvent } from 'react';
import { Bookmark, Save } from 'lucide-react';
import { EditorDialog, Field } from '../../shared/EditorDialog';
import type { BookmarkForm, BookmarkInput } from '../vault/types';

export function BookmarkEditorDialog(props: {
  initial: BookmarkForm;
  busy: boolean;
  onClose: () => void;
  onSubmit: (bookmark: BookmarkInput) => void | Promise<void>;
}) {
  const [form, setForm] = useState(props.initial);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void props.onSubmit({
      id: form.id || null,
      title: form.title,
      url: form.url,
      description: form.description,
      pinned: form.pinned,
    });
  }

  return (
    <EditorDialog
      title={form.id ? '编辑书签' : '新增书签'}
      onClose={props.onClose}
    >
      <form className="editor-form" onSubmit={submit}>
        <Field label="书签标题">
          <input
            aria-label="书签标题"
            required
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
        </Field>
        <Field label="书签网址">
          <input
            aria-label="书签网址"
            placeholder="example.com/path"
            required
            value={form.url}
            onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
          />
        </Field>
        <Field label="描述">
          <textarea
            aria-label="书签描述"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </Field>
        <label className="check-row">
          <input
            aria-label="置顶书签"
            checked={form.pinned}
            type="checkbox"
            onChange={(event) => setForm((current) => ({ ...current, pinned: event.target.checked }))}
          />
          <Bookmark size={15} />
          <span>置顶书签</span>
        </label>
        <div className="dialog-actions">
          <button className="btn btn-secondary" type="button" onClick={props.onClose}>取消</button>
          <button className="btn btn-primary" disabled={props.busy} type="submit">
            <Save size={15} />
            保存书签
          </button>
        </div>
      </form>
    </EditorDialog>
  );
}
