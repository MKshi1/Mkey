import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BookmarkList } from './BookmarkList';
import type { BookmarkRecord } from '../vault/types';

const bookmarks: BookmarkRecord[] = [
  {
    id: 'bookmark-1',
    title: '文档',
    url: 'https://docs.example.com',
    description: '接口说明',
    pinned: false,
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
  },
  {
    id: 'bookmark-2',
    title: '控制台',
    url: 'https://console.example.com',
    description: '管理入口',
    pinned: true,
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
  },
];

describe('BookmarkList', () => {
  it('shows every bookmark and exposes row actions', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <BookmarkList
        bookmarks={bookmarks}
        onAdd={() => undefined}
        onDelete={onDelete}
        onEdit={onEdit}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText('文档')).not.toBeNull();
    expect(screen.getByText('控制台')).not.toBeNull();
    expect(screen.getByText('已置顶')).not.toBeNull();

    await user.click(screen.getAllByTitle('打开书签')[1]);
    await user.click(screen.getAllByTitle('编辑书签')[0]);
    await user.click(screen.getAllByTitle('删除书签')[0]);

    expect(onOpen).toHaveBeenCalledWith(bookmarks[1]);
    expect(onEdit).toHaveBeenCalledWith(bookmarks[0]);
    expect(onDelete).toHaveBeenCalledWith(bookmarks[0]);
  });

  it('offers an add action when no bookmarks exist', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(
      <BookmarkList
        bookmarks={[]}
        onAdd={onAdd}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onOpen={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: '添加书签' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
