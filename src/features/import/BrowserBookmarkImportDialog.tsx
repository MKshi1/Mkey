import { useEffect, useRef, useState } from 'react';
import { FileUp, RefreshCw, Upload } from 'lucide-react';
import { vaultApi } from '../vault/api';
import type { BrowserBookmarkImportPreview, BrowserBookmarkSource, HtmlBookmarkFile } from '../vault/types';

export function BrowserBookmarkImportDialog(props: {
  busy: boolean;
  onClose: () => void;
  onMerge: (sourceIds: string[], htmlFiles: HtmlBookmarkFile[]) => Promise<void>;
}) {
  const [sources, setSources] = useState<BrowserBookmarkSource[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [files, setFiles] = useState<HtmlBookmarkFile[]>([]);
  const [preview, setPreview] = useState<BrowserBookmarkImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function refreshSources() {
    setLoading(true);
    setError('');
    try {
      const next = await vaultApi.discoverBrowserBookmarks();
      setSources(next);
      setSelected((current) => current.filter((id) => next.some((source) => source.id === id)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法发现本地浏览器书签。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refreshSources(); }, []);

  async function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next = await Promise.all(Array.from(fileList).map(async (file) => ({ name: file.name, contents: await file.text() })));
    setFiles(next);
    setPreview(null);
  }

  async function loadPreview() {
    setLoading(true);
    setError('');
    try {
      setPreview(await vaultApi.previewBrowserBookmarks({ sourceIds: selected, htmlFiles: files }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法分析书签。');
    } finally {
      setLoading(false);
    }
  }

  return <div className="dialog-overlay" role="presentation">
    <section aria-modal="true" className="dialog-panel browser-import-dialog" role="dialog">
      <div className="dialog-header"><div><h2>导入浏览器书签</h2></div><button aria-label="关闭" className="icon-button" type="button" onClick={props.onClose}>×</button></div>
      <div className="browser-import-section">
        <div className="section-row"><strong>本地浏览器</strong><button className="icon-button" disabled={loading} title="刷新" type="button" onClick={() => void refreshSources()}><RefreshCw size={16} /></button></div>
        {sources.length ? sources.map((source) => <label className="source-row" key={source.id}><input checked={selected.includes(source.id)} type="checkbox" onChange={(event) => { setSelected((current) => event.target.checked ? [...current, source.id] : current.filter((id) => id !== source.id)); setPreview(null); }} /><span>{source.browser} · {source.profile}</span></label>) : <p className="muted">未发现可读取的本地书签。</p>}
      </div>
      <div className="browser-import-section">
        <div className="section-row"><strong>书签导出文件</strong><button className="btn btn-secondary" type="button" onClick={() => fileRef.current?.click()}><FileUp size={15} />选择 HTML</button></div>
        {files.length ? <p className="muted">已选择：{files.map((file) => file.name).join('、')}</p> : null}
      </div>
      {preview ? <div className="import-preview"><span>发现 {preview.discoveredBookmarkCount}</span><span>可导入 {preview.importableBookmarkCount}</span><span>新网站 {preview.newSiteCount}</span><span>重复跳过 {preview.skippedDuplicateCount}</span><span>无效跳过 {preview.skippedInvalidCount}</span></div> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="dialog-actions"><button className="btn btn-secondary" type="button" onClick={props.onClose}>取消</button><button className="btn btn-secondary" disabled={loading || (!selected.length && !files.length)} type="button" onClick={() => void loadPreview()}><Upload size={15} />预览</button><button className="btn btn-primary" disabled={props.busy || !preview?.importableBookmarkCount} type="button" onClick={() => void props.onMerge(selected, files)}>合并导入</button></div>
      <input accept="text/html,.html,.htm" className="hidden-file-input" multiple ref={fileRef} type="file" onChange={(event) => void addFiles(event.target.files)} />
    </section>
  </div>;
}
