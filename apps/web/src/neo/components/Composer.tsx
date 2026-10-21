/**
 * The composer: a fixed 116 px region that never grows. Three lines of text
 * (longer messages scroll inside), then one bar: who the message goes to,
 * which model, dictation, send. `Ctrl+]` / `Ctrl+[` cycle the target while
 * typing; `Enter` sends, `Shift+Enter` breaks a line. Used by Threads and
 * by any drawer that talks to an agent. See neodeck-architecture.md §4.
 */
import { ArrowUp, Mic, Square } from "lucide-react";
import { type CSSProperties, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Kbd, NeoButton } from "@/components/neo";
import { cn } from "@/lib/utils";
import { dictation, DictationUnavailable } from "../client/dictation";
import { agentColor } from "./AgentSwatch";
import { ModelPicker } from "./ModelPicker";

export interface ComposerTarget {
	id: string;
	name: string;
	hue: number;
}

export const ALL_TARGETS = "all";

export interface ComposerProps {
	targets: readonly ComposerTarget[];
	/** An agent id, or `ALL_TARGETS` to broadcast to every agent in the thread. */
	targetId: string;
	onTargetChange: (id: string) => void;
	model: string;
	onModelChange: (model: string) => void;
	onSend: (text: string) => void | Promise<void>;
	/** The target is busy: Send becomes Stop. */
	busy?: boolean;
	onStop?: () => void;
	disabled?: boolean;
	placeholder?: string;
	/** Prefilled text, e.g. from `Open in thread`. */
	draft?: string;
	className?: string;
}

export function Composer({ targets, targetId, onTargetChange, model, onModelChange, onSend, busy, onStop, disabled, placeholder, draft, className }: ComposerProps) {
	const [text, setText] = useState(draft ?? "");
	const [note, setNote] = useState<string | null>(null);
	const ref = useRef<HTMLTextAreaElement>(null);
	const target = targets.find((t) => t.id === targetId);
	const broadcast = targetId === ALL_TARGETS;

	useEffect(() => {
		if (draft !== undefined) setText(draft);
	}, [draft]);

	useEffect(() => {
		if (!note) return;
		const t = setTimeout(() => setNote(null), 4000);
		return () => clearTimeout(t);
	}, [note]);

	function cycle(delta: 1 | -1): void {
		const ids = [...targets.map((t) => t.id), ...(targets.length > 1 ? [ALL_TARGETS] : [])];
		if (ids.length < 2) return;
		const i = ids.indexOf(targetId);
		onTargetChange(ids[(i + delta + ids.length) % ids.length]!);
	}

	async function send(): Promise<void> {
		const value = text.trim();
		if (!value || disabled) return;
		setText("");
		await onSend(value);
		ref.current?.focus();
	}

	function onKey(e: KeyboardEvent<HTMLTextAreaElement>): void {
		if ((e.ctrlKey || e.metaKey) && (e.key === "]" || e.key === "[")) {
			e.preventDefault();
			cycle(e.key === "]" ? 1 : -1);
			return;
		}
		if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			void send();
		}
	}

	const { listening, toggle } = useDictation((spoken) => setText((t) => (t ? `${t} ${spoken}` : spoken)), setNote);

	return (
		<div className={cn("neo-composer", className)} data-disabled={disabled || undefined}>
			<textarea
				ref={ref}
				className="neo-composer-text"
				rows={3}
				value={text}
				placeholder={placeholder ?? (broadcast ? "Message every agent in this thread" : target ? `Message ${target.name}` : "Message")}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={onKey}
				disabled={disabled}
				aria-label="Message"
			/>
			<div className="neo-composer-bar">
				{targets.length > 0 ? (
					<button
						type="button"
						className="neo-chip neo-composer-target"
						onClick={() => cycle(1)}
						title={targets.length > 1 ? "Who gets this message · ctrl+] next, ctrl+[ previous" : "Who gets this message"}
						style={{ "--agent": broadcast ? "var(--neo-accent-b)" : agentColor(target?.hue ?? 0) } as CSSProperties}
						disabled={disabled}
					>
						<span className="neo-composer-arrow" aria-hidden="true">
							→
						</span>
						<i className="neo-composer-dot" aria-hidden="true" />
						<span>{broadcast ? `All ${targets.length}` : (target?.name ?? "No agent")}</span>
					</button>
				) : null}
				<ModelPicker value={model} onChange={onModelChange} above size="sm" disabled={disabled} />
				<span className="neo-composer-spacer" />
				{note ? (
					<span className="neo-composer-note" role="status">
						{note}
					</span>
				) : targets.length > 1 ? (
					<span className="neo-composer-hint">
						<Kbd>ctrl</Kbd>
						<Kbd>]</Kbd> next agent
					</span>
				) : null}
				<NeoButton variant="ghost" icon size="sm" on={listening} onClick={toggle} aria-label={listening ? "Stop dictating" : "Dictate"} title={listening ? "Stop dictating" : "Dictate (hold to talk)"} disabled={disabled}>
					<Mic size={14} />
					{listening ? <i className="neo-composer-listening" aria-hidden="true" /> : null}
				</NeoButton>
				{busy ? (
					<NeoButton variant="danger" size="sm" onClick={onStop} aria-label="Stop" title="Stop the current turn · ctrl+.">
						<Square size={12} /> Stop
					</NeoButton>
				) : (
					<NeoButton variant="primary" size="sm" onClick={() => void send()} disabled={disabled || text.trim() === ""} aria-label="Send" title="Send · enter">
						<ArrowUp size={14} />
					</NeoButton>
				)}
			</div>
		</div>
	);
}

/** Records with MediaRecorder while on; on stop, sends the clip to the dictation client. */
function useDictation(onText: (text: string) => void, onNote: (note: string) => void): { listening: boolean; toggle: () => void } {
	const [listening, setListening] = useState(false);
	const recorder = useRef<MediaRecorder | null>(null);

	async function start(): Promise<void> {
		if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
			onNote("This browser has no microphone access.");
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const chunks: Blob[] = [];
			const rec = new MediaRecorder(stream);
			rec.ondataavailable = (e) => chunks.push(e.data);
			rec.onstop = async () => {
				for (const track of stream.getTracks()) track.stop();
				setListening(false);
				try {
					const text = await dictation.transcribe(new Blob(chunks, { type: rec.mimeType }));
					if (text.trim()) onText(text.trim());
				} catch (err) {
					onNote(err instanceof DictationUnavailable ? err.message : "Transcription failed.");
				}
			};
			rec.start();
			recorder.current = rec;
			setListening(true);
		} catch {
			onNote("Microphone permission was refused.");
		}
	}

	function toggle(): void {
		if (listening) {
			recorder.current?.stop();
			recorder.current = null;
		} else {
			void start();
		}
	}

	return { listening, toggle };
}
