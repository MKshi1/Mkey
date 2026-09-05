import { Copy, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { IconButton } from '../../shared/IconButton';
import type { CredentialRecord } from '../vault/types';

function maskPassword(password: string) {
  return '*'.repeat(Math.max(password.length, 8));
}

export function CredentialList(props: {
  credentials: CredentialRecord[];
  visibleCredentialIds: string[];
  onAdd: () => void;
  onTogglePassword: (credentialId: string) => void;
  onCopyUsername: (username: string) => void;
  onCopyPassword: (password: string) => void;
  onEdit: (credential: CredentialRecord) => void;
  onDelete: (credential: CredentialRecord) => void;
}) {
  return (
    <div className="credential-mini-list">
      {props.credentials.length > 0 ? props.credentials.map((credential) => {
        const visible = props.visibleCredentialIds.includes(credential.id);
        return (
          <div className="credential-mini-item" key={credential.id}>
            <div className="credential-main">
              <strong>{credential.label || credential.username}</strong>
              <span>{credential.username}</span>
              {credential.note ? <span>{credential.note}</span> : null}
            </div>
            <div className="credential-password">
              <code>{visible ? credential.password : maskPassword(credential.password)}</code>
            </div>
            <div className="credential-actions">
              <IconButton label="复制账号" onClick={() => props.onCopyUsername(credential.username)}>
                <Copy size={13} />
              </IconButton>
              <IconButton label="复制密码" onClick={() => props.onCopyPassword(credential.password)}>
                <Copy size={13} />
              </IconButton>
              <IconButton label={visible ? '隐藏密码' : '显示密码'} onClick={() => props.onTogglePassword(credential.id)}>
                {visible ? <EyeOff size={13} /> : <Eye size={13} />}
              </IconButton>
              <IconButton label="编辑账密" onClick={() => props.onEdit(credential)}>
                <Pencil size={13} />
              </IconButton>
              <IconButton danger label="删除账密" onClick={() => props.onDelete(credential)}>
                <Trash2 size={13} />
              </IconButton>
            </div>
          </div>
        );
      }) : <div className="inline-empty">这个条目还没有账号密码。</div>}
      <button className="btn btn-secondary btn-small" type="button" onClick={props.onAdd}>
        <Plus size={14} />
        添加账号密码
      </button>
    </div>
  );
}
