import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EntryCard } from './EntryCard';
import type { SiteRecord } from '../vault/types';

const folder: SiteRecord = {
  id: 'folder-1',
  kind: 'folder',
  name: '本地工具',
  domain: '',
  description: '不对应网站的账号',
  tags: [],
  accent: '#475569',
  favorite: false,
  createdAt: '2026-09-04T00:00:00Z',
  updatedAt: '2026-09-04T00:00:00Z',
  bookmarks: [],
  credentials: [],
};

describe('EntryCard', () => {
  it('does not offer bookmark actions for a folder entry', async () => {
    const user = userEvent.setup();
    render(
      <EntryCard
        entry={folder}
        viewMode="list"
        visibleCredentialIds={[]}
        onAddBookmark={() => undefined}
        onAddCredential={() => undefined}
        onCopyPassword={() => undefined}
        onCopyUsername={() => undefined}
        onDeleteBookmark={() => undefined}
        onDeleteCredential={() => undefined}
        onDeleteEntry={() => undefined}
        onEditBookmark={() => undefined}
        onEditCredential={() => undefined}
        onEditEntry={() => undefined}
        onOpenBookmark={() => undefined}
        onOpenEntry={() => undefined}
        onTogglePassword={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: '展开详情' }));
    expect(screen.queryByRole('button', { name: '添加书签' })).toBeNull();
    expect(screen.getByRole('button', { name: '添加账号密码' })).not.toBeNull();
  });

  it('renders nested records only after the user expands the entry', async () => {
    const user = userEvent.setup();
    const site: SiteRecord = {
      ...folder,
      id: 'site-1',
      kind: 'site',
      name: '测试网站',
      domain: 'example.test',
      bookmarks: [{
        id: 'bookmark-1',
        title: '发布面板',
        url: 'https://example.test/releases',
        description: '',
        pinned: true,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      }],
      credentials: [{
        id: 'credential-1',
        label: '管理员',
        username: 'owner@example.test',
        password: 'HiddenPassword!2026',
        note: '',
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      }],
    };

    render(
      <EntryCard
        entry={site}
        viewMode="list"
        visibleCredentialIds={[]}
        onAddBookmark={() => undefined}
        onAddCredential={() => undefined}
        onCopyPassword={() => undefined}
        onCopyUsername={() => undefined}
        onDeleteBookmark={() => undefined}
        onDeleteCredential={() => undefined}
        onDeleteEntry={() => undefined}
        onEditBookmark={() => undefined}
        onEditCredential={() => undefined}
        onEditEntry={() => undefined}
        onOpenBookmark={() => undefined}
        onOpenEntry={() => undefined}
        onTogglePassword={() => undefined}
      />,
    );

    expect(screen.queryByText('发布面板')).toBeNull();
    expect(screen.queryByText('owner@example.test')).toBeNull();

    await user.click(screen.getByRole('button', { name: '展开详情' }));

    expect(screen.getByText('发布面板')).not.toBeNull();
    expect(screen.getByText('owner@example.test')).not.toBeNull();
  });
});
