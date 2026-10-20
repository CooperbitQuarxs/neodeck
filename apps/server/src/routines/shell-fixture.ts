import * as fs from "node:fs";
import * as path from "node:path";

export interface ShellFixtureConfig {
	marker?: string;
	release?: string;
	bytes?: string;
	append?: boolean;
	newline?: boolean;
	exitCode?: number;
	expectedCwd?: string;
}

/** Test-only commands for the unchanged bash -lc / cmd /c production boundary. */
export function shellFixtureCommand(
	runtime: string,
	script: string,
	mode: "write" | "hold" | "success",
	config: ShellFixtureConfig,
	renderedValue?: string,
	platform: NodeJS.Platform = process.platform,
): string {
	const encoded = Buffer.from(JSON.stringify(config), "utf8").toString("base64url");
	const args = [runtime, script, mode, encoded];
	if (renderedValue !== undefined) args.push(renderedValue);
	if (platform === "win32") {
		// cmd /c strips the first and last quote around a quoted executable.
		// These fixtures accept only controlled literal/template values, not arbitrary shell input.
		return `"${args.map(arg => `"${arg}"`).join(" ")}"`;
	}
	return args.map(arg => `'${arg.replaceAll("'", "'\"'\"'")}'`).join(" ");
}

export function createShellFixture(home: string) {
	const cwd = path.join(home, "shell fixture's cwd");
	fs.mkdirSync(cwd, { recursive: true });
	const script = path.join(cwd, "routine fixture's runtime.cjs");
	fs.copyFileSync(path.join(import.meta.dir, "shell-fixture-runtime.cjs"), script);
	return {
		cwd,
		command(mode: "write" | "hold" | "success", config: ShellFixtureConfig = {}, renderedValue?: string): string {
			return shellFixtureCommand(process.execPath, script, mode, { ...config, expectedCwd: cwd }, renderedValue);
		},
	};
}
