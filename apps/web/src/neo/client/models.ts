/**
 * The catalogue behind the model picker. No flat list: roles the admin mapped
 * for you, virtual models you may use, and providers as groups that list only
 * what is exposed to you. Live reads `/api/models` and
 * `/api/npi-config/model-roles`; preview is the office fixture
 * (backend-contracts.md §6). Picks are strings: `neoproxy/<role>`,
 * `neoproxy/<virtual>`, or `<provider>/<model>`.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { npiConfigApi } from "@/lib/npi-config-api";
import { useAccount } from "./auth";
import { PREVIEW_POOLS, PREVIEW_PROVIDERS } from "./preview-data";
import { SOURCES } from "./source";

export interface PickRole {
	/** `neoproxy/<name>`. */
	value: string;
	name: string;
	/** What it resolves to right now, e.g. `codex/gpt-6-astra`. */
	resolves: string | null;
}

export interface PickVirtual {
	value: string;
	name: string;
	/** Chain as text: `astra 15% → sol 20% → limit`. */
	chain: string;
}

export interface PickProvider {
	id: string;
	label: string;
	hidden: boolean;
	models: readonly { value: string; label: string }[];
}

export interface PickerCatalog {
	roles: readonly PickRole[];
	virtual: readonly PickVirtual[];
	providers: readonly PickProvider[];
}

export interface ModelsClient {
	catalog(): Promise<PickerCatalog>;
}

const previewModels: ModelsClient = {
	async catalog() {
		return {
			roles: PREVIEW_POOLS.map((p) => ({ value: `neoproxy/${p.role}`, name: p.role, resolves: `${p.chain[0]!.provider}/${p.chain[0]!.model}` })),
			virtual: [
				{ value: "neoproxy/good", name: "good", chain: "fable → opus → sol" },
				{ value: "neoproxy/cheap", name: "cheap", chain: "luna 30% → glm-5.1-air" },
			],
			providers: PREVIEW_PROVIDERS.map((p) => ({ id: p.id, label: p.label, hidden: p.hidden, models: p.models.map((m) => ({ value: `neoproxy/${p.id}/${m}`, label: m })) })),
		};
	},
};

const PROVIDER_LABELS: Readonly<Record<string, string>> = {
	anthropic: "Anthropic",
	"openai-codex": "OpenAI Codex",
	openai: "OpenAI",
	xai: "xAI",
	zai: "Z.ai",
	cerebras: "Cerebras",
	github: "GitHub Models",
	google: "Google",
	mixture: "Mixtures",
	neoproxy: "NeoProxy",
};

const liveModels: ModelsClient = {
	async catalog() {
		const [models, rolesRes] = await Promise.all([api.listModels(), npiConfigApi.modelRoles().catch(() => null)]);
		const byProvider = new Map<string, { value: string; label: string }[]>();
		for (const m of models.models) {
			if (!m.isAvailable) continue;
			const list = byProvider.get(m.provider) ?? [];
			list.push({ value: `${m.provider}/${m.id}`, label: m.label || m.id });
			byProvider.set(m.provider, list);
		}
		const providers: PickProvider[] = [...byProvider.entries()].map(([id, list]) => ({ id, label: PROVIDER_LABELS[id] ?? id, hidden: false, models: list }));
		const roles: PickRole[] =
			rolesRes?.roles.filter((r) => r.section === "chat" && !r.hidden).map((r) => ({ value: `neoproxy/${r.id}`, name: r.name.toLowerCase(), resolves: r.resolved ? `${r.resolved.provider}/${r.resolved.modelId}` : null })) ?? [];
		return { roles, virtual: [], providers };
	},
};

export const models: ModelsClient = SOURCES.models === "live" ? liveModels : previewModels;

let cache: Promise<PickerCatalog> | null = null;

/** The catalogue, fetched once per page load; `undefined` until it arrives. */
export function useCatalog(): PickerCatalog | undefined {
	const [catalog, setCatalog] = useState<PickerCatalog>();
	const account = useAccount();
	useEffect(() => {
		cache ??= models.catalog();
		void cache.then((c) => setCatalog(filterForAccount(c, account?.roles)));
	}, [account?.roles]);
	return catalog;
}

/** Members see only the roles the admin mapped for them; admins see everything, hidden providers included. */
function filterForAccount(catalog: PickerCatalog, roles: readonly string[] | undefined): PickerCatalog {
	if (!roles || SOURCES.models === "live") return catalog;
	return { ...catalog, roles: catalog.roles.filter((r) => roles.includes(r.name)) };
}

const RECENT_KEY = "neodeck.models.recent";

export function recentPicks(): string[] {
	try {
		return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
	} catch {
		return [];
	}
}

export function rememberPick(value: string): void {
	const next = [value, ...recentPicks().filter((v) => v !== value)].slice(0, 4);
	localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

/** `neoproxy/codex/gpt-6.1-sol` → `gpt-6.1-sol`; `neoproxy/heavy` → `heavy`. */
export function shortPick(value: string): string {
	const i = value.lastIndexOf("/");
	return i === -1 ? value : value.slice(i + 1);
}
