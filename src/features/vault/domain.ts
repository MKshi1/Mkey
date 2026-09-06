import type { SiteRecord } from './types';

const WORKSPACE_PREFIX = '空间：';
const CATEGORY_PREFIX = '分类：';

function scopedTag(entry: SiteRecord, prefix: string) {
  return entry.tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length).trim() ?? '';
}

export function entryWorkspace(entry: SiteRecord) {
  return scopedTag(entry, WORKSPACE_PREFIX);
}

export function entryCategory(entry: SiteRecord) {
  const explicit = scopedTag(entry, CATEGORY_PREFIX);
  if (explicit) return explicit;
  const text = `${entry.name} ${entry.domain} ${entry.tags.join(' ')}`.toLocaleLowerCase();
  if (/(github|gitlab|stackoverflow|vercel|npmjs|rust|docker|cloudflare)/.test(text)) return '开发';
  if (/(openai|anthropic|gemini|huggingface|deepseek|ai\b|模型)/.test(text)) return 'AI';
  if (/(bank|pay|wallet|finance|证券|银行|支付)/.test(text)) return '金融';
  if (/(weibo|twitter|x\.com|reddit|bilibili|youtube|discord)/.test(text)) return '社交';
  return '工具';
}

export function visibleTags(entry: SiteRecord) {
  return entry.tags.filter((tag) => !tag.startsWith(WORKSPACE_PREFIX) && !tag.startsWith(CATEGORY_PREFIX));
}

export function workspaceNames(entries: SiteRecord[]) {
  return [...new Set(entries.map(entryWorkspace).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

export function mergeScopedTags(tags: string[], workspace: string, category: string) {
  const visible = tags.filter((tag) => !tag.startsWith(WORKSPACE_PREFIX) && !tag.startsWith(CATEGORY_PREFIX));
  if (workspace.trim()) visible.push(`${WORKSPACE_PREFIX}${workspace.trim()}`);
  if (category.trim()) visible.push(`${CATEGORY_PREFIX}${category.trim()}`);
  return [...new Set(visible)];
}

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
