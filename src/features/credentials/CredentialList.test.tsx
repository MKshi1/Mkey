import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CredentialList } from './CredentialList';
import type { CredentialRecord } from '../vault/types';

const credential: CredentialRecord = {
  id: 'credential-1',
  label: '管理员',
  username: 'owner@example.com',
  password: 'StrongPassword!2026',
  note: '生产环境',
  createdAt: '2026-09-04T00:00:00Z',
  updatedAt: '2026-09-04T00:00:00Z',
};

describe('CredentialList', () => {
  it('masks plaintext until the user reveals the credential', async () => {
    const user = userEvent.setup();
    const onTogglePassword = vi.fn();
    const view = render(
      <CredentialList
        credentials={[credential]}
        visibleCredentialIds={[]}
        onAdd={() => undefined}
        onCopyPassword={() => undefined}
        onCopyUsername={() => undefined}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onTogglePassword={onTogglePassword}
      />,
    );

    expect(view.container.textContent).not.toContain(credential.password);
    await user.click(screen.getByTitle('显示密码'));
    expect(onTogglePassword).toHaveBeenCalledWith(credential.id);

    view.rerender(
      <CredentialList
        credentials={[credential]}
        visibleCredentialIds={[credential.id]}
        onAdd={() => undefined}
        onCopyPassword={() => undefined}
        onCopyUsername={() => undefined}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onTogglePassword={onTogglePassword}
      />,
    );
    expect(view.container.textContent).toContain(credential.password);
  });

  it('exposes copy, edit, and delete actions for a credential', async () => {
    const user = userEvent.setup();
    const onCopyUsername = vi.fn();
    const onCopyPassword = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <CredentialList
        credentials={[credential]}
        visibleCredentialIds={[]}
        onAdd={() => undefined}
        onCopyPassword={onCopyPassword}
        onCopyUsername={onCopyUsername}
        onDelete={onDelete}
        onEdit={onEdit}
        onTogglePassword={() => undefined}
      />,
    );

    await user.click(screen.getByTitle('复制账号'));
    await user.click(screen.getByTitle('复制密码'));
    await user.click(screen.getByTitle('编辑账密'));
    await user.click(screen.getByTitle('删除账密'));

    expect(onCopyUsername).toHaveBeenCalledWith(credential.username);
    expect(onCopyPassword).toHaveBeenCalledWith(credential.password);
    expect(onEdit).toHaveBeenCalledWith(credential);
    expect(onDelete).toHaveBeenCalledWith(credential);
  });
});
