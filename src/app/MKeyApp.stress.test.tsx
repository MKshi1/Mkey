import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStressVault } from '../../scripts/generate-test-data.js';
import { filterEntries } from '../features/vault/domain';
import type { SiteRecord, VaultSnapshot } from '../features/vault/types';
import { MKeyApp } from './MKeyApp';

const api = vi.hoisted(() => ({
  getStatus: vi.fn(),
  getSnapshot: vi.fn(),
}));

vi.mock('../features/vault/api', () => ({ vaultApi: api }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

const sites = createStressVault().sites as SiteRecord[];
const snapshot: VaultSnapshot = {
  hint: 'stress',
  sites,
  stats: {
    siteCount: sites.filter((entry) => entry.kind === 'site').length,
    bookmarkCount: sites.reduce((count, entry) => count + entry.bookmarks.length, 0),
    credentialCount: sites.reduce((count, entry) => count + entry.credentials.length, 0),
    favoriteCount: sites.filter((entry) => entry.favorite).length,
    weakPasswordCount: sites.flatMap((entry) => entry.credentials).filter((credential) => credential.password === '123456').length,
  },
};

describe('MKeyApp stress fixture', () => {
  beforeEach(() => {
    api.getStatus.mockReset().mockResolvedValue({ configured: true, unlocked: true, hint: 'stress' });
    api.getSnapshot.mockReset().mockResolvedValue(snapshot);
  });

  it('renders the full vault and searches nested records', async () => {
    const user = userEvent.setup();
    const { container } = render(<MKeyApp />);

    await waitFor(() => expect(container.querySelectorAll('.entry-card')).toHaveLength(300));
    expect(container.querySelectorAll('.bookmark-item')).toHaveLength(0);
    expect(container.querySelectorAll('.credential-mini-item')).toHaveLength(0);
    expect(container.textContent).not.toContain('MKey!000001Aa');

    await user.click(container.querySelector('button[aria-label="展开详情"]') as HTMLButtonElement);
    expect(container.querySelectorAll('.bookmark-item')).toHaveLength(5);
    expect(container.querySelectorAll('.credential-mini-item')).toHaveLength(3);

    await user.click(container.querySelector('button[aria-label="搜索"]') as HTMLButtonElement);
    const searchInput = container.querySelector('input[aria-label="搜索保险库"]') as HTMLInputElement;
    await user.type(searchInput, '发布检查清单');

    const expectedMatches = filterEntries(sites, '发布检查清单').length;
    await waitFor(() => expect(container.querySelectorAll('.search-result-card')).toHaveLength(expectedMatches));
    expect(expectedMatches).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('MKey!000001Aa');
  }, 20_000);
});
