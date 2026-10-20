const fs = require("node:fs");

const [mode, encoded, renderedValue] = process.argv.slice(2);
const config = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
if (config.expectedCwd && fs.realpathSync(process.cwd()) !== fs.realpathSync(config.expectedCwd)) {
	throw new Error("fixture did not run in its configured cwd");
}

async function main() {
	if (mode === "write") {
		const bytes = (renderedValue ?? config.bytes ?? "") + (config.newline ? "\n" : "");
		if (config.append) fs.appendFileSync(config.marker, bytes, "utf8");
		else fs.writeFileSync(config.marker, bytes, "utf8");
	} else if (mode === "hold") {
		fs.appendFileSync(config.marker, "start\n", "utf8");
		while (!fs.existsSync(config.release)) await new Promise(resolve => setTimeout(resolve, 50));
		fs.appendFileSync(config.marker, "end\n", "utf8");
	} else if (mode !== "success") {
		throw new Error(`unknown shell fixture mode: ${mode}`);
	}
	process.exitCode = config.exitCode ?? 0;
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
