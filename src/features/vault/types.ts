export type Page = 'vault' | 'search' | 'settings';
export type ViewMode = 'card' | 'list';
export type ThemeMode = 'neon' | 'pearl' | 'warm' | 'minimal';
export type EntryKind = 'site' | 'folder';

export type VaultStatus = {
  configured: boolean;
  unlocked: boolean;
  hint: string | null;
};

export type VaultStats = {
  siteCount: number;
  bookmarkCount: number;
  credentialCount: number;
  favoriteCount: number;
  weakPasswordCount: number;
};

export type BookmarkRecord = {
  id: string;
  title: string;
  url: string;
  description: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CredentialRecord = {
  id: string;
  label: string;
  username: string;
  password: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type SiteRecord = {
  id: string;
  kind: EntryKind;
  name: string;
  domain: string;
  description: string;
  tags: string[];
  accent: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  bookmarks: BookmarkRecord[];
  credentials: CredentialRecord[];
};

export type VaultSnapshot = {
  hint: string | null;
  sites: SiteRecord[];
  stats: VaultStats;
};

export type BrowserBookmarkSource = {
  id: string;
  browser: string;
  profile: string;
  format: string;
};

export type HtmlBookmarkFile = { name: string; contents: string };

export type BrowserBookmarkImportRequest = {
  sourceIds: string[];
  htmlFiles: HtmlBookmarkFile[];
};

export type BrowserBookmarkImportPreview = {
  discoveredBookmarkCount: number;
  importableBookmarkCount: number;
  skippedInvalidCount: number;
  skippedDuplicateCount: number;
  newSiteCount: number;
  existingSiteCount: number;
};

export type BrowserBookmarkImportResult = {
  preview: BrowserBookmarkImportPreview;
  addedBookmarkCount: number;
};

export type EntryForm = {
  id: string;
  kind: EntryKind;
  name: string;
  domain: string;
  description: string;
  tags: string;
  accent: string;
  favorite: boolean;
};

export type BookmarkForm = {
  id: string;
  title: string;
  url: string;
  description: string;
  pinned: boolean;
};

export type CredentialForm = {
  id: string;
  label: string;
  username: string;
  password: string;
  note: string;
};

export type SiteInput = Omit<EntryForm, 'id' | 'tags'> & {
  id: string | null;
  tags: string[];
};

export type BookmarkInput = Omit<BookmarkForm, 'id'> & {
  id: string | null;
};

export type CredentialInput = Omit<CredentialForm, 'id'> & {
  id: string | null;
};
