import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	resolveIndusCodeDir,
	resolveDbDataDir,
	resolveGlobalTaskSpecsDir,
	resolveTaskSpecsDir,
	resolveTasksDbPath,
	resolveWorkspaceTaskSpecsDir,
} from "./paths";

describe("agenda task storage paths", () => {
	it("places task state in the shared db directory", () => {
		expect(resolveTasksDbPath()).toBe(
			process.env.INDUSCODE_TASKS_DB_PATH?.trim() ||
				join(resolveDbDataDir(), "tasks.db"),
		);
	});

	it("resolves global and workspace file-backed task roots", () => {
		expect(resolveGlobalTaskSpecsDir()).toBe(join(resolveIndusCodeDir(), "tasks"));
		expect(resolveWorkspaceTaskSpecsDir("/workspace")).toBe(
			join("/workspace", ".induscode", "tasks"),
		);
		expect(
			resolveTaskSpecsDir({ scope: "workspace", workspaceRoot: "/workspace" }),
		).toBe(join("/workspace", ".induscode", "tasks"));
	});
});
