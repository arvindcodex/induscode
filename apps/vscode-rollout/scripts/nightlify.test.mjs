import { describe, expect, it } from "bun:test";
import { nightlifyPackageJson } from "./nightlify.mjs";

const fixture = {
	name: "claude-dev",
	displayName: "IndusCode",
	publisher: "saoudrizwan",
	version: "4.0.0",
	main: "./dist/extension.js",
	contributes: {
		viewsContainers: {
			activitybar: [
				{
					id: "claude-dev-ActivityBar",
					title: "IndusCode",
					icon: "assets/icon.svg",
				},
			],
		},
		views: {
			"claude-dev-ActivityBar": [
				{ type: "webview", id: "claude-dev.SidebarProvider" },
			],
		},
		commands: [{ command: "induscode.plusButtonClicked", title: "New Task" }],
		keybindings: [{ command: "induscode.addToChat", key: "ctrl+'" }],
		menus: {
			"view/title": [
				{
					command: "induscode.plusButtonClicked",
					when: "view == claude-dev.SidebarProvider",
				},
				// Mid-string references are NOT rewritten — a known limitation
				// shared with the standalone nightly's publish-nightly.mjs.
				{ command: "induscode.addToChat", when: "config.induscode.enableExtras" },
			],
		},
		configuration: {
			title: "IndusCode",
			properties: { "induscode.enableExtras": { type: "boolean" } },
		},
	},
};

describe("nightlifyPackageJson", () => {
	const pkg = JSON.parse(
		nightlifyPackageJson(JSON.stringify(fixture, null, "\t"), "4.0.1752600000"),
	);

	it("sets the nightly identity and the supplied version", () => {
		expect(pkg.name).toBe("induscode-nightly");
		expect(pkg.displayName).toBe("IndusCode (Nightly)");
		expect(pkg.version).toBe("4.0.1752600000");
		expect(pkg.publisher).toBe("saoudrizwan");
	});

	it("rewrites claude-dev IDs and the induscode.* namespace", () => {
		expect(pkg.contributes.viewsContainers.activitybar[0].id).toBe(
			"induscode-nightly-ActivityBar",
		);
		expect(pkg.contributes.viewsContainers.activitybar[0].title).toBe(
			"IndusCode (Nightly)",
		);
		expect(Object.keys(pkg.contributes.views)).toEqual([
			"induscode-nightly-ActivityBar",
		]);
		expect(pkg.contributes.views["induscode-nightly-ActivityBar"][0].id).toBe(
			"induscode-nightly.SidebarProvider",
		);
		expect(pkg.contributes.commands[0].command).toBe(
			"induscode-nightly.plusButtonClicked",
		);
		expect(pkg.contributes.keybindings[0].command).toBe(
			"induscode-nightly.addToChat",
		);
		expect(Object.keys(pkg.contributes.configuration.properties)).toEqual([
			"induscode-nightly.enableExtras",
		]);
	});

	it("rewrites when-clauses that start with a rewritten ID, but not mid-string references", () => {
		const [gated, midString] = pkg.contributes.menus["view/title"];
		expect(gated.when).toBe("view == induscode-nightly.SidebarProvider");
		// Documented limitation: `config.induscode.` does not match the `"induscode.`
		// pattern, so it survives unrewritten (matches publish-nightly.mjs).
		expect(midString.when).toBe("config.induscode.enableExtras");
	});

	it("requires a version", () => {
		expect(() => nightlifyPackageJson("{}", undefined)).toThrow(/version/);
	});
});
