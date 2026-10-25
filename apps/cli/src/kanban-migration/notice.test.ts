import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	getIndusCodeCliMigrationNotice,
	markIndusCodeCliMigrationNoticeShown,
	resolveCliNoticeStatePath,
	shouldSuppressIndusCodeCliMigrationNoticeForActiveProvider,
} from "./notice";

const tempDirs: string[] = [];

function createTempDataDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "induscode-cli-notice-"));
	tempDirs.push(dir);
	return dir;
}

describe("migration notice", () => {
	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns the notice for a fresh data dir", () => {
		const dataDir = createTempDataDir();

		expect(getIndusCodeCliMigrationNotice(dataDir)?.title).toBe("Try IndusCodePass");
	});

	it("shows when only the old Kanban notice was marked as shown", () => {
		const dataDir = createTempDataDir();
		const noticePath = resolveCliNoticeStatePath(dataDir);
		mkdirSync(dirname(noticePath), { recursive: true, mode: 0o700 });
		writeFileSync(
			noticePath,
			`${JSON.stringify(
				{ shown: { "induscode-cli-tui-default": true } },
				null,
				2,
			)}\n`,
			"utf8",
		);

		expect(getIndusCodeCliMigrationNotice(dataDir)?.id).toBe(
			"induscode-cli-induscode-pass-intro",
		);
	});

	it("does not show after every notice is marked as shown", () => {
		const dataDir = createTempDataDir();

		markIndusCodeCliMigrationNoticeShown(dataDir);
		markIndusCodeCliMigrationNoticeShown(dataDir, "induscode-cli-desktop-launch");

		expect(getIndusCodeCliMigrationNotice(dataDir)).toBeUndefined();
	});

	it("shows the desktop launch notice once the IndusCodePass intro was shown", () => {
		const dataDir = createTempDataDir();

		markIndusCodeCliMigrationNoticeShown(dataDir);

		const notice = getIndusCodeCliMigrationNotice(dataDir);
		expect(notice?.id).toBe("induscode-cli-desktop-launch");
		expect(notice?.url).toBe("https://induscode.bot/desktop");
	});

	it("shows only one notice per launch", () => {
		const dataDir = createTempDataDir();

		expect(getIndusCodeCliMigrationNotice(dataDir)?.id).toBe(
			"induscode-cli-induscode-pass-intro",
		);
	});

	it("marks the desktop launch notice as shown by id", () => {
		const dataDir = createTempDataDir();

		markIndusCodeCliMigrationNoticeShown(dataDir);
		markIndusCodeCliMigrationNoticeShown(dataDir, "induscode-cli-desktop-launch");

		const rawState = readFileSync(resolveCliNoticeStatePath(dataDir), "utf8");
		expect(rawState).toContain('"induscode-cli-induscode-pass-intro": true');
		expect(rawState).toContain('"induscode-cli-desktop-launch": true');
		expect(getIndusCodeCliMigrationNotice(dataDir)).toBeUndefined();
	});

	it("shows after the notice is marked as shown when forced", () => {
		const dataDir = createTempDataDir();

		markIndusCodeCliMigrationNoticeShown(dataDir);

		expect(
			getIndusCodeCliMigrationNotice(dataDir, {
				INDUSCODE_FORCE_INDUSCODE_PASS_NOTICE: "1",
			}),
		).toBeDefined();
	});

	it("does not show when disabled through the environment", () => {
		const dataDir = createTempDataDir();

		expect(
			getIndusCodeCliMigrationNotice(dataDir, {
				INDUSCODE_DISABLE_INDUSCODE_PASS_NOTICE: "1",
			}),
		).toBeUndefined();
	});

	it("does not show the IndusCodePass intro when IndusCodePass is already the active provider", () => {
		const dataDir = createTempDataDir();

		expect(
			getIndusCodeCliMigrationNotice(
				dataDir,
				{},
				{ activeProviderId: "induscode-pass" },
			)?.id,
		).toBe("induscode-cli-desktop-launch");
	});

	it("suppresses the active IndusCodePass provider even when the provider id has surrounding whitespace", () => {
		expect(
			shouldSuppressIndusCodeCliMigrationNoticeForActiveProvider(" induscode-pass "),
		).toBe(true);
	});

	it("does not suppress the active IndusCodePass provider when forced", () => {
		expect(
			shouldSuppressIndusCodeCliMigrationNoticeForActiveProvider("induscode-pass", {
				INDUSCODE_FORCE_INDUSCODE_PASS_NOTICE: "1",
			}),
		).toBe(false);
	});

	it("shows for the active IndusCodePass provider when forced", () => {
		const dataDir = createTempDataDir();

		expect(
			getIndusCodeCliMigrationNotice(
				dataDir,
				{ INDUSCODE_FORCE_INDUSCODE_PASS_NOTICE: "1" },
				{ activeProviderId: "induscode-pass" },
			),
		).toBeDefined();
	});

	it("shows when forced even if disabled through the environment", () => {
		const dataDir = createTempDataDir();

		expect(
			getIndusCodeCliMigrationNotice(dataDir, {
				INDUSCODE_DISABLE_INDUSCODE_PASS_NOTICE: "1",
				INDUSCODE_FORCE_INDUSCODE_PASS_NOTICE: "1",
			}),
		).toBeDefined();
	});

	it("marks the notice as shown", () => {
		const dataDir = createTempDataDir();

		markIndusCodeCliMigrationNoticeShown(dataDir);

		const rawState = readFileSync(resolveCliNoticeStatePath(dataDir), "utf8");
		expect(rawState).toContain("induscode-cli-induscode-pass-intro");
		expect(getIndusCodeCliMigrationNotice(dataDir)?.id).not.toBe(
			"induscode-cli-induscode-pass-intro",
		);
	});
});
