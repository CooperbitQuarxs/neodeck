import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { ensurePrivateDataDir } from "../env-store.ts";
import { closeDb, getDb, openDb } from "./index.ts";

// deck.db holds webhook signing keys, so neither it, its WAL files, nor the
// data dir may be readable by other users.
const mode = (p: string) => fs.statSync(p).mode & 0o777;
let root = "";

afterEach(() => {
	closeDb();
	if (root) fs.rmSync(root, { recursive: true, force: true });
	root = "";
});

describe.skipIf(process.platform === "win32")("private data files", () => {
	test("a new database and its WAL files are created owner-only", () => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "npi-deck-db-mode-"));
		const dbPath = path.join(root, "data", "deck.db");
		openDb({ path: dbPath });
		getDb().exec("CREATE TABLE IF NOT EXISTS mode_probe (x); INSERT INTO mode_probe VALUES (1);");

		expect(mode(path.dirname(dbPath))).toBe(0o700);
		expect(mode(dbPath)).toBe(0o600);
		expect(mode(`${dbPath}-wal`)).toBe(0o600);
		expect(mode(`${dbPath}-shm`)).toBe(0o600);
	});

	test("an existing world-readable database and WAL files are narrowed to the owner on open", () => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "npi-deck-db-mode-"));
		const dbPath = path.join(root, "deck.db");
		openDb({ path: dbPath });
		getDb().exec("CREATE TABLE IF NOT EXISTS mode_probe (x); INSERT INTO mode_probe VALUES (1);");
		closeDb();
		for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
			if (!fs.existsSync(file)) fs.writeFileSync(file, "");
			fs.chmodSync(file, 0o644);
		}

		openDb({ path: dbPath });

		expect(mode(dbPath)).toBe(0o600);
		expect(mode(`${dbPath}-wal`)).toBe(0o600);
		expect(mode(`${dbPath}-shm`)).toBe(0o600);
	});

	test("the data dir is made owner-only, whether new or left at 0755 by an older deck", () => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "npi-deck-dir-mode-"));
		const fresh = path.join(root, "fresh", ".npi-deck");
		ensurePrivateDataDir(fresh);
		expect(mode(fresh)).toBe(0o700);

		const existing = path.join(root, "existing");
		fs.mkdirSync(existing, { mode: 0o755 });
		fs.chmodSync(existing, 0o755);
		ensurePrivateDataDir(existing);
		expect(mode(existing)).toBe(0o700);
	});
});

test("close releases database files before retained statement objects are collected", () => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), "npi-deck-db-release-"));
	const fixture = path.join(root, "fixture");
	const dbModule = new URL("./index.ts", import.meta.url).href;
	const tasksModule = new URL("./tasks.ts", import.meta.url).href;
	const child = Bun.spawnSync({
		cmd: [process.execPath, "--eval", `
			import { Database } from "bun:sqlite";
			import * as fs from "node:fs";
			import * as path from "node:path";
			const fixture = ${JSON.stringify(fixture)};
			const statements = [];
			const prepare = Database.prototype.prepare;
			Database.prototype.prepare = function (...args) {
				const statement = Reflect.apply(prepare, this, args);
				statements.push(statement);
				return statement;
			};
			globalThis.retainedStatements = statements;
			const { openDb, closeDb } = await import(${JSON.stringify(dbModule)});
			const { createState, createTask, updateTask, moveTask } = await import(${JSON.stringify(tasksModule)});
			const db = openDb({ path: path.join(fixture, "deck.db") });
			const kept = db.query("SELECT ? AS kept");
			for (let index = 0; index < 24; index++) {
				db.query("SELECT ? AS value /* release probe " + index + " */").get(index);
			}
			if (kept.get(41).kept !== 41) throw new Error("an earlier statement was invalidated before close");
			const state = createState({ name: "release-probe" });
			const task = createTask({ title: "release-probe" });
			updateTask(task.id, { body: "updated before close" });
			moveTask(task.id, state.id, 0);
			closeDb();
			const sidecars = ["deck.db-wal", "deck.db-shm"].filter(name => fs.existsSync(path.join(fixture, name)));
			const descriptors = process.platform === "linux"
				? fs.readdirSync("/proc/self/fd").flatMap(fd => {
					try {
						const target = fs.readlinkSync("/proc/self/fd/" + fd);
						return target.startsWith(fixture + path.sep) ? [target] : [];
					} catch (error) {
						if (error.code !== "ENOENT") throw error;
						return [];
					}
				})
				: null;
			if (sidecars.length || descriptors?.length) throw new Error(JSON.stringify({ sidecars, descriptors }));
			fs.rmSync(fixture, { recursive: true });
			console.log("SQLITE_RELEASE_PROOF=" + JSON.stringify({
				sidecars, descriptors, removed: !fs.existsSync(fixture),
			}));
		`],
		cwd: root,
		env: { HOME: root, USERPROFILE: root, NPI_DECK_HOME: root },
		stdout: "pipe",
		stderr: "pipe",
	});
	expect(child.stderr.toString()).toBe("");
	expect(child.exitCode).toBe(0);
	const proof = child.stdout.toString().split("\n").find(line => line.startsWith("SQLITE_RELEASE_PROOF="));
	expect(JSON.parse(proof!.slice("SQLITE_RELEASE_PROOF=".length))).toEqual({
		sidecars: [], descriptors: process.platform === "linux" ? [] : null, removed: true,
	});
});
