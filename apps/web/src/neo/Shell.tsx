/**
 * The deck's chassis: glass topbar with the `NeoPi / deck / Page` lockup and
 * the presence row, the naked grouped sidebar, one inset panel. Pages render
 * inside the panel and own their columns; there are no shell-level toggles.
 * See docs/design/neodeck-architecture.md §3.
 */
import { LogOut, Menu, Mic, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BrandLockup } from "@/components/BrandLockup";
import { EngineChip } from "@/components/EngineChip";
import { Kbd, NeoButton } from "@/components/neo";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { auth, useAccount } from "./client/auth";
import { usePresence } from "./client/presence";
import { Avatar } from "./components/Avatar";
import { NAV, NAV_ITEMS, navItemForPath } from "./nav";

export function Shell() {
	const location = useLocation();
	const page = navItemForPath(location.pathname)?.label;
	const [navOpen, setNavOpen] = useState(false);
	useJumpShortcuts();
	useEffect(() => setNavOpen(false), [location.pathname]);
	useEffect(() => {
		function onKey(e: KeyboardEvent): void {
			if (e.key === "Escape") setNavOpen(false);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return (
		<div className="relative flex h-full w-full flex-col bg-paper text-ink">
			<div className="neo-ambient" />
			<header className="neo-topbar">
				<NeoButton variant="ghost" icon className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open navigation">
					<Menu size={16} />
				</NeoButton>
				<BrandLockup page={page} />
				<div className="neo-topbar-actions">
					<span className="hidden sm:inline-flex">
						<EngineChip />
					</span>
					<DictationButton />
					<ThemeToggle />
					<AccountChip />
				</div>
			</header>

			<div className="relative flex min-h-0 flex-1">
				{navOpen ? <button type="button" className="neo-scrim lg:hidden" aria-label="Close navigation" onClick={() => setNavOpen(false)} /> : null}
				<nav
					className={cn(
						"neo-sidebar absolute inset-y-0 left-0 z-[70] w-[260px] bg-paper transition-transform duration-200 ease-out lg:static lg:z-30 lg:w-[var(--sidebar-w)] lg:translate-x-0 lg:bg-transparent",
						navOpen ? "translate-x-0 shadow-[var(--neo-shadow-3)]" : "-translate-x-[102%]",
					)}
					aria-label="Pages"
				>
					<div className="flex items-center justify-between px-2 pb-1 lg:hidden">
						<span className="neo-nav-heading pb-0">Pages</span>
						<NeoButton variant="ghost" icon size="sm" onClick={() => setNavOpen(false)} aria-label="Close navigation">
							<X size={14} />
						</NeoButton>
					</div>
					<SideNav />
				</nav>

				<main className="neo-panel ml-2 lg:ml-0">
					<div className="relative flex min-w-0 flex-1 flex-col">
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	);
}

function SideNav() {
	const location = useLocation();
	const current = navItemForPath(location.pathname);
	return (
		<>
			{NAV.map((group) => (
				<div key={group.heading} className="neo-nav-group">
					<div className="neo-nav-heading">{group.heading}</div>
					{group.items.map((item) => (
						<Link key={item.to} to={item.to} className="neo-nav-row group" data-active={current?.to === item.to} aria-current={current?.to === item.to ? "page" : undefined} title={item.label}>
							<item.icon size={15} />
							<span className="neo-nav-row-label">{item.label}</span>
							<span className="hidden text-[10.5px] text-ink-4 opacity-0 transition-opacity group-hover:opacity-100 lg:inline">G {item.hotkey.toUpperCase()}</span>
						</Link>
					))}
				</div>
			))}
			<PresenceFoot />
		</>
	);
}

/** Footer card: the office at a glance from every page. */
function PresenceFoot() {
	const presence = usePresence();
	return (
		<div className="neo-sidebar-foot">
			<Link to="/threads?filter=needs-you" className="flex items-center gap-2 text-ink-2 no-underline hover:text-ink">
				<span className="neo-dot" data-tone={presence.needsYou > 0 ? "accent" : undefined} data-pulse={presence.needsYou > 0 ? "true" : undefined} />
				<span className="truncate">
					{presence.needsYou === 0 ? "Nothing needs you" : `${presence.needsYou} need${presence.needsYou === 1 ? "s" : ""} you`}
				</span>
			</Link>
			<Link to="/agents" className="flex items-center gap-2 text-ink-2 no-underline hover:text-ink">
				<span className="neo-dot" data-tone={presence.working > 0 ? "live" : undefined} data-pulse={presence.working > 0 ? "true" : undefined} />
				<span className="truncate">{presence.working === 0 ? "No agents working" : `${presence.working} agent${presence.working === 1 ? "" : "s"} working`}</span>
			</Link>
			<div className="flex items-center gap-1">
				<Kbd>G</Kbd>
				<span>then a letter to jump</span>
			</div>
		</div>
	);
}

/** Who is signed in. Opens Usage; the menu holds sign out. */
function AccountChip() {
	const account = useAccount();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	if (!account) return null;
	return (
		<div className="relative">
			<button type="button" className="neo-chip" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} title={`${account.name} (@${account.handle}) · ${account.role}`}>
				<Avatar account={account} size={18} />
				<span>{account.name}</span>
				{account.role === "admin" ? <span className="neo-chip-detail">admin</span> : null}
			</button>
			{open ? (
				<>
					<button type="button" className="fixed inset-0 z-[80] cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
					<div className="neo-menu" role="menu">
						<button type="button" role="menuitem" className="neo-menu-item" onClick={() => { setOpen(false); navigate("/usage"); }}>
							Your usage
						</button>
						<button type="button" role="menuitem" className="neo-menu-item" onClick={() => { setOpen(false); navigate("/settings#accounts"); }}>
							Account
						</button>
						<div className="neo-menu-sep" />
						<button type="button" role="menuitem" className="neo-menu-item" onClick={() => { setOpen(false); void auth.logout().then(() => navigate("/login")); }}>
							<LogOut size={13} /> Sign out
						</button>
					</div>
				</>
			) : null}
		</div>
	);
}

function ThemeToggle() {
	const { active, set } = useTheme();
	const light = active === "neo-light" || active === "paper";
	return (
		<NeoButton variant="ghost" icon onClick={() => set(light ? "neo" : "neo-light")} aria-label={light ? "Switch to dark" : "Switch to light"} title={light ? "Dark" : "Light"}>
			{light ? <Moon size={16} /> : <Sun size={16} />}
		</NeoButton>
	);
}

/** Dictation is part of every surface; the chip shows the state of the microphone for the page. */
function DictationButton() {
	const navigate = useNavigate();
	return (
		<NeoButton variant="ghost" icon aria-label="Dictation" title="Dictation: hold V in any text field" onClick={() => navigate("/settings#dictation")}>
			<Mic size={16} />
		</NeoButton>
	);
}

/** `G` then a letter jumps to a page. Ignored while typing. */
function useJumpShortcuts(): void {
	const navigate = useNavigate();
	useEffect(() => {
		let armed = 0;
		function onKey(e: KeyboardEvent): void {
			const target = e.target as HTMLElement | null;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
			const now = Date.now();
			if (e.key === "g" || e.key === "G") {
				armed = now;
				return;
			}
			if (armed && now - armed < 1200) {
				const item = NAV_ITEMS.find((i) => i.hotkey === e.key.toLowerCase());
				armed = 0;
				if (item) {
					e.preventDefault();
					navigate(item.to);
				}
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [navigate]);
}

/** Boots the store (websocket, sessions) once the shell mounts behind the login gate. */
export function useDeckBootstrap(): void {
	const bootstrap = useStore((s) => s.bootstrap);
	useEffect(() => {
		void bootstrap();
	}, [bootstrap]);
}
