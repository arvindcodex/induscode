import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INDUSCODE_PLUGIN_BOOTSTRAP_PATH_ENV } from "@induscode/core";
import { expect, it } from "vitest";
import {
	configurePluginBootstrap,
	resolveDesktopPluginBootstrap,
} from "./plugin-bootstrap";

function withLayout(
	resourceDirectory: (root: string) => string,
	execPath: (root: string) => string,
	check: (bootstrap: string, execPath: string) => void,
): void {
	const root = mkdtempSync(join(tmpdir(), "induscode-plugin-bootstrap-"));
	try {
		const directory = join(resourceDirectory(root), "bin", "extensions");
		mkdirSync(directory, { recursive: true });
		const bootstrap = join(directory, "plugin-sandbox-bootstrap.js");
		writeFileSync(bootstrap, "// bootstrap");
		check(bootstrap, execPath(root));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

it("finds the bootstrap in the macOS app bundle resources", () => {
	withLayout(
		(root) => join(root, "IndusCode.app", "Contents", "Resources"),
		(root) => join(root, "IndusCode.app", "Contents", "MacOS", "induscode-cli"),
		(bootstrap, execPath) => {
			expect(resolveDesktopPluginBootstrap({ execPath, cwd: tmpdir() })).toBe(
				bootstrap,
			);
		},
	);
});

it("finds the bootstrap in the Linux and Windows resource layouts", () => {
	withLayout(
		(root) => join(root, "usr", "lib", "IndusCode"),
		(root) => join(root, "usr", "bin", "induscode-cli"),
		(bootstrap, execPath) => {
			expect(resolveDesktopPluginBootstrap({ execPath, cwd: tmpdir() })).toBe(
				bootstrap,
			);
		},
	);
	withLayout(
		(root) => root,
		(root) => join(root, "induscode-cli.exe"),
		(bootstrap, execPath) => {
			expect(resolveDesktopPluginBootstrap({ execPath, cwd: tmpdir() })).toBe(
				bootstrap,
			);
		},
	);
});

it("keeps an explicitly configured bootstrap path", () => {
	const env = { [INDUSCODE_PLUGIN_BOOTSTRAP_PATH_ENV]: "/custom/bootstrap.js" };
	configurePluginBootstrap(env);
	expect(env[INDUSCODE_PLUGIN_BOOTSTRAP_PATH_ENV]).toBe("/custom/bootstrap.js");
});
