import { useCallback, useEffect, useRef, useState } from "react";
import type { BridgeInfo, BridgeLogLine } from "@npi-deck/protocol";
import { Card, Dot, Drawer, Empty, NeoBadge, NeoButton, SectionLabel } from "@/components/neo";
import { settings } from "../../client/settings";
import { PreviewChip } from "../../components/PreviewChip";
import { IntegrationNotice, integrationError, useIntegrationNotice } from "./IntegrationNotice";
import { McpIntegrationCard } from "./McpIntegrationCard";
import "./Integrations.css";

export function IntegrationsSection() {
	return <section id="integrations" className="neo-settings-stack">
		<SectionLabel>Integrations</SectionLabel>
		<div className="neo-grid neo-grid-3 neo-settings-integrations-grid">
			<TelegramCard />
			<GitHubCard />
			<McpIntegrationCard />
		</div>
	</section>;
}

function TelegramCard() {
	const [bridge, setBridge] = useState<BridgeInfo | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);
	const busyRef = useRef(false);
	const [logsOpen, setLogsOpen] = useState(false);
	const { notice, report } = useIntegrationNotice();
	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const response = await settings.bridges.list();
			setBridge(response.bridges.find(row => row.name === "telegram") ?? null);
		} catch (error) { report(integrationError(error), true); }
		finally { setLoading(false); }
	}, [report]);
	useEffect(() => { void refresh(); }, [refresh]);

	async function run(action: "start" | "stop" | "restart") {
		if (busyRef.current || !bridge) return;
		busyRef.current = true;
		setBusy(action);
		try {
			const next = await settings.bridges[action]("telegram");
			setBridge(next);
			if (next.lastError) report(next.lastError, true);
			else report(`Telegram is ${next.status}.`);
		} catch (error) { report(integrationError(error), true); }
		finally { busyRef.current = false; setBusy(null); }
	}
	const active = bridge?.status === "running" || bridge?.status === "starting";
	const canStart = bridge !== null && !active && bridge.missingEnv.length === 0;
	return <>
		<Card title="Telegram" description="Messages through the Telegram bridge.">
			<div className="neo-settings-stack">
				<IntegrationNotice notice={notice} />
				<div className="neo-settings-integrations-status"><Dot tone={bridge?.status === "running" ? "live" : bridge?.status === "crashed" ? "bad" : undefined} /><NeoBadge tone={bridge?.status === "crashed" ? "bad" : bridge?.status === "starting" ? "warn" : undefined}>{loading ? "Loading" : bridge?.status ?? "Unavailable"}</NeoBadge></div>
				{bridge?.missingEnv.length ? <p className="neo-settings-description">Set {bridge.missingEnv.join(", ")} in <a href="#advanced">Advanced environment settings</a> before starting.</p> : null}
				{bridge?.lastError && <p className="neo-settings-description">{bridge.lastError}</p>}
				<div className="neo-settings-actions">
					<NeoButton size="sm" disabled={!canStart || busy !== null || loading} onClick={() => void run("start")}>{busy === "start" ? "Starting..." : "Start"}</NeoButton>
					<NeoButton size="sm" disabled={!active || busy !== null || loading} onClick={() => void run("stop")}>{busy === "stop" ? "Stopping..." : "Stop"}</NeoButton>
					<NeoButton size="sm" disabled={bridge?.status !== "running" || busy !== null || loading} onClick={() => void run("restart")}>{busy === "restart" ? "Restarting..." : "Restart"}</NeoButton>
				</div>
				<div className="neo-settings-actions"><NeoButton variant="ghost" size="sm" disabled={!bridge} onClick={() => setLogsOpen(true)}>View logs</NeoButton><NeoButton variant="ghost" size="sm" disabled={loading || busy !== null} onClick={() => void refresh()}>Refresh status</NeoButton></div>
			</div>
		</Card>
		<TelegramLogs open={logsOpen} onClose={() => setLogsOpen(false)} />
	</>;
}

function TelegramLogs({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [lines, setLines] = useState<BridgeLogLine[] | null>(null);
	const [busy, setBusy] = useState(false);
	const busyRef = useRef(false);
	const { notice, report } = useIntegrationNotice();
	const refresh = useCallback(async () => {
		if (busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		try { setLines((await settings.bridges.logs("telegram")).lines); }
		catch (error) { report(integrationError(error), true); }
		finally { busyRef.current = false; setBusy(false); }
	}, [report]);
	useEffect(() => { if (open) void refresh(); }, [open, refresh]);
	return <Drawer open={open} onClose={onClose} title="Telegram logs" subtitle="Output from the bridge process." actions={<NeoButton size="sm" disabled={busy} onClick={() => void refresh()}>{busy ? "Refreshing..." : "Refresh"}</NeoButton>}>
		<div className="neo-settings-stack">
			<IntegrationNotice notice={notice} />
			{lines?.length ? <div className="neo-settings-integration-logs">{lines.map((line, index) => <div key={`${line.timestamp}-${index}`} data-stream={line.stream}><span className="neo-settings-integration-log-time">{line.timestamp} {line.stream}</span>{"\n"}{line.text}</div>)}</div> : <Empty title={busy ? "Loading logs" : lines ? "No log lines yet" : "Logs unavailable"} hint={lines ? "Start the bridge to see its output here." : "Refresh to request the bridge logs."} />}
		</div>
	</Drawer>;
}

function GitHubCard() {
	const [connected, setConnected] = useState<boolean | null>(null);
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const busyRef = useRef(false);
	const { notice, report } = useIntegrationNotice();
	const refresh = useCallback(async () => {
		try { setConnected((await settings.github.status()).connected); }
		catch (error) { report(integrationError(error), true); }
	}, [report]);
	useEffect(() => { void refresh(); }, [refresh]);
	async function connect() {
		if (busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		try {
			setConnected((await settings.github.connect()).connected);
			report("GitHub connection updated in preview.");
		} catch (error) { report(integrationError(error), true); }
		finally { busyRef.current = false; setBusy(false); }
	}
	return <>
		<Card title="GitHub app" description="Repositories, issues and pull requests." actions={<PreviewChip domains={["github"]} />}>
			<div className="neo-settings-stack">
				{!open && <IntegrationNotice notice={notice} />}
				<NeoBadge>{connected === null ? "Checking connection" : connected ? "Connected" : "Not connected"}</NeoBadge>
				<p className="neo-settings-description">Choose the repositories the office can access.</p>
				<div className="neo-settings-actions"><NeoButton size="sm" onClick={() => setOpen(true)}>{connected ? "View connection" : "Connect"}</NeoButton>{connected === null && <NeoButton size="sm" variant="ghost" onClick={() => void refresh()}>Refresh</NeoButton>}</div>
			</div>
		</Card>
		<Drawer open={open} onClose={() => setOpen(false)} title="Connect GitHub" subtitle={<PreviewChip domains={["github"]} />} footer={<NeoButton variant="primary" disabled={busy || connected === true} onClick={() => void connect()}>{busy ? "Connecting..." : connected ? "Connected in preview" : "Connect in preview"}</NeoButton>}>
			<div className="neo-settings-stack">
				<IntegrationNotice notice={notice} />
				<p>Install the NeoDeck GitHub app on your account or organization, then choose the repositories it may access.</p>
				<p className="neo-settings-description">The live installation flow will open GitHub for approval and return here with the connection status. This preview changes only the in-memory connection. It does not install an app or grant repository access.</p>
				{connected && <NeoBadge>Connected in preview</NeoBadge>}
			</div>
		</Drawer>
	</>;
}
