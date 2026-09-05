import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultSnapshot } from '../features/vault/types';
import { MKeyApp } from './MKeyApp';

const api = vi.hoisted(() => ({
  exportData: vi.fn(),
  getSnapshot: vi.fn(),
  getStatus: vi.fn(),
}));

vi.mock('../features/vault/api', () => ({ vaultApi: api }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

const snapshot: VaultSnapshot = {
  hint: 'toolbar-test',
  sites: [{
    id: 'site-1',
    kind: 'site',
    name: '测试网站',
    domain: 'example.test',
    description: '',
    tags: [],
    accent: '#1D4ED8',
    favorite: false,
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    bookmarks: [],
    credentials: [],
  }],
  stats: {
    siteCount: 1,
    bookmarkCount: 0,
    credentialCount: 0,
    favoriteCount: 0,
    weakPasswordCount: 0,
  },
};

describe('MKeyApp vault toolbar', () => {
  beforeEach(() => {
    localStorage.clear();
    api.getStatus.mockReset().mockResolvedValue({ configured: true, unlocked: true, hint: 'toolbar-test' });
    api.getSnapshot.mockReset().mockResolvedValue(snapshot);
    api.exportData.mockReset().mockResolvedValue('{"version":1}');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('switches between list and card layouts and remembers the selection', async () => {
    const user = userEvent.setup();
    const { container } = render(<MKeyApp />);

    await screen.findByText('测试网站');
    expect(container.querySelector('.entry-board')?.classList.contains('is-list')).toBe(true);
    expect(container.querySelector('.entry-card')?.classList.contains('list-mode')).toBe(true);

    await user.click(screen.getByRole('button', { name: '卡片' }));
    expect(container.querySelector('.entry-board')?.classList.contains('is-card')).toBe(true);
    expect(container.querySelector('.entry-card')?.classList.contains('card-mode')).toBe(true);
    expect(localStorage.getItem('mkey-view-mode')).toBe('card');

    await user.click(screen.getByRole('button', { name: '列表' }));
    expect(container.querySelector('.entry-board')?.classList.contains('is-list')).toBe(true);
    expect(container.querySelector('.entry-card')?.classList.contains('list-mode')).toBe(true);
    expect(localStorage.getItem('mkey-view-mode')).toBe('list');
  });

  it('opens the import file picker from the vault toolbar', async () => {
    const user = userEvent.setup();
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    render(<MKeyApp />);

    await screen.findByText('测试网站');
    await user.click(screen.getByRole('button', { name: '导入' }));

    expect(inputClick).toHaveBeenCalledTimes(1);
  });

  it('offers four palettes and persists the selected theme', async () => {
    const user = userEvent.setup();
    render(<MKeyApp />);

    await screen.findByText('测试网站');
    await user.click(screen.getByRole('button', { name: '设置' }));

    expect(screen.getByRole('radiogroup', { name: '主题配色' })).not.toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    await user.click(screen.getByRole('radio', { name: '杏白暖光' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('warm');
    expect(localStorage.getItem('mkey-theme-v2')).toBe('warm');
  });

  it('uses the neutral monochrome palette on first startup', async () => {
    render(<MKeyApp />);

    await screen.findByText('测试网站');
    expect(document.documentElement.getAttribute('data-theme')).toBe('minimal');
  });

  it('restores a saved palette on startup', async () => {
    localStorage.setItem('mkey-theme-v2', 'minimal');
    render(<MKeyApp />);

    await screen.findByText('测试网站');
    expect(document.documentElement.getAttribute('data-theme')).toBe('minimal');
  });

  it('does not inherit the old red-first palette preference', async () => {
    localStorage.setItem('mkey-theme', 'pearl');
    render(<MKeyApp />);

    await screen.findByText('测试网站');
    expect(document.documentElement.getAttribute('data-theme')).toBe('minimal');
  });

  it('exports vault data from the vault toolbar', async () => {
    const user = userEvent.setup();
    let downloadName = '';
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function captureDownload(this: HTMLAnchorElement) {
      downloadName = this.download;
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:mkey-export') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    render(<MKeyApp />);

    await screen.findByText('测试网站');
    await user.click(screen.getByRole('button', { name: '导出' }));

    await waitFor(() => expect(screen.queryByText('数据已导出。')).not.toBeNull());
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(downloadName).toMatch(/^mkey-export-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('keeps primary screens and editors free of explanatory copy', async () => {
    const user = userEvent.setup();
    render(<MKeyApp />);

    await screen.findByText('测试网站');
    expect(screen.queryByRole('heading', { name: 'MKey' })).toBeNull();
    expect(screen.getByRole('img', { name: 'MKey' })).not.toBeNull();
    expect(screen.queryByText('书签与账密保险库')).toBeNull();
    expect(screen.queryByText('一个条目集中管理网址、书签和多组账号密码。')).toBeNull();

    await user.click(screen.getByRole('button', { name: '添加非网站' }));
    expect(screen.queryByText('网站可以保存书签和账密，非网站条目只保存账密。')).toBeNull();
    await user.click(screen.getByRole('button', { name: '关闭' }));

    await user.click(screen.getByRole('button', { name: '设置' }));
    expect(screen.queryByText('管理保险库状态、数据交换和显示主题。')).toBeNull();
    expect(screen.queryByText('保险库已解锁，离开设备前可以立即锁定。')).toBeNull();
    expect(screen.queryByText('提示：toolbar-test')).toBeNull();
    expect(screen.queryByText('导出可迁移的 JSON 文件，或导入并重新加密已有数据。')).toBeNull();
    expect(screen.queryByRole('heading', { name: '主题模式' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '搜索' }));
    expect(screen.queryByText('检索条目、标签、书签标题与网址，以及账号和备注。')).toBeNull();
    expect(screen.queryByText('密码明文不会进入搜索范围。')).toBeNull();
  });

  it('does not display the saved password hint on the unlock screen', async () => {
    api.getStatus.mockResolvedValue({ configured: true, unlocked: false, hint: '压力测试保险库' });
    render(<MKeyApp />);

    await screen.findByRole('heading', { name: '解锁保险库' });
    expect(screen.queryByText('提示：压力测试保险库')).toBeNull();
  });
});
