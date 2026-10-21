/**
 * Which adapter each domain uses. `live` talks to the deck's existing
 * endpoints; `preview` serves in-memory fixtures so a page is fully
 * interactive before its backend exists. A page whose data is preview shows
 * the `preview data` chip. The endpoints preview stands in for are specified
 * in docs/design/backend-contracts.md.
 */
export type Source = "live" | "preview";

export type Domain = "auth" | "accounts" | "inbox" | "classifier" | "board" | "threads" | "agents" | "judge" | "studio" | "knowledge" | "skills" | "github" | "usage" | "providers";

export const SOURCES: Readonly<Record<Domain, Source>> = {
	auth: "preview",
	accounts: "preview",
	inbox: "live",
	classifier: "preview",
	board: "live",
	threads: "live",
	agents: "preview",
	judge: "preview",
	studio: "live",
	knowledge: "live",
	skills: "live",
	github: "preview",
	usage: "preview",
	providers: "preview",
};

export function isPreview(...domains: Domain[]): boolean {
	return domains.some((d) => SOURCES[d] === "preview");
}
