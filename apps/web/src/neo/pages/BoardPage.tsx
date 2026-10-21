import { NAV_ITEMS } from "../nav";
import { PlacePage } from "./PlacePage";

/** Board: designed in docs/design/neodeck-architecture.md §4; built in its own pull request. */
export function BoardPage() {
	return <PlacePage item={NAV_ITEMS.find((i) => i.to === "/board")!} />;
}
