import { Minus, Square, SquareStack, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState, type PointerEvent } from 'react';

type Platform = 'windows' | 'macos' | 'linux';

function currentPlatform(): Platform {
  if (navigator.userAgent.includes('Windows')) return 'windows';
  if (navigator.userAgent.includes('Macintosh')) return 'macos';
  return 'linux';
}

export function AppTitlebar({ platform = currentPlatform() }: { platform?: Platform }) {
  if (platform !== 'windows') return null;

  return <WindowsTitlebar />;
}

function WindowsTitlebar() {
  const appWindow = getCurrentWindow();
  const [maximized, setMaximized] = useState(false);
  const stopPropagation = (event: PointerEvent<HTMLButtonElement>) => event.stopPropagation();

  useEffect(() => {
    let disposed = false;
    const refreshMaximized = async () => {
      const next = await appWindow.isMaximized();
      if (!disposed) setMaximized(next);
    };
    void refreshMaximized();
    let unlisten: (() => void) | undefined;
    void appWindow.onResized(() => { void refreshMaximized(); }).then((callback) => { unlisten = callback; });
    return () => { disposed = true; unlisten?.(); };
  }, [appWindow]);

  return (
    <header
      aria-label="MKey 窗口标题栏"
      className="app-titlebar"
    >
      <div className="app-titlebar-brand">
        <img alt="" src="/mkey-icon.png" />
        <span>MKey</span>
      </div>
      <div
        aria-label="拖动窗口"
        className="app-titlebar-drag-region"
        onDoubleClick={() => void appWindow.toggleMaximize()}
        onPointerDown={(event) => {
          if (event.button === 0) void appWindow.startDragging();
        }}
      />
      <div className="app-titlebar-toolbar" id="mkey-titlebar-toolbar" />
      <div aria-label="窗口控制" className="app-titlebar-controls">
        <button
          aria-label="最小化"
          className="titlebar-control"
          type="button"
          onClick={(event) => { event.stopPropagation(); void appWindow.minimize(); }}
          onPointerDown={stopPropagation}
        ><Minus size={16} /></button>
        <button
          aria-label="最大化或还原"
          className="titlebar-control"
          title={maximized ? '还原窗口' : '最大化窗口'}
          type="button"
          onClick={(event) => { event.stopPropagation(); void appWindow.toggleMaximize(); }}
          onPointerDown={stopPropagation}
        >{maximized ? <SquareStack size={15} /> : <Square size={13} />}</button>
        <button
          aria-label="关闭"
          className="titlebar-control titlebar-close"
          type="button"
          onClick={(event) => { event.stopPropagation(); void appWindow.close(); }}
          onPointerDown={stopPropagation}
        ><X size={17} /></button>
      </div>
    </header>
  );
}
