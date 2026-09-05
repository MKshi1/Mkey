import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  BadgePlus,
  Bookmark,
  Download,
  FolderPlus,
  FolderTree,
  Globe2,
  LayoutGrid,
  List,
  Lock,
  Palette,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
} from 'lucide-react';
import { BookmarkEditorDialog } from '../features/bookmarks/BookmarkEditorDialog';
import { BrowserBookmarkImportDialog } from '../features/import/BrowserBookmarkImportDialog';
import { CredentialEditorDialog } from '../features/credentials/CredentialEditorDialog';
import { EntryCard } from '../features/entries/EntryCard';
import { EntryEditorDialog } from '../features/entries/EntryEditorDialog';
import { SearchPage } from '../features/search/SearchPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { vaultApi } from '../features/vault/api';
import { filterEntries, formatRuntimeError, resolveEntryUrl } from '../features/vault/domain';
import type {
  BookmarkForm,
  BookmarkInput,
  BookmarkRecord,
  CredentialForm,
  CredentialInput,
  CredentialRecord,
  EntryForm,
  EntryKind,
  Page,
  SiteInput,
  SiteRecord,
  ThemeMode,
  VaultSnapshot,
  VaultStats,
  VaultStatus,
  ViewMode,
} from '../features/vault/types';
import { Field } from '../shared/EditorDialog';
import { DockButton, StatCard } from '../shared/ui';

const APP_NAME = 'MKey';
const themeModes: ThemeMode[] = ['neon', 'pearl', 'warm', 'minimal'];
const themeLabels: Record<ThemeMode, string> = {
  neon: '霓虹夜色',
  pearl: '珍珠冷白',
  warm: '杏白暖光',
  minimal: '墨白极简',
};
const accentOptions = ['#C2185B', '#0F8494', '#5F7D69', '#D06B54', '#7C6BAF', '#49535F'];

const emptyStats: VaultStats = {
  siteCount: 0,
  bookmarkCount: 0,
  credentialCount: 0,
  favoriteCount: 0,
  weakPasswordCount: 0,
};

function emptyEntryForm(kind: EntryKind = 'site'): EntryForm {
  return {
    id: '',
    kind,
    name: '',
    domain: '',
    description: '',
    tags: '',
    accent: accentOptions[0],
    favorite: false,
  };
}

function emptyBookmarkForm(): BookmarkForm {
  return { id: '', title: '', url: '', description: '', pinned: false };
}

function emptyCredentialForm(): CredentialForm {
  return { id: '', label: '', username: '', password: '', note: '' };
}

function entryForm(entry: SiteRecord): EntryForm {
  return {
    id: entry.id,
    kind: entry.kind,
    name: entry.name,
    domain: entry.domain,
    description: entry.description,
    tags: entry.tags.join(', '),
    accent: entry.accent,
    favorite: entry.favorite,
  };
}

function bookmarkForm(bookmark: BookmarkRecord): BookmarkForm {
  return {
    id: bookmark.id,
    title: bookmark.title,
    url: bookmark.url,
    description: bookmark.description,
    pinned: bookmark.pinned,
  };
}

function credentialForm(credential: CredentialRecord): CredentialForm {
  return {
    id: credential.id,
    label: credential.label,
    username: credential.username,
    password: credential.password,
    note: credential.note,
  };
}

