import { beforeEach, describe, expect, it, vi } from "vitest"
import { version as extensionVersion } from "../../package.json"

const mocks = vi.hoisted(() => ({
	getHostVersion: vi.fn(),
	getWorkspacePaths: vi.fn(),
}))

vi.mock("@/hosts/host-provider", () => ({
	HostProvider: {
		env: { getHostVersion: mocks.getHostVersion },
		workspace: { getWorkspacePaths: mocks.getWorkspacePaths },
	},
}))

import { resolveIndusCodeRequestClientContext } from "./induscode-session-factory"

describe("resolveIndusCodeRequestClientContext", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("reports the host's identity", async () => {
		mocks.getHostVersion.mockResolvedValue({
			induscodeType: "IndusCode for JetBrains",
			induscodeVersion: "4.2.0",
			platform: "IntelliJ IDEA",
			version: "2025.3",
		})
		mocks.getWorkspacePaths.mockResolvedValue({ paths: ["/a", "/b"] })

		await expect(resolveIndusCodeRequestClientContext()).resolves.toEqual({
			name: "IndusCode for JetBrains",
			version: "4.2.0",
			platform: "IntelliJ IDEA",
			platformVersion: "2025.3",
			isMultiRoot: true,
		})
	})

	it("falls back to the extension's own identity when the host bridge fails", async () => {
		mocks.getHostVersion.mockRejectedValue(new Error("bridge down"))
		mocks.getWorkspacePaths.mockRejectedValue(new Error("bridge down"))

		await expect(resolveIndusCodeRequestClientContext()).resolves.toEqual({
			name: "VSCode Extension",
			version: extensionVersion,
			platform: undefined,
			platformVersion: undefined,
			isMultiRoot: false,
		})
	})
})
