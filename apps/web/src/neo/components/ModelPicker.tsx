/**
 * The model picker: a mono chip that opens a 340 px sheet anchored to it,
 * with three rows of chips (roles · virtual models · providers as groups)
 * and one search that filters across all of them. Never a scrolling list of
 * every model. See docs/design/neodeck-architecture.md §5.
 */
import { ChevronDown, ChevronRight, EyeOff } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { SearchInput } from "@/components/neo";
import { cn } from "@/lib/utils";
import { useAccount } from "../client/auth";
import { type PickerCatalog, recentPicks, rememberPick, shortPick, useCatalog } from "../client/models";

export interface ModelPickerProps {
	value: string;
	onChange: (value: string) => void;
	/** Opens upward (for a composer at the bottom of a page). */
	above?: boolean;
	size?: "sm";
	className?: string;
	disabled?: boolean;
}

export function ModelPicker({ value, onChange, above, size, className, disabled }: ModelPickerProps) {
	const [open, setOpen] = useState(false);
	const catalog = useCatalog();
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function onDown(e: MouseEvent): void {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		}
		function onKey(e: globalThis.KeyboardEvent): void {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", onDown);
		window.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			window.removeEventListener("keydown", onKey);
		};
	}, [open]);

	function pick(v: string): void {
		rememberPick(v);
		onChange(v);
		setOpen(false);
	}

	return (
		<div ref={rootRef} className={cn("neo-picker", className)}>
			<button type="button" className="neo-chip neo-mono" data-size={size} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} title={value}>
				<span className="neo-picker-value">{value}</span>
				<ChevronDown size={12} />
			</button>
			{open ? <PickerSheet catalog={catalog} value={value} above={above} onPick={pick} /> : null}
		</div>
	);
}

function PickerSheet({ catalog, value, above, onPick }: { catalog: PickerCatalog | undefined; value: string; above?: boolean; onPick: (v: string) => void }) {
	const [q, setQ] = useState("");
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
	const account = useAccount();
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => inputRef.current?.focus(), []);

	const needle = q.trim().toLowerCase();
	const match = (s: string) => needle === "" || s.toLowerCase().includes(needle);
	const admin = account?.role === "admin";
	const recent = useMemo(() => recentPicks().filter(match).filter(value => admin || !catalog?.providers.some(provider => provider.hidden && provider.models.some(model => model.value === value))), [needle, admin, catalog]);

	const roles = catalog?.roles.filter((r) => match(r.name) || match(r.resolves ?? "")) ?? [];
	const virtual = catalog?.virtual.filter((v) => match(v.name) || match(v.chain)) ?? [];
	const providers =
		catalog?.providers
			.filter((p) => admin || !p.hidden)
			.map((p) => ({ ...p, models: needle === "" ? p.models : p.models.filter((m) => match(m.label) || match(p.label)) }))
			.filter((p) => p.models.length > 0) ?? [];

	function onKey(e: KeyboardEvent<HTMLDivElement>): void {
		if (e.key !== "Enter" || needle === "") return;
		const first = roles[0]?.value ?? virtual[0]?.value ?? providers[0]?.models[0]?.value;
		if (first) {
			e.preventDefault();
			onPick(first);
		}
	}

	return (
		<div className="neo-picker-sheet" data-above={above || undefined} role="dialog" aria-label="Choose a model" onKeyDown={onKey}>
			<SearchInput ref={inputRef} value={q} onChange={setQ} placeholder="Role, model or provider" size="sm" />
			{catalog === undefined ? (
				<div className="neo-picker-note">Loading the catalogue…</div>
			) : (
				<>
					{recent.length > 0 && needle === "" ? (
						<Row label="Recent">
							{recent.map((v) => (
								<Chip key={v} on={v === value} onClick={() => onPick(v)} title={v}>
									{shortPick(v)}
								</Chip>
							))}
						</Row>
					) : null}
					{roles.length > 0 ? (
						<Row label="Roles" hint="what the admin mapped for you">
							{roles.map((r) => (
								<Chip key={r.value} on={r.value === value} onClick={() => onPick(r.value)} title={r.resolves ? `${r.value} → ${r.resolves}` : r.value}>
									{r.name}
								</Chip>
							))}
						</Row>
					) : null}
					{virtual.length > 0 ? (
						<Row label="Virtual models">
							{virtual.map((v) => (
								<Chip key={v.value} on={v.value === value} onClick={() => onPick(v.value)} title={`${v.value}: ${v.chain}`}>
									{v.name}
								</Chip>
							))}
						</Row>
					) : null}
					<Row label="Providers">
						{providers.length === 0 ? <span className="neo-picker-note">{needle === "" ? "No provider is exposed to you on this deck yet." : "Nothing matches."}</span> : null}
						{providers.map((p) => {
							const expanded = needle !== "" || openGroups[p.id] || p.models.some((m) => m.value === value);
							return (
								<div key={p.id} className="neo-picker-group" data-open={expanded}>
									<button type="button" className="neo-picker-group-head" onClick={() => setOpenGroups((g) => ({ ...g, [p.id]: !expanded }))} aria-expanded={expanded}>
										{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
										<span>{p.label}</span>
										{p.hidden ? <EyeOff size={11} aria-label="hidden from members" /> : null}
										<span className="neo-picker-count">{p.models.length}</span>
									</button>
									{expanded ? (
										<div className="neo-picker-chips">
											{p.models.map((m) => (
												<Chip key={m.value} on={m.value === value} onClick={() => onPick(m.value)} title={m.value} mono>
													{m.label}
												</Chip>
											))}
										</div>
									) : null}
								</div>
							);
						})}
					</Row>
				</>
			)}
		</div>
	);
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
	return (
		<div className="neo-picker-row">
			<div className="neo-picker-label">
				<span>{label}</span>
				{hint ? <span className="neo-picker-hint">{hint}</span> : null}
			</div>
			<div className="neo-picker-chips">{children}</div>
		</div>
	);
}

function Chip({ on, onClick, title, mono, children }: { on: boolean; onClick: () => void; title?: string; mono?: boolean; children: React.ReactNode }) {
	return (
		<button type="button" className="neo-chip-btn" data-on={on} data-mono={mono || undefined} onClick={onClick} title={title}>
			{children}
		</button>
	);
}
