/**
 * Right-side glass sheet over a scrim, portalled to `document.body`, as in
 * `/stats`' request and span drawers. Esc and scrim clicks close it; focus
 * returns to the opener. A `footer` pins actions (Save, Delete) to the
 * bottom so forms inside never hide their buttons below the fold.
 */
import { X } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { NeoButton } from "./primitives";

export interface DrawerProps {
	open: boolean;
	onClose: () => void;
	title: ReactNode;
	subtitle?: ReactNode;
	/** Header controls left of the close button. */
	actions?: ReactNode;
	footer?: ReactNode;
	/** Sheet width in px. Default 560. */
	width?: number;
	children: ReactNode;
}

export function Drawer({ open, onClose, title, subtitle, actions, footer, width, children }: DrawerProps) {
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	const panelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		panelRef.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			e.preventDefault();
			e.stopPropagation();
			onCloseRef.current();
		};
		window.addEventListener("keydown", onKey, true);
		return () => {
			window.removeEventListener("keydown", onKey, true);
			opener?.focus();
		};
	}, [open]);

	if (!open) return null;
	return createPortal(
		<>
			<div className="neo-drawer-scrim" onClick={onClose} role="presentation" />
			<div ref={panelRef} className="neo-drawer" role="dialog" aria-modal="true" tabIndex={-1} style={width !== undefined ? ({ "--drawer-w": `${width}px` } as CSSProperties) : undefined}>
				<header className="neo-drawer-header">
					<div className="neo-drawer-titles">
						<h2 className="neo-drawer-title">{title}</h2>
						{subtitle !== undefined && <div className="neo-drawer-subtitle">{subtitle}</div>}
					</div>
					{actions}
					<NeoButton variant="ghost" icon onClick={onClose} aria-label="Close">
						<X size={16} />
					</NeoButton>
				</header>
				<div className="neo-drawer-body">{children}</div>
				{footer !== undefined && <footer className="neo-drawer-footer">{footer}</footer>}
			</div>
		</>,
		document.body,
	);
}

/** Small-caps-free section label inside drawers and cards (`Timing`, `Tokens`). */
export function SectionLabel({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
	return (
		<div className="neo-section-label">
			<span>{children}</span>
			{actions}
		</div>
	);
}
