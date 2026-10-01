import { useEffect, useState } from 'react';
import { toUserMessage } from '../api/errorMessages';

interface Props {
  title: string;
  /** Fetches the PDF and returns a blob URL; the preview revokes it on close. */
  load: () => Promise<string>;
  onClose: () => void;
}

/** A bearer-protected PDF in an overlay: fetched as a blob, shown in an iframe. */
export default function PdfPreview({ title, load, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    load().then((u) => { if (cancelled) URL.revokeObjectURL(u); else { revoke = u; setUrl(u); } })
      .catch((e) => { if (!cancelled) setError(toUserMessage(e, 'Could not load the PDF')); });
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [load]);

  return (
    <div className="slide-overlay" role="dialog" aria-label={title}>
      <aside className="slide-panel" style={{ width: 'min(900px, 96vw)' }}>
        <div className="slide-head">
          <h3>{title}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {url && <a className="ghost sm" href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Open in new tab</a>}
            <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="slide-body" style={{ padding: 0, display: 'block' }}>
          {error && <div className="error" role="alert" style={{ margin: 16 }}>{error}</div>}
          {!error && !url && <p className="muted" style={{ margin: 16 }}>Loading PDF…</p>}
          {url && <iframe title={title} src={url} data-testid="pdf-preview" style={{ width: '100%', height: 'calc(100vh - 90px)', border: 'none', background: '#fff' }} />}
        </div>
      </aside>
    </div>
  );
}
