import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Studio's inspector. It is a second inset panel docked to the right of the
 * page's panel, open only while something is being worked on (a node, the
 * graph's settings, its runs); with nothing selected the canvas takes the
 * width. When the shell provides its dock slot (#neo-dock) the panel portals
 * there; otherwise it renders beside the stage inside the page.
 */
export function StudioPanel({ title, subtitle, icon, onClose, footer, children }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; onClose: () => void; footer?: ReactNode; children: ReactNode }) {
 const root = useRef<HTMLElement>(null);
 const dock = typeof document === "undefined" ? null : document.getElementById("neo-dock");
 /* Escape closes from anywhere in the panel that is not a text field or an open popover. */
 useEffect(() => {
  const node = root.current; if (!node) return;
  const key = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented && !(event.target as HTMLElement).closest("[role='listbox'], [role='menu'], [role='dialog']")) { event.preventDefault(); onClose(); } };
  node.addEventListener("keydown", key); return () => node.removeEventListener("keydown", key);
 }, [onClose]);
 const panel = <aside ref={root} className="neo-studio-panel" data-docked={dock ? "true" : undefined} aria-label={typeof title === "string" ? title : "Inspector"}>
  <header className="neo-studio-panel-head">{icon}<div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div><button type="button" className="neo-btn" data-variant="ghost" data-icon="true" aria-label="Close panel" title="Close (Esc)" onClick={onClose}><X size={14} /></button></header>
  <div className="neo-studio-panel-body">{children}</div>
  {footer ? <footer className="neo-studio-panel-foot">{footer}</footer> : null}
 </aside>;
 return dock ? createPortal(panel, dock) : panel;
}
