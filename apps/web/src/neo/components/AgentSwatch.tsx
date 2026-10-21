import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** The colour an agent speaks in. One hue per agent, used for its swatch, its rule in a transcript and its chip. */
export function agentColor(hue: number): string {
	return `oklch(0.78 0.13 ${hue})`;
}

export function agentColorSoft(hue: number): string {
	return `oklch(0.78 0.13 ${hue} / 0.14)`;
}

/** 10 px square in the agent's colour, optionally followed by its name. */
export function AgentSwatch({ hue, name, size = 10, className }: { hue: number; name?: string; size?: number; className?: string }) {
	return (
		<span className={cn("neo-agent-swatch", className)} style={{ "--agent": agentColor(hue), "--swatch": `${size}px` } as CSSProperties}>
			<i aria-hidden="true" />
			{name !== undefined ? <span>{name}</span> : null}
		</span>
	);
}
