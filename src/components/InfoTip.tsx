import { useEffect, useRef, useState } from 'react';

/**
 * A small info icon that toggles a popover with explanatory text on click.
 * The popover is positioned within the containing panel and closes on
 * outside-click or Escape.
 */
export default function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="infotip" ref={ref}>
      <button
        type="button"
        className={open ? 'info-icon open' : 'info-icon'}
        aria-label="More information"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        <span className="material-symbols-outlined">info</span>
      </button>
      {open && <span className="infotip-pop" role="tooltip">{text}</span>}
    </span>
  );
}
