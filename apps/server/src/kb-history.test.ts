import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { KbService } from "./kb-service.ts";
import { buildKbRouter } from "./routes-kb.ts";

let root: string;
beforeEach(async () => {
	const scratch = join(homedir(), ".cache/npi-canary/neodeck-pool/KnowledgeCartographer/tests");
	await mkdir(scratch, { recursive: true });
	root = await mkdtemp(join(scratch, "history-"));
	await writeFile(join(root, "note.md"), "# Note\n");
	await writeFile(join(root, "private.md"), "# Private\n");
	await writeFile(join(root, ".kbignore"), "private.md\n");
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

test("unversioned notes report unavailable rather than fabricated activity", async () => {
	const app = buildKbRouter(new KbService({ root }));
	const response = await app.request("/kb/history?path=note.md");
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ available: false, entries: [] });
});

test("history respects missing, ignored, and escaping path boundaries", async () => {
	const app = buildKbRouter(new KbService({ root }));
	expect((await app.request("/kb/history")).status).toBe(400);
	for (const path of ["private.md", "missing.md", "../note.md", "/etc/passwd"]) {
		expect((await app.request(`/kb/history?path=${encodeURIComponent(path)}`)).status).toBe(404);
	}
});
