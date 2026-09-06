import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EntryEditorDialog } from './EntryEditorDialog';

describe('EntryEditorDialog', () => {
  it('offers the MKey accent palette and marks the current color', () => {
    render(
      <EntryEditorDialog
        busy={false}
        initial={{
          id: '',
          kind: 'site',
          name: '',
          domain: '',
          description: '',
          tags: '',
          workspace: '',
          category: '工具',
          accent: '#C2185B',
          favorite: false,
        }}
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: '选择颜色 #C2185B' }).classList.contains('active')).toBe(true);
    expect(screen.queryByRole('button', { name: '选择颜色 #1D4ED8' })).toBeNull();
  });

  it('clears the website domain when an entry becomes a folder', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <EntryEditorDialog
        busy={false}
        initial={{
          id: 'site-1',
          kind: 'site',
          name: '示例站点',
          domain: 'example.com',
          description: '',
          tags: '',
          workspace: '',
          category: '工具',
          accent: '#1D4ED8',
          favorite: false,
        }}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: '非网站' }));
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    expect(onSubmit).toHaveBeenCalledWith({
      id: 'site-1',
      kind: 'folder',
      name: '示例站点',
      domain: '',
      description: '',
      tags: ['分类：工具'],
      accent: '#1D4ED8',
      favorite: false,
    });
  });
});
