import { afterEach, describe, expect, spyOn, test, type Mock } from "bun:test";
import type { InboxItem } from "@npi-deck/protocol";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { inboxApi } from "../../lib/inbox-api";
import * as uploads from "../../lib/uploads-api";
import { ComposePane } from "./ComposePane";

let renderer: ReactTestRenderer | undefined;
let createItem: Mock<typeof inboxApi.create>;

afterEach(() => {
	if (renderer) act(() => renderer!.unmount());
	renderer = undefined;
	createItem?.mockRestore();
});

function compose() {
	const saved: InboxItem[] = [];
	createItem = spyOn(inboxApi, "create");
	createItem.mockImplementation(async (input) => ({
		...input, body: input.body ?? "", id: "i_capture", createdAt: "2026-10-20T00:00:00Z",
	}));
	act(() => {
		renderer = create(<ComposePane onClose={() => {}} onCreated={(item) => saved.push(item)} />);
	});
	act(() => renderer!.root.findByType("input").props.onChange({ target: { value: "Retain capture notes" } }));
	return saved;
}

function typeBody(value: string) {
	act(() => renderer!.root.findByType("textarea").props.onChange({
		target: { value }, currentTarget: { style: {}, scrollHeight: 240 },
	}));
}

async function capture() {
	await act(async () => {
		renderer!.root.findAllByType("button").find((button) => button.props.className.includes("btn-primary"))!.props.onClick();
	});
}

describe("inbox capture draft", () => {
	test("captures the current markdown without requiring a blur event", async () => {
		const saved = compose();
		const body = "## Notes\n\nKeep these details and [this link](https://example.com).";
		typeBody(body);
		await capture();
		expect(createItem).toHaveBeenCalledWith({ kind: "capture", title: "Retain capture notes", body });
		expect(saved[0]?.body).toBe(body);
	});

	test("does not capture an edit cancelled with Escape", async () => {
		const saved = compose();
		typeBody("Discard this edit");
		act(() => renderer!.root.findByType("textarea").props.onKeyDown({ key: "Escape", preventDefault() {} }));
		await capture();
		expect(saved[0]?.body).toBe("");
	});

	test("keeps committed notes when a later edit is cancelled", async () => {
		const saved = compose();
		typeBody("Committed notes");
		act(() => renderer!.root.findByType("textarea").props.onBlur());
		act(() => renderer!.root.findAllByType("button").find((button) => button.props.title === "Click to edit")!.props.onClick());
		typeBody("Cancelled replacement");
		act(() => renderer!.root.findByType("textarea").props.onKeyDown({ key: "Escape", preventDefault() {} }));
		await capture();
		expect(saved[0]?.body).toBe("Committed notes");
	});

	test("captures an uploaded image after its markdown link replaces the upload placeholder", async () => {
		const upload = spyOn(uploads, "uploadImage").mockResolvedValue({
			url: "/uploads/notes.png", name: "notes.png", size: 8, mimeType: "image/png",
		});
		try {
			const saved = compose();
			typeBody("See screenshot: ");
			await act(async () => {
				renderer!.root.findByType("textarea").props.onPaste({
					clipboardData: { files: [new File(["image"], "notes.png", { type: "image/png" })] },
					preventDefault() {},
				});
			});
			await capture();
			expect(saved[0]?.body).toBe("See screenshot: ![notes.png](/uploads/notes.png)");
		} finally {
			upload.mockRestore();
		}
	});
});
