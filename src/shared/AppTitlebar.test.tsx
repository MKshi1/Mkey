import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppTitlebar } from './AppTitlebar';

const windowApi = vi.hoisted(() => ({
  close: vi.fn(),
  isMaximized: vi.fn(),
  minimize: vi.fn(),
  onResized: vi.fn(),
  startDragging: vi.fn(),
  toggleMaximize: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => windowApi,
}));

describe('AppTitlebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    windowApi.isMaximized.mockResolvedValue(false);
    windowApi.onResized.mockResolvedValue(vi.fn());
  });

  it('uses native window controls without treating buttons as drag targets', async () => {
    render(<AppTitlebar platform="windows" />);

    await fireEvent.click(screen.getByRole('button', { name: '最小化' }));
    await fireEvent.click(screen.getByRole('button', { name: '最大化或还原' }));
    await fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    expect(windowApi.minimize).toHaveBeenCalledOnce();
    expect(windowApi.toggleMaximize).toHaveBeenCalledOnce();
    expect(windowApi.close).toHaveBeenCalledOnce();
    expect(windowApi.startDragging).not.toHaveBeenCalled();
  });

  it('starts native dragging and toggles maximize from the title area', async () => {
    render(<AppTitlebar platform="windows" />);
    const dragRegion = screen.getByLabelText('拖动窗口');

    await fireEvent.pointerDown(dragRegion, { button: 0 });
    await fireEvent.doubleClick(dragRegion);

    expect(windowApi.startDragging).toHaveBeenCalledOnce();
    expect(windowApi.toggleMaximize).toHaveBeenCalledOnce();
  });

  it('does not render outside Windows', () => {
    const { container } = render(<AppTitlebar platform="macos" />);
    expect(container.childElementCount).toBe(0);
  });

  it('shows a restore control when the native window is maximized', async () => {
    windowApi.isMaximized.mockResolvedValue(true);
    render(<AppTitlebar platform="windows" />);
    expect(await screen.findByTitle('还原窗口')).not.toBeNull();
  });
});
