import { describe, expect, it } from 'vitest';
import { createStressVault } from './generate-test-data.js';

describe('createStressVault', () => {
  it('creates deterministic, unique and import-compatible records', () => {
    const vault = createStressVault({ siteCount: 240, folderCount: 60, bookmarksPerSite: 5, credentialsPerEntry: 3 });
    const sites = vault.sites.filter((entry) => entry.kind === 'site');
    const folders = vault.sites.filter((entry) => entry.kind === 'folder');
    const allIds = vault.sites.flatMap((entry) => [
      entry.id,
      ...entry.bookmarks.map((bookmark) => bookmark.id),
      ...entry.credentials.map((credential) => credential.id),
    ]);

    expect(vault.exportedAt).toBe('2026-09-04T12:00:00.000Z');
    expect(vault.sites).toHaveLength(300);
    expect(sites).toHaveLength(240);
    expect(folders).toHaveLength(60);
    expect(sites.flatMap((entry) => entry.bookmarks)).toHaveLength(1_200);
    expect(vault.sites.flatMap((entry) => entry.credentials)).toHaveLength(900);
    expect(folders.every((entry) => entry.bookmarks.length === 0)).toBe(true);
    expect(sites.every((entry) => entry.bookmarks[0]?.pinned)).toBe(true);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(JSON.stringify(vault)).not.toContain('undefined');
  });

  it('rejects invalid generation sizes', () => {
    expect(() => createStressVault({ siteCount: -1 })).toThrow('siteCount');
    expect(() => createStressVault({ bookmarksPerSite: 101 })).toThrow('bookmarksPerSite');
  });
});
