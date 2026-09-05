import { describe, expect, it } from 'vitest';
import { filterEntries, formatRuntimeError, resolveEntryUrl } from './domain';
import type { SiteRecord } from './types';

const baseEntry: SiteRecord = {
  id: 'site-1',
  kind: 'site',
  name: '开发工具',
  domain: 'example.com',
  description: '工作入口',
  tags: ['常用'],
  accent: '#1D4ED8',
  favorite: false,
  createdAt: '2026-09-04T00:00:00Z',
  updatedAt: '2026-09-04T00:00:00Z',
  bookmarks: [
    {
      id: 'bookmark-1',
      title: '文档中心',
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
  ],
  credentials: [
    {
      id: 'credential-1',
      label: '管理员',
      username: 'owner@example.com',
      password: 'SecretShouldNotBeSearchable!',
      note: '生产环境',
      createdAt: '2026-09-04T00:00:00Z',
      updatedAt: '2026-09-04T00:00:00Z',
    },
  ],
};

describe('filterEntries', () => {
  it.each([
    ['开发工具', 'site name'],
    ['example.com', 'site domain'],
    ['工作入口', 'site description'],
    ['常用', 'site tag'],
    ['文档中心', 'bookmark title'],
    ['docs.example.com', 'bookmark URL'],
    ['接口说明', 'bookmark description'],
    ['管理员', 'credential label'],
    ['owner@example.com', 'credential username'],
    ['生产环境', 'credential note'],
  ])('matches %s from the %s', (query) => {
    expect(filterEntries([baseEntry], query)).toEqual([baseEntry]);
  });

  it('does not search plaintext passwords', () => {
    expect(filterEntries([baseEntry], 'SecretShouldNotBeSearchable')).toEqual([]);
  });

  it('returns every entry for an empty query', () => {
    expect(filterEntries([baseEntry], '   ')).toEqual([baseEntry]);
  });
});

describe('resolveEntryUrl', () => {
  it('prefers a pinned bookmark over an earlier unpinned bookmark', () => {
    expect(resolveEntryUrl(baseEntry)).toBe('https://console.example.com');
  });

  it('falls back to the first bookmark and then the site domain', () => {
    expect(resolveEntryUrl({ ...baseEntry, bookmarks: [baseEntry.bookmarks[0]] })).toBe('https://docs.example.com');
    expect(resolveEntryUrl({ ...baseEntry, bookmarks: [] })).toBe('https://example.com');
  });

  it('returns an empty string for a folder', () => {
    expect(resolveEntryUrl({ ...baseEntry, kind: 'folder', domain: '' })).toBe('');
  });
});

describe('formatRuntimeError', () => {
  it('replaces a missing Tauri bridge error with a useful desktop-app message', () => {
    expect(formatRuntimeError(new TypeError("Cannot read properties of undefined (reading 'invoke')"))).toBe(
      '浏览器预览无法访问本地保险库，请通过桌面应用运行 MKey。',
    );
  });

  it('preserves a normal backend error message', () => {
    expect(formatRuntimeError('主密码错误。')).toBe('主密码错误。');
  });
});
