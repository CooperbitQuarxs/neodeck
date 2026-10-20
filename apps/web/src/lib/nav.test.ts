import { describe, expect, test } from "bun:test";
import { NAV_ITEMS, navItemForPath } from "./nav";

describe("navItemForPath", () => {
	test("home matches only the exact root, so /inbox never lights Home", () => {
		expect(navItemForPath("/")?.label).toBe("Home");
		expect(navItemForPath("/inbox")?.label).toBe("Inbox");
	});

	test("nested routes light their section", () => {
		expect(navItemForPath("/routines/abc/runs/xyz")?.label).toBe("Routines");
	});

	test("the legacy /chat path lights Threads", () => {
		expect(navItemForPath("/chat")?.label).toBe("Threads");
		expect(navItemForPath("/threads")?.label).toBe("Threads");
	});

	test("unknown paths light nothing", () => {
		expect(navItemForPath("/nowhere")).toBeUndefined();
	});

	test("hotkeys are unique so `g` + letter is unambiguous", () => {
		const keys = NAV_ITEMS.map((i) => i.hotkey);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
