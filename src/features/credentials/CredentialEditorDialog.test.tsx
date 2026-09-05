import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CredentialEditorDialog } from './CredentialEditorDialog';

describe('CredentialEditorDialog', () => {
  it('generates a password and submits the credential', async () => {
    const user = userEvent.setup();
    const onGeneratePassword = vi.fn().mockResolvedValue('GeneratedStrong!2026');
    const onSubmit = vi.fn();

    render(
      <CredentialEditorDialog
        busy={false}
        initial={{ id: '', label: '', username: '', password: '', note: '' }}
        onClose={() => undefined}
        onGeneratePassword={onGeneratePassword}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText('显示名称'), '管理员');
    await user.type(screen.getByLabelText('账号'), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: '生成密码' }));
    expect((screen.getByLabelText('密码') as HTMLInputElement).value).toBe('GeneratedStrong!2026');
    await user.click(screen.getByRole('button', { name: '保存账密' }));

    expect(onSubmit).toHaveBeenCalledWith({
      id: null,
      label: '管理员',
      username: 'owner@example.com',
      password: 'GeneratedStrong!2026',
      note: '',
    });
  });

  it('shows a local error when password generation fails', async () => {
    const user = userEvent.setup();

    render(
      <CredentialEditorDialog
        busy={false}
        initial={{ id: '', label: '', username: '', password: '', note: '' }}
        onClose={() => undefined}
        onGeneratePassword={vi.fn().mockRejectedValue(new Error('生成服务不可用'))}
        onSubmit={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: '生成密码' }));

    expect((await screen.findByRole('alert')).textContent).toContain('生成服务不可用');
    expect(screen.getByRole('button', { name: '生成密码' }).getAttribute('disabled')).toBeNull();
  });
});
