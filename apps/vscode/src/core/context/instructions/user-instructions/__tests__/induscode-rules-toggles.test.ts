import { describe, it } from "bun:test"
import { expect } from "chai"
import fs from "fs/promises"
import os from "os"
import path from "path"
import type { Controller } from "@/core/controller"
import { refreshIndusCodeRulesToggles } from "../induscode-rules"

/**
 * Minimal Controller stub: refreshIndusCodeRulesToggles only touches the
 * stateManager toggle accessors.
 */
function makeControllerStub(initial: {
	globalIndusCodeRulesToggles?: Record<string, boolean>
	localIndusCodeRulesToggles?: Record<string, boolean>
}) {
	const globalState = new Map<string, unknown>([["globalIndusCodeRulesToggles", initial.globalIndusCodeRulesToggles ?? {}]])
	const workspaceState = new Map<string, unknown>([["localIndusCodeRulesToggles", initial.localIndusCodeRulesToggles ?? {}]])
	const controller = {
		stateManager: {
			getGlobalSettingsKey: (key: string) => globalState.get(key) ?? {},
			getWorkspaceStateKey: (key: string) => workspaceState.get(key) ?? {},
			setGlobalState: (key: string, value: unknown) => globalState.set(key, value),
			setWorkspaceState: (key: string, value: unknown) => workspaceState.set(key, value),
		},
	}
	return controller as unknown as Controller
}

describe("refreshIndusCodeRulesToggles workspace layouts", () => {
	it("discovers rules in both .induscoderules and .induscode/rules", async () => {
		const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "induscode-rules-layouts-"))
		try {
			const legacyDir = path.join(workspace, ".induscoderules")
			const induscodeRulesDir = path.join(workspace, ".induscode", "rules")
			await fs.mkdir(legacyDir, { recursive: true })
			await fs.mkdir(induscodeRulesDir, { recursive: true })
			await fs.writeFile(path.join(legacyDir, "legacy-rule.md"), "Legacy layout rule")
			await fs.writeFile(path.join(induscodeRulesDir, "new-rule.md"), "New layout rule")

			const controller = makeControllerStub({})
			const { localToggles } = await refreshIndusCodeRulesToggles(controller, workspace)

			expect(localToggles).to.have.property(path.join(legacyDir, "legacy-rule.md"), true)
			expect(localToggles).to.have.property(path.join(induscodeRulesDir, "new-rule.md"), true)
		} finally {
			await fs.rm(workspace, { recursive: true, force: true })
		}
	})

	it("discovers .induscode/rules rules when no .induscoderules directory exists", async () => {
		const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "induscode-rules-newonly-"))
		try {
			const induscodeRulesDir = path.join(workspace, ".induscode", "rules")
			await fs.mkdir(induscodeRulesDir, { recursive: true })
			await fs.writeFile(path.join(induscodeRulesDir, "only-rule.md"), "Only .induscode/rules layout")

			const controller = makeControllerStub({})
			const { localToggles } = await refreshIndusCodeRulesToggles(controller, workspace)

			expect(localToggles).to.deep.equal({
				[path.join(induscodeRulesDir, "only-rule.md")]: true,
			})
		} finally {
			await fs.rm(workspace, { recursive: true, force: true })
		}
	})

	it("preserves disabled toggles per layout and prunes deleted files", async () => {
		const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "induscode-rules-toggles-"))
		try {
			const legacyDir = path.join(workspace, ".induscoderules")
			const induscodeRulesDir = path.join(workspace, ".induscode", "rules")
			await fs.mkdir(legacyDir, { recursive: true })
			await fs.mkdir(induscodeRulesDir, { recursive: true })
			const legacyRule = path.join(legacyDir, "a.md")
			const newRule = path.join(induscodeRulesDir, "b.md")
			await fs.writeFile(legacyRule, "A")
			await fs.writeFile(newRule, "B")

			const controller = makeControllerStub({
				localIndusCodeRulesToggles: {
					[legacyRule]: false,
					[newRule]: false,
					[path.join(induscodeRulesDir, "deleted.md")]: true,
				},
			})
			const { localToggles } = await refreshIndusCodeRulesToggles(controller, workspace)

			expect(localToggles).to.deep.equal({
				[legacyRule]: false,
				[newRule]: false,
			})
		} finally {
			await fs.rm(workspace, { recursive: true, force: true })
		}
	})

	it("still excludes .induscoderules workflows/hooks/skills sub-directories", async () => {
		const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "induscode-rules-excl-"))
		try {
			const legacyDir = path.join(workspace, ".induscoderules")
			await fs.mkdir(path.join(legacyDir, "workflows"), { recursive: true })
			await fs.mkdir(path.join(legacyDir, "hooks"), { recursive: true })
			await fs.writeFile(path.join(legacyDir, "rule.md"), "Rule")
			await fs.writeFile(path.join(legacyDir, "workflows", "flow.md"), "Workflow")
			await fs.writeFile(path.join(legacyDir, "hooks", "hook.sh"), "#!/bin/sh")

			const controller = makeControllerStub({})
			const { localToggles } = await refreshIndusCodeRulesToggles(controller, workspace)

			expect(localToggles).to.deep.equal({
				[path.join(legacyDir, "rule.md")]: true,
			})
		} finally {
			await fs.rm(workspace, { recursive: true, force: true })
		}
	})
})
