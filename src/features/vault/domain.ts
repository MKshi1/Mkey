import type { SiteRecord } from './types';

function searchableText(entry: SiteRecord): string {
  return [
    entry.name,
    entry.domain,
    entry.description,
    ...entry.tags,
    ...entry.bookmarks.flatMap((bookmark) => [bookmark.title, bookmark.url, bookmark.description]),
    ...entry.credentials.flatMap((credential) => [credential.label, credential.username, credential.note]),
  ]
    .join(' ')
    .toLocaleLowerCase();
}

export function filterEntries(entries: SiteRecord[], query: string): SiteRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return entries;
  }

  return entries.filter((entry) => searchableText(entry).includes(normalizedQuery));
}

export function resolveEntryUrl(entry: SiteRecord): string {
  if (entry.kind === 'folder') {
    return '';
  }

  const bookmark = entry.bookmarks.find((candidate) => candidate.pinned) ?? entry.bookmarks[0];
  if (bookmark?.url) {
    return bookmark.url;
  }

  if (!entry.domain) {
    return '';
  }

  return /^https?:\/\//i.test(entry.domain) ? entry.domain : `https://${entry.domain}`;
}

export function formatRuntimeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("reading 'invoke'") ||
    message.includes('reading "invoke"') ||
    message.includes('__TAURI_INTERNALS__')
  ) {
    return '浏览器预览无法访问本地保险库，请通过桌面应用运行 MKey。';
  }
  return message;
}
