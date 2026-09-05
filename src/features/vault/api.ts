import { invoke } from '@tauri-apps/api/core';
import type {
  BookmarkInput,
  BrowserBookmarkImportPreview,
  BrowserBookmarkImportRequest,
  BrowserBookmarkImportResult,
  BrowserBookmarkSource,
  CredentialInput,
  SiteInput,
  VaultSnapshot,
  VaultStatus,
} from './types';

export type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export type VaultApi = {
  getStatus: () => Promise<VaultStatus>;
  setup: (masterPassword: string, hint: string | null) => Promise<VaultSnapshot>;
  unlock: (masterPassword: string) => Promise<VaultSnapshot>;
  lock: () => Promise<VaultStatus>;
  getSnapshot: () => Promise<VaultSnapshot>;
  upsertSite: (site: SiteInput) => Promise<VaultSnapshot>;
  deleteSite: (siteId: string) => Promise<VaultSnapshot>;
  upsertBookmark: (siteId: string, bookmark: BookmarkInput) => Promise<VaultSnapshot>;
  deleteBookmark: (siteId: string, bookmarkId: string) => Promise<VaultSnapshot>;
  upsertCredential: (siteId: string, credential: CredentialInput) => Promise<VaultSnapshot>;
  deleteCredential: (siteId: string, credentialId: string) => Promise<VaultSnapshot>;
  generatePassword: (length?: number) => Promise<string>;
  exportData: () => Promise<string>;
  importData: (json: string) => Promise<VaultSnapshot>;
  discoverBrowserBookmarks: () => Promise<BrowserBookmarkSource[]>;
  previewBrowserBookmarks: (request: BrowserBookmarkImportRequest) => Promise<BrowserBookmarkImportPreview>;
  mergeBrowserBookmarks: (request: BrowserBookmarkImportRequest) => Promise<BrowserBookmarkImportResult>;
};

export function createVaultApi(invokeFn: InvokeFn): VaultApi {
  return {
    getStatus: () => invokeFn<VaultStatus>('get_vault_status'),
    setup: (masterPassword, hint) =>
      invokeFn<VaultSnapshot>('setup_vault', { masterPassword, hint }),
    unlock: (masterPassword) =>
      invokeFn<VaultSnapshot>('unlock_vault', { masterPassword }),
    lock: () => invokeFn<VaultStatus>('lock_vault'),
    getSnapshot: () => invokeFn<VaultSnapshot>('get_vault_snapshot'),
    upsertSite: (site) => invokeFn<VaultSnapshot>('upsert_site', { site }),
    deleteSite: (siteId) => invokeFn<VaultSnapshot>('delete_site', { siteId }),
    upsertBookmark: (siteId, bookmark) =>
      invokeFn<VaultSnapshot>('upsert_bookmark', { siteId, bookmark }),
    deleteBookmark: (siteId, bookmarkId) =>
      invokeFn<VaultSnapshot>('delete_bookmark', { siteId, bookmarkId }),
    upsertCredential: (siteId, credential) =>
      invokeFn<VaultSnapshot>('upsert_credential', { siteId, credential }),
    deleteCredential: (siteId, credentialId) =>
      invokeFn<VaultSnapshot>('delete_credential', { siteId, credentialId }),
    generatePassword: (length = 18) => invokeFn<string>('generate_password', { length }),
    exportData: () => invokeFn<string>('export_vault_data'),
    importData: (json) => invokeFn<VaultSnapshot>('import_vault_data', { json }),
    discoverBrowserBookmarks: () => invokeFn<BrowserBookmarkSource[]>('discover_browser_bookmarks'),
    previewBrowserBookmarks: (request) => invokeFn<BrowserBookmarkImportPreview>('preview_browser_bookmarks', { request }),
    mergeBrowserBookmarks: (request) => invokeFn<BrowserBookmarkImportResult>('merge_browser_bookmarks', { request }),
  };
}

export const vaultApi = createVaultApi(invoke as InvokeFn);
