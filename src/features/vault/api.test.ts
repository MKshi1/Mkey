import { describe, expect, it } from 'vitest';
import { createVaultApi } from './api';
import type { BookmarkInput, CredentialInput, VaultSnapshot } from './types';

const snapshot: VaultSnapshot = {
  hint: null,
  sites: [],
  stats: {
    siteCount: 0,
    bookmarkCount: 0,
    credentialCount: 0,
    favoriteCount: 0,
    weakPasswordCount: 0,
  },
};

function createRecorder() {
  const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
  const invoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    calls.push({ command, args });
    return snapshot as T;
  };

  return { calls, invoke };
}

describe('createVaultApi', () => {
  it('sends bookmark writes through the stable Tauri command contract', async () => {
    const recorder = createRecorder();
    const api = createVaultApi(recorder.invoke);
    const bookmark: BookmarkInput = {
      id: null,
      title: '控制台',
      url: 'console.example.com',
      description: '管理入口',
      pinned: true,
    };

    await expect(api.upsertBookmark('site-1', bookmark)).resolves.toBe(snapshot);
    await expect(api.deleteBookmark('site-1', 'bookmark-1')).resolves.toBe(snapshot);

    expect(recorder.calls).toEqual([
      { command: 'upsert_bookmark', args: { siteId: 'site-1', bookmark } },
      { command: 'delete_bookmark', args: { siteId: 'site-1', bookmarkId: 'bookmark-1' } },
    ]);
  });

  it('sends credential writes through the stable Tauri command contract', async () => {
    const recorder = createRecorder();
    const api = createVaultApi(recorder.invoke);
    const credential: CredentialInput = {
      id: 'credential-1',
      label: '管理员',
      username: 'owner@example.com',
      password: 'correct horse battery staple',
      note: '生产环境',
    };

    await expect(api.upsertCredential('site-1', credential)).resolves.toBe(snapshot);
    await expect(api.deleteCredential('site-1', 'credential-1')).resolves.toBe(snapshot);

    expect(recorder.calls).toEqual([
      { command: 'upsert_credential', args: { siteId: 'site-1', credential } },
      { command: 'delete_credential', args: { siteId: 'site-1', credentialId: 'credential-1' } },
    ]);
  });
});
