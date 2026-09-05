import { ExternalLink, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { IconButton } from '../../shared/IconButton';
import type { BookmarkRecord } from '../vault/types';

export function BookmarkList(props: {
  bookmarks: BookmarkRecord[];
  onAdd: () => void;
  onOpen: (bookmark: BookmarkRecord) => void;
  onEdit: (bookmark: BookmarkRecord) => void;
  onDelete: (bookmark: BookmarkRecord) => void;
}) {
  if (props.bookmarks.length === 0) {
    return (
      <div className="inline-empty bookmark-empty">
        <span>这个网站还没有书签。</span>
        <button className="btn btn-secondary btn-small" type="button" onClick={props.onAdd}>
          <Plus size={14} />
          添加书签
        </button>
      </div>
    );
  }

  return (
    <div className="bookmark-list">
      {props.bookmarks.map((bookmark) => (
        <div className="bookmark-item" key={bookmark.id}>
          <div className="bookmark-main">
            <div className="bookmark-title-row">
              <strong>{bookmark.title}</strong>
              {bookmark.pinned ? <span className="pill pill-emphasis"><Pin size={11} />已置顶</span> : null}
            </div>
            <span>{bookmark.url}</span>
            {bookmark.description ? <p>{bookmark.description}</p> : null}
          </div>
          <div className="bookmark-actions">
            <IconButton label="打开书签" onClick={() => props.onOpen(bookmark)}>
              <ExternalLink size={13} />
            </IconButton>
            <IconButton label="编辑书签" onClick={() => props.onEdit(bookmark)}>
              <Pencil size={13} />
            </IconButton>
            <IconButton danger label="删除书签" onClick={() => props.onDelete(bookmark)}>
              <Trash2 size={13} />
            </IconButton>
          </div>
        </div>
      ))}
      <button className="btn btn-secondary btn-small" type="button" onClick={props.onAdd}>
        <Plus size={14} />
        添加书签
      </button>
    </div>
  );
}
