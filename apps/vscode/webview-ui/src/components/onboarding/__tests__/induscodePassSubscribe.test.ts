import { describe, expect, it, vi } from "vitest"

vi.mock("@/services/grpc-client", () => ({
	UiServiceClient: {
		openUrl: vi.fn(() => Promise.resolve({})),
	},
}))

import { buildIndusCodePassSubscribeUrl, buildIndusCodePassSubscriptionPageUrl } from "../induscodePassSubscribe"

describe("IndusCodePass subscription URLs", () => {
	it("falls back to the default app base URL", () => {
		expect(buildIndusCodePassSubscribeUrl(undefined)).toBe("https://app.induscode.bot/onboarding/individual-plan")
		expect(buildIndusCodePassSubscriptionPageUrl(undefined)).toBe("https://app.induscode.bot/dashboard/subscription?personal=true")
	})

	it("preserves a path-prefixed app base URL", () => {
		expect(buildIndusCodePassSubscribeUrl("https://proxy.example.com/induscode")).toBe(
			"https://proxy.example.com/induscode/onboarding/individual-plan",
		)
		expect(buildIndusCodePassSubscriptionPageUrl("https://proxy.example.com/induscode")).toBe(
			"https://proxy.example.com/induscode/dashboard/subscription?personal=true",
		)
	})

	it("trims trailing slashes from the base URL", () => {
		expect(buildIndusCodePassSubscribeUrl("https://app.induscode.bot/")).toBe("https://app.induscode.bot/onboarding/individual-plan")
	})
})
