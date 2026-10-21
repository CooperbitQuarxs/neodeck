import { useState } from "react";
import { Empty, PageHeader } from "@/components/neo";
import { ALL_TARGETS, Composer } from "../components/Composer";
import { NAV_ITEMS } from "../nav";

const TARGETS = [
	{ id: "main", name: "Main", hue: 190 },
	{ id: "reviewer", name: "Reviewer", hue: 300 },
];

/** Threads: designed in docs/design/neodeck-architecture.md §4; built in its own pull request. The composer is final. */
export function ThreadsPage() {
	const item = NAV_ITEMS.find((i) => i.to === "/threads")!;
	const [target, setTarget] = useState<string>("main");
	const [model, setModel] = useState("neoproxy/default");
	return (
		<div className="neo-fill">
			<PageHeader title={item.label} description={item.blurb} />
			<div className="neo-split neo-fill-body" style={{ "--split-w": "300px" } as React.CSSProperties}>
				<div className="neo-split-list" />
				<div className="neo-split-detail">
					<div className="flex-1">
						<Empty icon={item.icon} title="Threads is being built" hint="The layout is decided in docs/design/neodeck-architecture.md; this page lands in its own pull request." />
					</div>
					<Composer targets={TARGETS} targetId={target === ALL_TARGETS ? ALL_TARGETS : target} onTargetChange={setTarget} model={model} onModelChange={setModel} onSend={() => undefined} />
				</div>
			</div>
		</div>
	);
}
