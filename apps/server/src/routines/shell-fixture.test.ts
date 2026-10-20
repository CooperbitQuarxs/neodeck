import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import type { RoutineSpec } from "@npi-deck/protocol";
import { createV1Routine, listRuns } from "../db/routines.ts";
import { listStepRuns } from "../db/routine-step-runs.ts";
import { createIsolatedTest } from "../test-isolation.ts";
import { RoutineTestFixtures } from "./test-fixture.ts";
import { createShellFixture, shellFixtureCommand } from "./shell-fixture.ts";
import type { ShellFixtureConfig } from "./shell-fixture.ts";

// This assertion runs on Linux too. Actual cmd execution is the Windows CI test below.
test("Windows fixture command preserves the cmd outer quote pair and Windows path separators", () => {
	const runtime = "C:\\Program Files\\runtime's folder\\bun.exe";
	const script = "C:\\private fixtures\\fixture's runtime.cjs";
	const config = { marker: "C:\\private fixtures\\marker's file", bytes: "yes", newline: true };
	const encoded = Buffer.from(JSON.stringify(config)).toString("base64url");
	expect(shellFixtureCommand(runtime, script, "write", config, "{{ trigger.tag }}", "win32"))
		.toBe(`""${runtime}" "${script}" "write" "${encoded}" "{{ trigger.tag }}""`);
	expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
});

const isolatedTest = createIsolatedTest(import.meta.path);
isolatedTest("fixture bytes, rendered values, cwd and exit 7 round-trip through the production shell", async () => {
	const fixtures = new RoutineTestFixtures();
	await fixtures.run(async ({ home, runner }) => {
		const shell = createShellFixture(home);
		const runtime = path.join(shell.cwd, process.platform === "win32" ? "test runtime's bun.exe" : "test runtime's bun");
		// No launcher wrapper: the real executable itself has spaces and an apostrophe.
		try { fs.linkSync(process.execPath, runtime); }
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
			fs.copyFileSync(process.execPath, runtime, fs.constants.COPYFILE_FICLONE);
		}
		const script = path.join(shell.cwd, "routine fixture's runtime.cjs");
		const marker = path.join(shell.cwd, "marker's bytes");
		const command = (config: ShellFixtureConfig, value?: string) =>
			shellFixtureCommand(runtime, script, "write", { ...config, marker, expectedCwd: shell.cwd }, value);
		const spec: RoutineSpec = {
			version: 1, name: "shell round trip", trigger: [{ manual: {} }], concurrency: "skip",
			steps: [
				{ id: "bytes", type: "run", cwd: shell.cwd, command: command({ bytes: "UTF-8 café ' \\ bytes", newline: false }) },
				{ id: "rendered", type: "run", cwd: shell.cwd, command: command({ append: true, newline: true, exitCode: 7 }, "{{ trigger.tag }}") },
			],
		};
		const routine = createV1Routine({ name: "shell round trip", spec, specYaml: JSON.stringify(spec), enabled: true });
		await runner.fire(routine.id, "manual", { tag: "tail-marker" });
		expect(fs.readFileSync(marker, "utf8")).toBe("UTF-8 café ' \\ bytestail-marker\n");
		const run = listRuns(routine.id)[0]!;
		expect(listStepRuns(run.id).map(step => [step.status, step.error])).toEqual([
			["success", undefined], ["failed", "exit code 7"],
		]);
		expect(run.abortReason).toBe("failure");
	});
});