export function MKeyApp() {
  const [page, setPage] = useState<Page>('vault');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem('mkey-view-mode') === 'card' ? 'card' : 'list';
    } catch {
      return 'list';
    }
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const savedTheme = localStorage.getItem('mkey-theme-v2');
      return themeModes.includes(savedTheme as ThemeMode) ? savedTheme as ThemeMode : 'minimal';
    } catch {
      return 'minimal';
    }
  });
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [authError, setAuthError] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [setupHint, setSetupHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [visibleCredentialIds, setVisibleCredentialIds] = useState<string[]>([]);
  const [entryEditor, setEntryEditor] = useState<{ open: boolean; form: EntryForm }>({
    open: false,
    form: emptyEntryForm(),
  });
  const [bookmarkEditor, setBookmarkEditor] = useState<{
    open: boolean;
    siteId: string;
    form: BookmarkForm;
  }>({ open: false, siteId: '', form: emptyBookmarkForm() });
  const [credentialEditor, setCredentialEditor] = useState<{
    open: boolean;
    siteId: string;
    form: CredentialForm;
  }>({ open: false, siteId: '', form: emptyCredentialForm() });
  const [browserImportOpen, setBrowserImportOpen] = useState(false);
  const [canUseTitlebarToolbar, setCanUseTitlebarToolbar] = useState(() => window.innerWidth >= 1200);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    const updateTitlebarToolbar = () => setCanUseTitlebarToolbar(window.innerWidth >= 1200);
    window.addEventListener('resize', updateTitlebarToolbar);
    return () => window.removeEventListener('resize', updateTitlebarToolbar);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    try {
      localStorage.setItem('mkey-theme-v2', themeMode);
    } catch {
      // Theme persistence is optional in restricted webviews.
    }
  }, [themeMode]);

  useEffect(() => {
    try {
      localStorage.setItem('mkey-view-mode', viewMode);
    } catch {
      // View preference is optional in restricted webviews.
    }
  }, [viewMode]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (page !== 'search') {
      return undefined;
    }
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [page]);

  const entries = snapshot?.sites ?? [];
  const filteredEntries = filterEntries(entries, deferredSearch);
  const siteCount = entries.filter((entry) => entry.kind === 'site').length;
  const folderCount = entries.filter((entry) => entry.kind === 'folder').length;
  const stats = snapshot?.stats ?? emptyStats;

  async function refreshStatus() {
    try {
      const currentStatus = await vaultApi.getStatus();
      setStatus(currentStatus);
      setSnapshot(currentStatus.unlocked ? await vaultApi.getSnapshot() : null);
    } catch (error) {
      setAuthError(formatRuntimeError(error));
    }
  }

  function applySnapshot(nextSnapshot: VaultSnapshot) {
    setSnapshot(nextSnapshot);
    setStatus({ configured: true, unlocked: true, hint: nextSnapshot.hint });
  }

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (setupPassword !== setupConfirmPassword) {
      setAuthError('两次输入的主密码不一致。');
      return;
    }

    setBusy(true);
    setAuthError('');
    try {
      applySnapshot(await vaultApi.setup(setupPassword, setupHint.trim() || null));
      setSetupPassword('');
      setSetupConfirmPassword('');
      setSetupHint('');
      setToast('保险库已创建。');
    } catch (error) {
      setAuthError(formatRuntimeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    try {
      applySnapshot(await vaultApi.unlock(unlockPassword));
      setUnlockPassword('');
      setToast('保险库已解锁。');
    } catch (error) {
      setAuthError(formatRuntimeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleLock() {
    setBusy(true);
    try {
      setStatus(await vaultApi.lock());
      setSnapshot(null);
      setVisibleCredentialIds([]);
      setEntryEditor({ open: false, form: emptyEntryForm() });
      setBookmarkEditor({ open: false, siteId: '', form: emptyBookmarkForm() });
      setCredentialEditor({ open: false, siteId: '', form: emptyCredentialForm() });
      setUnlockPassword('');
      setSetupPassword('');
      setSetupConfirmPassword('');
      setToast('保险库已锁定。');
    } catch (error) {
      setToast(formatRuntimeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    try {
      const payload = await vaultApi.exportData();
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `mkey-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setToast('数据已导出。');
    } catch (error) {
      setToast(formatRuntimeError(error));
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      applySnapshot(await vaultApi.importData(await file.text()));
      setToast('数据已导入。');
    } catch (error) {
      setToast(formatRuntimeError(error));
    } finally {
      event.target.value = '';
    }
  }

  async function mergeBrowserBookmarks(sourceIds: string[], htmlFiles: Array<{ name: string; contents: string }>) {
    setBusy(true);
    try {
      const result = await vaultApi.mergeBrowserBookmarks({ sourceIds, htmlFiles });
      applySnapshot(await vaultApi.getSnapshot());
      setBrowserImportOpen(false);
      setToast(`已合并 ${result.addedBookmarkCount} 个书签。`);
    } catch (error) {
      setToast(formatRuntimeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry(input: SiteInput) {
    setBusy(true);
    try {
      applySnapshot(await vaultApi.upsertSite(input));
      setEntryEditor({ open: false, form: emptyEntryForm() });
      setToast('条目已保存。');
    } catch (error) {
      setToast(formatRuntimeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveBookmark(input: BookmarkInput) {
    setBusy(true);
    try {
      applySnapshot(await vaultApi.upsertBookmark(bookmarkEditor.siteId, input));
      setBookmarkEditor({ open: false, siteId: '', form: emptyBookmarkForm() });
      setToast('书签已保存。');
    } catch (error) {
      setToast(formatRuntimeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveCredential(input: CredentialInput) {
    setBusy(true);
    try {
      applySnapshot(await vaultApi.upsertCredential(credentialEditor.siteId, input));
      setCredentialEditor({ open: false, siteId: '', form: emptyCredentialForm() });
      setToast('账号密码已保存。');
    } catch (error) {
      setToast(formatRuntimeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(entry: SiteRecord) {
    if (!window.confirm(`确认删除“${entry.name}”及其全部内容吗？`)) {
      return;
    }
    try {
      applySnapshot(await vaultApi.deleteSite(entry.id));
      setToast('条目已删除。');
    } catch (error) {
      setToast(formatRuntimeError(error));
    }
  }

  async function removeBookmark(siteId: string, bookmark: BookmarkRecord) {
    if (!window.confirm(`确认删除书签“${bookmark.title}”吗？`)) {
      return;
    }
    try {
      applySnapshot(await vaultApi.deleteBookmark(siteId, bookmark.id));
      setToast('书签已删除。');
    } catch (error) {
      setToast(formatRuntimeError(error));
    }
  }

  async function removeCredential(siteId: string, credential: CredentialRecord) {
    if (!window.confirm(`确认删除“${credential.label || credential.username}”吗？`)) {
      return;
    }
    try {
      applySnapshot(await vaultApi.deleteCredential(siteId, credential.id));
      setVisibleCredentialIds((current) => current.filter((id) => id !== credential.id));
      setToast('账号密码已删除。');
    } catch (error) {
      setToast(formatRuntimeError(error));
    }
  }

  async function openExternal(url: string) {
    try {
      await openUrl(url);
    } catch (error) {
      setToast(formatRuntimeError(error));
    }
  }

  async function openEntry(entry: SiteRecord) {
    const url = resolveEntryUrl(entry);
    if (!url) {
      setToast('这个条目没有可打开的网址。');
      return;
    }
    await openExternal(url);
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label}已复制。`);
    } catch {
      setToast(`复制${label}失败。`);
    }
  }

  function togglePassword(credentialId: string) {
    setVisibleCredentialIds((current) =>
      current.includes(credentialId)
        ? current.filter((id) => id !== credentialId)
        : [...current, credentialId],
    );
  }

  if (!status || !status.unlocked) {
    return (
      <div className="auth-shell compact-auth">
        <section className="auth-panel auth-panel-compact">
          {!status?.configured ? (
            <>
              <h1>{APP_NAME}</h1>
              <h2>创建主密码</h2>
              <form className="auth-form" onSubmit={handleSetup}>
                <Field label="主密码">
                  <input autoFocus required type="password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} />
                </Field>
                <Field label="确认主密码">
                  <input required type="password" value={setupConfirmPassword} onChange={(event) => setSetupConfirmPassword(event.target.value)} />
                </Field>
                <Field label="密码提示">
                  <input value={setupHint} onChange={(event) => setSetupHint(event.target.value)} />
                </Field>
                {authError ? <p className="form-error">{authError}</p> : null}
                <button className="btn btn-primary auth-submit" disabled={busy} type="submit">
                  <Lock size={15} />
                  创建保险库
                </button>
              </form>
            </>
          ) : (
            <>
              <h1>{APP_NAME}</h1>
              <h2>解锁保险库</h2>
              <form className="auth-form" onSubmit={handleUnlock}>
                <Field label="主密码">
                  <input autoFocus required type="password" value={unlockPassword} onChange={(event) => setUnlockPassword(event.target.value)} />
                </Field>
                {authError ? <p className="form-error">{authError}</p> : null}
                <button className="btn btn-primary auth-submit" disabled={busy} type="submit">
                  <Lock size={15} />
                  解锁
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    );
  }

  if (!snapshot) {
    return null;
  }

  const vaultActions = (
    <div className="vault-actions">
      <div className="layout-switcher" role="group" aria-label="条目显示方式">
        <button
          aria-pressed={viewMode === 'card'}
          className={`view-toggle${viewMode === 'card' ? ' active' : ''}`}
          type="button"
          onClick={() => setViewMode('card')}
        >
          <LayoutGrid size={15} />
          卡片
        </button>
        <button
          aria-pressed={viewMode === 'list'}
          className={`view-toggle${viewMode === 'list' ? ' active' : ''}`}
          type="button"
          onClick={() => setViewMode('list')}
        >
          <List size={15} />
          列表
        </button>
      </div>
      <button className="btn btn-secondary" type="button" onClick={() => importInputRef.current?.click()}>
        <Upload size={15} />
        导入
      </button>
      <button className="btn btn-secondary" type="button" onClick={() => void handleExport()}>
        <Download size={15} />
        导出
      </button>
      <button className="btn btn-secondary" type="button" onClick={() => setEntryEditor({ open: true, form: emptyEntryForm('folder') })}>
        <FolderPlus size={15} />
        添加非网站
      </button>
      <button className="btn btn-primary" type="button" onClick={() => setEntryEditor({ open: true, form: emptyEntryForm('site') })}>
        <BadgePlus size={15} />
        添加网站
      </button>
    </div>
  );
  const titlebarToolbarHost = document.getElementById('mkey-titlebar-toolbar');

  return (
    <div className="app-frame">
      <aside className="side-nav">
        <img alt={APP_NAME} className="brand-mark" src="/mkey-icon.png" />
        <div className="nav-items nav-items-compact">
          <DockButton active={page === 'vault'} icon={<Bookmark className="nav-item-icon" />} label="保险库" onClick={() => setPage('vault')} />
          <DockButton active={page === 'search'} icon={<Search className="nav-item-icon" />} label="搜索" onClick={() => setPage('search')} />
          <DockButton active={page === 'settings'} icon={<Settings2 className="nav-item-icon" />} label="设置" onClick={() => setPage('settings')} />
          <button
            aria-label={`切换主题，当前${themeLabels[themeMode]}`}
            className="nav-item"
            title={`当前：${themeLabels[themeMode]}`}
            type="button"
            onClick={() => setThemeMode((current) => themeModes[(themeModes.indexOf(current) + 1) % themeModes.length])}
          >
            <Palette className="nav-item-icon" />
          </button>
        </div>
      </aside>

      <main className="main-wrapper">
        {page === 'search' ? (
          <SearchPage
            entries={filteredEntries}
            inputRef={searchInputRef}
            search={search}
            onOpenEntry={(entry) => void openEntry(entry)}
            onOpenVault={() => setPage('vault')}
            onSearchChange={setSearch}
          />
        ) : page === 'settings' ? (
          <SettingsPage
            busy={busy}
            folderCount={folderCount}
            siteCount={siteCount}
            stats={stats}
            themeMode={themeMode}
            onExport={() => void handleExport()}
            onImport={() => importInputRef.current?.click()}
            onBrowserImport={() => setBrowserImportOpen(true)}
            onLock={() => void handleLock()}
            onThemeChange={setThemeMode}
          />
        ) : (
          <>
            {titlebarToolbarHost && canUseTitlebarToolbar
              ? createPortal(vaultActions, titlebarToolbarHost)
              : vaultActions}

            <section className="stats-row">
              <StatCard icon={<Globe2 size={18} />} label="网站" value={siteCount} />
              <StatCard icon={<FolderTree size={18} />} label="非网站" value={folderCount} />
              <StatCard icon={<Bookmark size={18} />} label="书签" value={stats.bookmarkCount} />
              <StatCard icon={<UserRound size={18} />} label="账密" value={stats.credentialCount} />
              <StatCard icon={<ShieldCheck size={18} />} label="弱密码" value={stats.weakPasswordCount} />
            </section>

            <section className={`entry-board is-${viewMode}`}>
              {entries.length === 0 ? (
                <div className="empty-state-card">
                  <Sparkles size={20} />
                  <p>还没有条目</p>
                </div>
              ) : entries.map((entry) => (
                <EntryCard
                  entry={entry}
                  key={entry.id}
                  viewMode={viewMode}
                  visibleCredentialIds={visibleCredentialIds}
                  onAddBookmark={() => setBookmarkEditor({ open: true, siteId: entry.id, form: emptyBookmarkForm() })}
                  onAddCredential={() => setCredentialEditor({ open: true, siteId: entry.id, form: emptyCredentialForm() })}
                  onCopyPassword={(value) => void copyText(value, '密码')}
                  onCopyUsername={(value) => void copyText(value, '账号')}
                  onDeleteBookmark={(bookmark) => void removeBookmark(entry.id, bookmark)}
                  onDeleteCredential={(credential) => void removeCredential(entry.id, credential)}
                  onDeleteEntry={() => void removeEntry(entry)}
                  onEditBookmark={(bookmark) => setBookmarkEditor({ open: true, siteId: entry.id, form: bookmarkForm(bookmark) })}
                  onEditCredential={(credential) => setCredentialEditor({ open: true, siteId: entry.id, form: credentialForm(credential) })}
                  onEditEntry={() => setEntryEditor({ open: true, form: entryForm(entry) })}
                  onOpenBookmark={(bookmark) => void openExternal(bookmark.url)}
                  onOpenEntry={() => void openEntry(entry)}
                  onTogglePassword={togglePassword}
                />
              ))}
            </section>
          </>
        )}
      </main>

      {entryEditor.open ? (
        <EntryEditorDialog
          busy={busy}
          initial={entryEditor.form}
          key={`${entryEditor.form.id || 'new'}-${entryEditor.form.kind}`}
          onClose={() => setEntryEditor({ open: false, form: emptyEntryForm() })}
          onSubmit={saveEntry}
        />
      ) : null}
      {bookmarkEditor.open ? (
        <BookmarkEditorDialog
          busy={busy}
          initial={bookmarkEditor.form}
          key={bookmarkEditor.form.id || 'new-bookmark'}
          onClose={() => setBookmarkEditor({ open: false, siteId: '', form: emptyBookmarkForm() })}
          onSubmit={saveBookmark}
        />
      ) : null}
      {credentialEditor.open ? (
        <CredentialEditorDialog
          busy={busy}
          initial={credentialEditor.form}
          key={credentialEditor.form.id || 'new-credential'}
          onClose={() => setCredentialEditor({ open: false, siteId: '', form: emptyCredentialForm() })}
          onGeneratePassword={() => vaultApi.generatePassword(18)}
          onSubmit={saveCredential}
        />
      ) : null}
      {browserImportOpen ? (
        <BrowserBookmarkImportDialog
          busy={busy}
          onClose={() => setBrowserImportOpen(false)}
          onMerge={mergeBrowserBookmarks}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
      <input
        accept="application/json"
        className="hidden-file-input"
        ref={importInputRef}
        type="file"
        onChange={handleImport}
      />
    </div>
  );
}
