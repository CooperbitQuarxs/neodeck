import { NAV_ITEMS } from "../nav";
import { PlacePage } from "./PlacePage";

/** GitHub: designed in docs/design/neodeck-architecture.md §4; built in its own pull request. */
export function GitHubPage() {
	return <PlacePage item={NAV_ITEMS.find((i) => i.to === "/github")!} />;
}
