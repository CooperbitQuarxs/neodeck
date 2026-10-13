import { parseDocument, stringify } from "yaml";
import type { TelegramMessage } from "./telegram.ts";
import type { TelegramBridgeConfig } from "./config.ts";

export interface BotIdentity { id: number; username: string }
export interface Command { name: string; args: string }

export function parseCommand(text: string, username: string): Command | undefined {
	const match = /^\/([a-z][a-z0-9_]*)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i.exec(text.trim());
	if (!match || (match[2] && match[2].toLowerCase() !== username.toLowerCase())) return undefined;
	return { name: match[1]!.toLowerCase(), args: (match[3] ?? "").trim() };
}

export function conversationKey(message: TelegramMessage): string {
	if (message.direct_messages_topic) return `${message.chat.id}:dm:${message.direct_messages_topic.topic_id}`;
	if (message.chat.is_forum) return `${message.chat.id}:${message.is_topic_message ? message.message_thread_id ?? 1 : 1}`;
	if (message.chat.type === "private" && message.is_topic_message && message.message_thread_id !== undefined) return `${message.chat.id}:${message.message_thread_id}`;
	return String(message.chat.id);
}

/** Authorization precedes invocation, attachment downloads and session access. */
export function invokedText(message: TelegramMessage, config: TelegramBridgeConfig, bot: BotIdentity): string | undefined {
	if (!message.from || message.from.is_bot || !config.allowedUserIds.has(String(message.from.id))) return undefined;
	const text = (message.text ?? message.caption ?? "").trim();
	if (message.chat.type === "private") {
		if (/^\/[a-z][a-z0-9_]*@/i.test(text) && !parseCommand(text, bot.username)) return undefined;
		return text;
	}
	if (!["group", "supergroup"].includes(message.chat.type) || !config.allowedChatIds.has(String(message.chat.id))) return undefined;
	if (/^\//.test(text)) return parseCommand(text, bot.username) ? text : undefined;
	const mention = new RegExp(`@${bot.username}(?![a-z0-9_])`, "ig");
	const mentioned = mention.test(text);
	mention.lastIndex = 0;
	if (config.requireMention && !mentioned && message.reply_to_message?.from?.id !== bot.id) return undefined;
	return text.replace(mention, "").trim();
}

export interface IntakeCard { title: string; body: string; cwd?: string; stateId?: string }

export function parseProperties(text: string): Record<string, unknown> {
	const doc = parseDocument(text, { uniqueKeys: true });
	if (doc.errors.length) throw new Error("Card properties must be valid YAML with unique keys.");
	const value: unknown = doc.toJS({ maxAliasCount: 20 });
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Card properties must be a YAML mapping.");
	return value as Record<string, unknown>;
}

/** First-pass decomposition is deterministic: explicit list items become cards, prose stays one card. */
export function decomposeTask(text: string, defaults: Record<string, unknown> = {}): IntakeCard[] {
	let body = text.trim();
	let properties = defaults;
	if (body.startsWith("---\n")) {
		const end = body.indexOf("\n---", 4);
		if (end < 0 || !/^\n---(?:\n|$)/.test(body.slice(end))) throw new Error("Close card front matter with a --- line.");
		properties = { ...defaults, ...parseProperties(body.slice(4, end)) };
		body = body.slice(end + 4).trim();
	}
	if (!body) throw new Error("Send a task description after the card properties.");
	if (properties["read-only"] !== undefined && typeof properties["read-only"] !== "boolean") throw new Error("read-only must be true or false.");
	for (const key of ["worktree", "model", "role", "cwd", "stateId"]) {
		if (properties[key] !== undefined && (typeof properties[key] !== "string" || !properties[key].trim())) throw new Error(`${key} must be a nonempty string.`);
	}
	const lines = body.split("\n");
	const list = lines.flatMap((line, index) => {
		const item = /^(?:[-*]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)(\S.*)$/.exec(line);
		return item ? [{ index, text: item[1]! }] : [];
	});
	const parts = list.length > 1 ? list.map((item, i) => ({
		title: item.text,
		body: [...lines.slice(0, list[0]!.index), item.text, ...lines.slice(item.index + 1, list[i + 1]?.index ?? lines.length)].join("\n").trim(),
	})) : [{ title: body.split("\n")[0]!, body }];
	const { cwd, stateId, ...metadata } = properties;
	const header = Object.keys(metadata).length ? `---\n${stringify(metadata)}---\n\n` : "";
	return parts.map((part) => ({
		title: part.title.slice(0, 200), body: `${header}${part.body}`,
		...(typeof cwd === "string" ? { cwd } : {}),
		...(typeof stateId === "string" ? { stateId } : {}),
	}));
}

export const HELP = `NPI deck inbox — tasks become kanban cards, not immediate executions.
Send a task, or a numbered/checklist list for multiple cards.
/task <text> — file task cards
/capture <text> — save an unprocessed inbox capture
/inbox — show unprocessed inbox items
/properties <YAML> — set this chat/topic's default card front matter; /properties clear removes defaults
/chat <text> — explicitly chat with the bound persistent NeoPi session (photos supported)
/session or /status — show binding
/sessions — list this conversation's retained sessions
/bind <session ID> — bind an existing deck session
/resume <session ID> — resume one of this conversation's retained sessions
/new or /reset — fresh binding, retaining old transcript
/stop — abort the current NeoPi turn
/title <name> — rename session
/model <provider/model> — select session model; /model lists models
/compact [focus] — compact session context
/help or /commands — this help
Use YAML front matter before a task to set read-only, worktree, model, role or any other card property. Execution is managed separately by the deck.`;
