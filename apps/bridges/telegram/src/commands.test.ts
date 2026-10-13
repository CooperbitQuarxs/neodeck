import { describe, expect, test } from "bun:test";
import { conversationKey, decomposeTask, invokedText, parseCommand, parseProperties } from "./commands.ts";
import type { TelegramBridgeConfig } from "./config.ts";
import type { TelegramMessage } from "./telegram.ts";

const config: TelegramBridgeConfig = { botToken: "offline", allowedUserIds: new Set(["7"]), allowedChatIds: new Set(["-10"]), requireMention: true,
	deckApiBase: "http://127.0.0.1:1", deckWsUrl: "ws://127.0.0.1:1/ws", dbPath: ":memory:", defaultCwd: "/project", pollTimeoutSeconds: 1, editIntervalMs: 250 };
const bot = { id: 99, username: "deck_bot" };
const group: TelegramMessage = { message_id: 1, chat: { id: -10, type: "supergroup", is_forum: true }, from: { id: 7 }, text: "/task@deck_bot investigate" };

describe("command parsing and authorization", () => {
	test("parses addressed commands and multiline YAML without admitting another bot", () => {
		expect(parseCommand(" /TASK@Deck_Bot\n---\nread-only: true\n---\nResearch", bot.username)).toEqual({ name: "task", args: "---\nread-only: true\n---\nResearch" });
		expect(parseCommand("/reset@other_bot", bot.username)).toBeUndefined();
		expect(parseCommand("/resettable", bot.username)?.name).toBe("resettable");
		expect(parseCommand("ordinary /reset", bot.username)).toBeUndefined();
	});
	test("requires allowed sender AND group, including for commands", () => {
		expect(invokedText(group, config, bot)).toBe(group.text);
		expect(invokedText({ ...group, from: { id: 8 } }, config, bot)).toBeUndefined();
		expect(invokedText({ ...group, chat: { id: -11, type: "group" } }, config, bot)).toBeUndefined();
		expect(invokedText({ ...group, from: { id: 7, is_bot: true } }, config, bot)).toBeUndefined();
		expect(invokedText({ ...group, from: undefined }, config, bot)).toBeUndefined();
		expect(invokedText({ ...group, text: "/task@other_bot steal" }, config, bot)).toBeUndefined();
	});
	test("drops ambient conversation and admits only mentions or replies by default", () => {
		expect(invokedText({ ...group, text: "ordinary chat" }, config, bot)).toBeUndefined();
		expect(invokedText({ ...group, text: "@deck_bot investigate @deck_bot" }, config, bot)).toBe("investigate");
		expect(invokedText({ ...group, text: "@deck_bot_other investigate" }, config, bot)).toBeUndefined();
		expect(invokedText({ ...group, text: "follow up", reply_to_message: { from: { id: 99 } } }, config, bot)).toBe("follow up");
		expect(invokedText({ ...group, text: "follow up", reply_to_message: { from: { id: 100 } } }, config, bot)).toBeUndefined();
		expect(invokedText({ ...group, text: "ordinary task" }, { ...config, requireMention: false }, bot)).toBe("ordinary task");
	});
});

describe("conversation lanes", () => {
	test("normalizes forum General and isolates topics from chats and native DM lanes", () => {
		expect(conversationKey(group)).toBe("-10:1");
		expect(conversationKey({ ...group, is_topic_message: true, message_thread_id: 1 })).toBe("-10:1");
		expect(conversationKey({ ...group, is_topic_message: true, message_thread_id: 42 })).toBe("-10:42");
		const dm = { ...group, chat: { id: 7, type: "private" } };
		expect(conversationKey({ ...dm, message_thread_id: 42 })).toBe("7");
		expect(conversationKey({ ...dm, is_topic_message: true, message_thread_id: 42 })).toBe("7:42");
		expect(conversationKey({ ...dm, direct_messages_topic: { topic_id: 42 } })).toBe("7:dm:42");
		expect(conversationKey({ ...group, chat: { id: -10, type: "group" }, message_thread_id: 42 })).toBe("-10");
	});
});

describe("task decomposition", () => {
	test("retains all metadata on each card, merging overrides without losing custom values", () => {
		const cards = decomposeTask("---\nread-only: true\nworktree: /linked\nmodel: provider/model\nrole: researcher\ncustom:\n  tags: [routing, sessions]\ncwd: /project\nstateId: s_ready\n---\nInvestigate:\n1. Trace ingress\n   Keep source quotes\n2. Check lifecycle", { "read-only": false, owner: "Captain" });
		expect(cards.map((card) => card.title)).toEqual(["Trace ingress", "Check lifecycle"]);
		for (const card of cards) {
			const end = card.body.indexOf("\n---", 4);
			expect(parseProperties(card.body.slice(4, end))).toEqual({ "read-only": true, worktree: "/linked", model: "provider/model", role: "researcher", custom: { tags: ["routing", "sessions"] }, owner: "Captain" });
			expect(card.cwd).toBe("/project");
			expect(card.stateId).toBe("s_ready");
			expect(card.body).toContain("Investigate:");
		}
		expect(cards[0]!.body).toContain("Keep source quotes");
		expect(cards[1]!.body).not.toContain("Keep source quotes");
	});
	test("keeps prose as one card and rejects malformed execution metadata", () => {
		expect(decomposeTask("Investigate routing\nWith a detailed description")).toEqual([{ title: "Investigate routing", body: "Investigate routing\nWith a detailed description" }]);
		expect(() => decomposeTask("---\nread-only: yes\n---\nTask")).toThrow("read-only");
		expect(() => decomposeTask("---\nworktree: 3\n---\nTask")).toThrow("worktree");
		expect(() => decomposeTask("---\nrole: a\nrole: b\n---\nTask")).toThrow("unique keys");
		expect(() => decomposeTask("---\nrole: researcher")).toThrow("Close");
		expect(() => decomposeTask("---\nrole: researcher\n---")).toThrow("description");
	});
});
