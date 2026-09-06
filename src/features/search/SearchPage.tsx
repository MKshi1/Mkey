import type { RefObject } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { resolveEntryUrl } from '../vault/domain';
import type { SiteRecord } from '../vault/types';

export function SearchPage(props: {
  search: string;
  entries: SiteRecord[];
  inputRef: RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  onOpenEntry: (entry: SiteRecord) => void;
  onViewEntry: (entry: SiteRecord) => void;
}) {
  return (
    <>
      <section className="page-heading">
        <h1>搜索</h1>
      </section>
      <section className="toolbar">
        <div className="search-box search-box-wide">
          <Search className="search-icon" size={15} />
          <input
            aria-label="搜索保险库"
            placeholder="输入关键词实时搜索"
            ref={props.inputRef}
            value={props.search}
            onChange={(event) => props.onSearchChange(event.target.value)}
          />
        </div>
      </section>
      <section className="search-results">
        {!props.search.trim() ? (
          <div className="empty-state-card">
            <p>开始搜索</p>
          </div>
        ) : props.entries.length === 0 ? (
          <div className="empty-state-card">
            <p>没有搜索到结果</p>
          </div>
        ) : props.entries.map((entry) => (
          <article className="search-result-card" key={entry.id}>
            <div>
              <div className="entry-name-row">
                <strong>{entry.name}</strong>
                <span className={entry.kind === 'folder' ? 'pill pill-soft' : 'pill pill-emphasis'}>
                  {entry.kind === 'folder' ? '非网站' : '网站'}
                </span>
              </div>
              <div className="entry-subline">
                <span>{entry.domain || '无网址'}</span>
                <span>{entry.bookmarks.length} 个书签</span>
                <span>{entry.credentials.length} 组账密</span>
              </div>
              <div className="search-result-items">
                {entry.bookmarks.slice(0, 2).map((bookmark) => <span key={bookmark.id}>链接：{bookmark.title}</span>)}
                {entry.credentials.slice(0, 2).map((credential) => <span key={credential.id}>凭据：{credential.label || credential.username}</span>)}
              </div>
            </div>
            <div className="search-result-actions">
              {resolveEntryUrl(entry) ? (
                <button className="btn btn-secondary btn-small" type="button" onClick={() => props.onOpenEntry(entry)}>
                  <ExternalLink size={14} />
                  打开
                </button>
              ) : null}
              <button className="btn btn-primary btn-small" type="button" onClick={() => props.onViewEntry(entry)}>
                查看条目
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
