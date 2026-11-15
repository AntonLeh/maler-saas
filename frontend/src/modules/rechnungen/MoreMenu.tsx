// „⋯ Mehr“-Menü für eine Rechnungszeile
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export type MenuItem = { label: string; onClick: () => void; danger?: boolean; separator?: boolean };

export default function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  // Menü fest am Bildschirm ausrichten, damit es nicht von der Tabelle abgeschnitten wird
  const toggle = () => {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      const w = 260;
      const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
      const below = window.innerHeight - r.bottom;
      setPos({ top: below > 320 ? r.bottom + 4 : Math.max(8, r.top - 4 - Math.min(360, items.length * 40 + 24)), left });
    }
    setOpen((o) => !o);
  };
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const off = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", off, true);
    window.addEventListener("resize", off);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", off, true);
      window.removeEventListener("resize", off);
    };
  }, [open]);
  if (!items.length) return null;
  return (
    <div className="rv-more" ref={ref}>
      <button ref={btn} type="button" className="rv-more-btn" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        <MoreHorizontal size={18} aria-hidden="true" /> <span>Mehr</span>
      </button>
      {open && (
        <div className="rv-menu" role="menu" style={pos ? { top: pos.top, left: pos.left } : undefined}>
          {items.map((it, i) => (
            <div key={i}>
              {it.separator && <hr />}
              <button
                type="button"
                role="menuitem"
                className={it.danger ? "danger" : ""}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
              >
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
