import { NAV_ITEMS } from "../nav";
import { PlacePage } from "./PlacePage";

/** Agents: designed in docs/design/neodeck-architecture.md §4; built in its own pull request. */
export function AgentsPage() {
	return <PlacePage item={NAV_ITEMS.find((i) => i.to === "/agents")!} />;
}
