import {
	BookOpen,
	Clock,
	Eye,
	GitBranch,
	Home,
	Inbox,
	KanbanSquare,
	type LucideIcon,
	MessagesSquare,
	Network,
	Plug,
	Send,
	Settings,
	Sparkles,
	Store,
	Users,
	Workflow,
	Zap,
} from "lucide-react";

/**
 * The deck's information architecture. Order here is order on screen.
 *
 * Six groups, read top to bottom as "what do I do here":
 *   Work      — the front door: home, inbox, the board, conversations.
 *   Automate  — things that run without you.
 *   Agents    — the roster you talk to and compose.
 *   Library   — what the team knows and can do.
 *   Connect   — the engine and the outside world.
 *   Office    — people and this instance.
 *
 * `planned` marks an area that has a real page explaining what it will be
 * and that it is not built yet (see docs/vision in neocore). Hotkeys are
 * `g` then the letter, as in NeoPi's `/stats`.
 */
export interface NavItem {
	to: string;
	label: string;
	icon: LucideIcon;
	hotkey: string;
	planned?: boolean;
	/** Match exactly (for `/`) instead of by prefix. */
	end?: boolean;
	/** Extra paths that count as this item being active. */
	aliases?: readonly string[];
}

export interface NavGroup {
	heading: string;
	items: readonly NavItem[];
}

export const NAV: readonly NavGroup[] = [
	{
		heading: "Work",
		items: [
			{ to: "/", label: "Home", icon: Home, hotkey: "h", end: true },
			{ to: "/inbox", label: "Inbox", icon: Inbox, hotkey: "i" },
			{ to: "/tasks", label: "Board", icon: KanbanSquare, hotkey: "b" },
			{ to: "/threads", label: "Threads", icon: MessagesSquare, hotkey: "t", aliases: ["/chat"] },
		],
	},
	{
		heading: "Automate",
		items: [
			{ to: "/routines", label: "Routines", icon: Clock, hotkey: "r" },
			{ to: "/flows", label: "Flows", icon: Workflow, hotkey: "f", planned: true },
		],
	},
	{
		heading: "Agents",
		items: [
			{ to: "/advisors", label: "Advisors", icon: Eye, hotkey: "a" },
			{ to: "/mixtures", label: "Mixtures", icon: Network, hotkey: "x" },
		],
	},
	{
		heading: "Library",
		items: [
			{ to: "/kb", label: "Knowledge", icon: BookOpen, hotkey: "k" },
			{ to: "/skills", label: "Skills", icon: Sparkles, hotkey: "s" },
			{ to: "/marketplace", label: "Marketplace", icon: Store, hotkey: "m" },
		],
	},
	{
		heading: "Connect",
		items: [
			{ to: "/neopi", label: "NeoPi", icon: Zap, hotkey: "n" },
			{ to: "/github", label: "GitHub", icon: GitBranch, hotkey: "g", planned: true },
			{ to: "/telegram", label: "Telegram", icon: Send, hotkey: "e" },
			{ to: "/integrations", label: "MCP servers", icon: Plug, hotkey: "c" },
		],
	},
	{
		heading: "Office",
		items: [
			{ to: "/people", label: "People", icon: Users, hotkey: "p", planned: true },
			{ to: "/settings", label: "Settings", icon: Settings, hotkey: "," },
		],
	},
];

export const NAV_ITEMS: readonly NavItem[] = NAV.flatMap((group) => group.items);

export function navItemForPath(pathname: string): NavItem | undefined {
	let best: NavItem | undefined;
	for (const item of NAV_ITEMS) {
		const paths = [item.to, ...(item.aliases ?? [])];
		for (const p of paths) {
			const match = item.end ? pathname === p : pathname === p || pathname.startsWith(`${p}/`);
			if (match && (!best || p.length > best.to.length)) best = item;
		}
	}
	return best;
}
