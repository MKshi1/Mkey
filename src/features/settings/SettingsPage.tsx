import { Download, Lock, Upload } from 'lucide-react';
import type { ThemeMode, VaultStats } from '../vault/types';

const themeOptions: Array<{
  id: ThemeMode;
  label: string;
  colors: [string, string, string];
}> = [
  { id: 'neon', label: '霓虹夜色', colors: ['#17141c', '#ff5ea8', '#27c7cf'] },
  { id: 'pearl', label: '珍珠冷白', colors: ['#f5f6f8', '#c2185b', '#0f8494'] },
  { id: 'warm', label: '杏白暖光', colors: ['#f8f5f3', '#b84a52', '#5f7d69'] },
  { id: 'minimal', label: '墨白极简', colors: ['#f7f7f6', '#202124', '#74747b'] },
];

export function SettingsPage(props: {
  siteCount: number;
  folderCount: number;
  stats: VaultStats;
  busy: boolean;
  themeMode: ThemeMode;
  onLock: () => void;
  onImport: () => void;
  onLegacyImport: () => void;
  onBrowserImport: () => void;
  onExport: () => void;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  return (
    <>
      <section className="page-heading">
        <h1>设置</h1>
      </section>
      <section className="settings-stack">
        <article className="settings-card theme-settings">
          <div>
            <h3>主题配色</h3>
          </div>
          <div aria-label="主题配色" className="theme-options" role="radiogroup">
            {themeOptions.map((theme) => (
              <button
                aria-checked={props.themeMode === theme.id}
                aria-label={theme.label}
                className={props.themeMode === theme.id ? 'theme-option active' : 'theme-option'}
                key={theme.id}
                role="radio"
                type="button"
                onClick={() => props.onThemeChange(theme.id)}
              >
                <span className="theme-swatches" aria-hidden="true">
                  {theme.colors.map((color) => <span key={color} style={{ backgroundColor: color }} />)}
                </span>
                <span>{theme.label}</span>
              </button>
            ))}
          </div>
        </article>
        <article className="settings-card">
          <div>
            <h3>保险库状态</h3>
          </div>
          <div className="settings-actions">
            <button className="btn btn-primary" disabled={props.busy} type="button" onClick={props.onLock}>
              <Lock size={15} />
              锁定保险库
            </button>
          </div>
        </article>
        <article className="settings-card">
          <div>
            <h3>导入与导出</h3>
          </div>
          <div className="settings-actions">
            <button className="btn btn-secondary" type="button" onClick={props.onImport}>
              <Upload size={15} />
              导入 MKey 数据
            </button>
            <button className="btn btn-secondary" type="button" onClick={props.onLegacyImport}>
              <Upload size={15} />
              迁移旧版账密
            </button>
            <button className="btn btn-secondary" type="button" onClick={props.onBrowserImport}>
              <Upload size={15} />
              导入浏览器书签
            </button>
            <button className="btn btn-primary" type="button" onClick={props.onExport}>
              <Download size={15} />
              导出
            </button>
          </div>
        </article>
        <article className="settings-card">
          <div>
            <h3>数据概览</h3>
          </div>
          <div className="settings-metrics">
            <span className="pill pill-emphasis">网站 {props.siteCount}</span>
            <span className="pill pill-soft">非网站 {props.folderCount}</span>
            <span className="pill pill-secondary">书签 {props.stats.bookmarkCount}</span>
            <span className="pill pill-secondary">账密 {props.stats.credentialCount}</span>
          </div>
        </article>
      </section>
    </>
  );
}
