import { ArrowUpRight, FolderKanban, KeyRound, Link2 } from 'lucide-react';
import { entryCategory, entryWorkspace, workspaceNames } from '../vault/domain';
import type { SiteRecord } from '../vault/types';

export function SpacesPage(props: {
  entries: SiteRecord[];
  onOpenWorkspace: (workspace: string) => void;
}) {
  const spaces = workspaceNames(props.entries);
  const uncategorized = props.entries.filter((entry) => !entryWorkspace(entry));

  return (
    <>
      <section className="page-heading spaces-heading">
        <div>
          <h1>空间</h1>
          <p>按项目和场景收拢入口、书签与账号。</p>
        </div>
      </section>
      <section className="space-grid">
        {spaces.map((space) => {
          const entries = props.entries.filter((entry) => entryWorkspace(entry) === space);
          const bookmarks = entries.reduce((total, entry) => total + entry.bookmarks.length, 0);
          const credentials = entries.reduce((total, entry) => total + entry.credentials.length, 0);
          return (
            <button className="space-card" key={space} type="button" onClick={() => props.onOpenWorkspace(space)}>
              <span className="space-card-icon"><FolderKanban size={18} /></span>
              <strong>{space}</strong>
              <span className="space-card-meta"><Link2 size={14} /> {entries.length} 个入口</span>
              <span className="space-card-meta"><KeyRound size={14} /> {bookmarks + credentials} 项内容</span>
              <ArrowUpRight className="space-card-open" size={17} />
            </button>
          );
        })}
        {uncategorized.length ? (
          <button className="space-card space-card-muted" type="button" onClick={() => props.onOpenWorkspace('')}>
            <span className="space-card-icon"><FolderKanban size={18} /></span>
            <strong>待整理</strong>
            <span className="space-card-meta">{uncategorized.length} 个尚未归入空间的入口</span>
            <span className="space-card-meta">常见分类：{[...new Set(uncategorized.map(entryCategory))].join('、')}</span>
            <ArrowUpRight className="space-card-open" size={17} />
          </button>
        ) : null}
        {!spaces.length && !uncategorized.length ? <div className="empty-state-card">还没有空间，编辑任意条目即可创建。</div> : null}
      </section>
    </>
  );
}
