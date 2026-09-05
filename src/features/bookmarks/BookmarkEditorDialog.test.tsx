import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BookmarkEditorDialog } from './BookmarkEditorDialog';

describe('BookmarkEditorDialog', () => {
  it('submits a new bookmark with its pinned state', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <BookmarkEditorDialog
        busy={false}
        initial={{ id: '', title: '', url: '', description: '', pinned: false }}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText('书签标题'), 'OpenAI');
    await user.type(screen.getByLabelText('书签网址'), 'openai.com');
    await user.click(screen.getByLabelText('置顶书签'));
    await user.click(screen.getByRole('button', { name: '保存书签' }));

    expect(onSubmit).toHaveBeenCalledWith({
      id: null,
      title: 'OpenAI',
      url: 'openai.com',
      description: '',
      pinned: true,
    });
  });

  it('keeps existing values when editing a bookmark', () => {
    render(
      <BookmarkEditorDialog
        busy={false}
        initial={{ id: 'bookmark-1', title: '控制台', url: 'https://example.com', description: '管理入口', pinned: true }}
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect((screen.getByLabelText('书签标题') as HTMLInputElement).value).toBe('控制台');
    expect((screen.getByLabelText('书签网址') as HTMLInputElement).value).toBe('https://example.com');
    expect((screen.getByLabelText('置顶书签') as HTMLInputElement).checked).toBe(true);
  });
});
