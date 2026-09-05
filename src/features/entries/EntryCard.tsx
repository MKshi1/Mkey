import { useId, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FolderTree, Globe2, Pencil, Trash2 } from 'lucide-react';
import { BookmarkList } from '../bookmarks/BookmarkList';
import { CredentialList } from '../credentials/CredentialList';
import { resolveEntryUrl } from '../vault/domain';
import type { BookmarkRecord, CredentialRecord, SiteRecord, ViewMode } from '../vault/types';
import { IconButton } from '../../shared/IconButton';

export function EntryCard(props: {
  entry: SiteRecord;
  viewMode: ViewMode;
  visibleCredentialIds: string[];
  onEditEntry: () => void;
  onDeleteEntry: () => void;
  onOpenEntry: () => void;
  onAddBookmark: () => void;
  onOpenBookmark: (bookmark: BookmarkRecord) => void;
  onEditBookmark: (bookmark: BookmarkRecord) => void;
  onDeleteBookmark: (bookmark: BookmarkRecord) => void;
  onAddCredential: () => void;
  onEditCredential: (credential: CredentialRecord) => void;
  onDeleteCredential: (credential: CredentialRecord) => void;
  onTogglePassword: (credentialId: string) => void;
  onCopyUsername: (username: string) => void;
  onCopyPassword: (password: string) => void;
}) {
  const { entry } = props;
  const entryUrl = resolveEntryUrl(entry);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  return (
    <article className={`entry-card ${props.viewMode}-mode`}>
      <div className="entry-headline">
        <div className="entry-title-wrap">
          <span className="entry-icon" style={{ backgroundColor: entry.accent }}>
            {entry.kind === 'folder' ? <FolderTree size={16} /> : <Globe2 size={16} />}
          </span>
          <div>
            <div className="entry-name-row">
              <strong>{entry.name}</strong>
              <span className={entry.kind === 'folder' ? 'pill pill-soft' : 'pill pill-emphasis'}>
                {entry.kind === 'folder' ? '非网站' : '网站'}
              </span>
            </div>
            <div className="entry-subline">
              <span>{entry.domain || '无网址'}</span>
              {entry.tags.length > 0 ? <span>{entry.tags.join(' / ')}</span> : null}
              <span>{entry.bookmarks.length} 个书签 / {entry.credentials.length} 组账密</span>
            </div>
          </div>
        </div>
        <div className="entry-actions">
          {entryUrl ? (
            <IconButton label="打开网站" onClick={props.onOpenEntry}>
              <ExternalLink size={14} />
            </IconButton>
          ) : null}
          <button
            aria-controls={detailsId}
            aria-expanded={expanded}
            aria-label={expanded ? '收起详情' : '展开详情'}
            className="btn-icon"
            title={expanded ? '收起详情' : '展开详情'}
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <IconButton label="编辑条目" onClick={props.onEditEntry}>
            <Pencil size={14} />
          </IconButton>
          <IconButton danger label="删除条目" onClick={props.onDeleteEntry}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>

      {expanded ? (
        <div className="entry-details" id={detailsId}>
          {entry.description ? <p className="entry-description">{entry.description}</p> : null}

          {entry.kind === 'site' ? (
            <section className="entry-section" aria-label={`${entry.name} 的书签`}>
              <div className="entry-section-heading">
                <strong>书签</strong>
                <span>{entry.bookmarks.length}</span>
              </div>
              <BookmarkList
                bookmarks={entry.bookmarks}
                onAdd={props.onAddBookmark}
                onDelete={props.onDeleteBookmark}
                onEdit={props.onEditBookmark}
                onOpen={props.onOpenBookmark}
              />
            </section>
          ) : null}

          <section className="entry-section" aria-label={`${entry.name} 的账号密码`}>
            <div className="entry-section-heading">
              <strong>账号密码</strong>
              <span>{entry.credentials.length}</span>
            </div>
            <CredentialList
              credentials={entry.credentials}
              visibleCredentialIds={props.visibleCredentialIds}
              onAdd={props.onAddCredential}
              onCopyPassword={props.onCopyPassword}
              onCopyUsername={props.onCopyUsername}
              onDelete={props.onDeleteCredential}
              onEdit={props.onEditCredential}
              onTogglePassword={props.onTogglePassword}
            />
          </section>
        </div>
      ) : null}
    </article>
  );
}
