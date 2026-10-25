import { beforeEach, describe, expect, it, vi } from "vitest"

const identityMocks = vi.hoisted(() => ({
	setIndusCodeClientIdentity: vi.fn(),
}))

const hostState = vi.hoisted(() => ({
	hostVersion: {} as {
		platform?: string
		version?: string
		induscodeType?: string
		induscodeVersion?: string
	},
	hostVersionError: undefined as Error | undefined,
}))

vi.mock("@induscode/shared", () => ({
	setIndusCodeClientIdentity: identityMocks.setIndusCodeClientIdentity,
}))

vi.mock("@/hosts/host-provider", () => ({
	HostProvider: {
		env: {
			getHostVersion: vi.fn(async () => {
				if (hostState.hostVersionError) {
					throw hostState.hostVersionError
				}
				return hostState.hostVersion
			}),
		},
	},
}))

vi.mock("@/shared/services/Logger", () => ({
	Logger: { log: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock("@/registry", () => ({
	ExtensionRegistryInfo: { version: "9.9.9" },
}))

import { registerIndusCodeClientIdentity } from "./IndusCodeClientIdentity"

describe("registerIndusCodeClientIdentity", () => {
	beforeEach(() => {
		identityMocks.setIndusCodeClientIdentity.mockClear()
		hostState.hostVersionError = undefined
		hostState.hostVersion = {
			platform: "Visual Studio Code",
			version: "1.103.0",
			induscodeType: "VSCode Extension",
			induscodeVersion: "3.40.0",
		}
	})

	it("publishes the host-reported client identity", async () => {
		await registerIndusCodeClientIdentity()

		expect(identityMocks.setIndusCodeClientIdentity).toHaveBeenCalledWith({
			name: "VSCode Extension",
			version: "3.40.0",
			platform: "Visual Studio Code",
			platformVersion: "1.103.0",
		})
	})

	it("falls back to the extension's own identity when the host bridge fails", async () => {
		hostState.hostVersionError = new Error("host bridge unavailable")

		await registerIndusCodeClientIdentity()

		expect(identityMocks.setIndusCodeClientIdentity).toHaveBeenCalledWith({
			name: "VSCode Extension",
			version: "9.9.9",
		})
	})
})
