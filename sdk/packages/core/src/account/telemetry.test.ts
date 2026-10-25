import { describe, expect, it, vi } from "vitest";
import {
	persistIndusCodeAccountTelemetryIdentity,
	resolveIndusCodeAccountTelemetryIdentity,
} from "./telemetry";
import type { IndusCodeAccountUser } from "./types";

function createUser(
	overrides: Partial<IndusCodeAccountUser> = {},
): IndusCodeAccountUser {
	return {
		id: "user-1",
		email: "user@example.com",
		displayName: "User",
		photoUrl: "",
		createdAt: "",
		updatedAt: "",
		organizations: [],
		...overrides,
	};
}

describe("IndusCode account telemetry identity", () => {
	it("resolves the active organization", () => {
		const identity = resolveIndusCodeAccountTelemetryIdentity(
			createUser({
				organizations: [
					{
						active: true,
						memberId: "member-1",
						name: "Acme",
						organizationId: "org-1",
						roles: ["member"],
					},
				],
			}),
		);

		expect(identity).toEqual({
			id: "user-1",
			email: "user@example.com",
			provider: "induscode",
			organizationId: "org-1",
			organizationName: "Acme",
			memberId: "member-1",
		});
	});

	it("persists organization context for detached runtimes", () => {
		const saveProviderSettings = vi.fn();
		const manager = {
			getProviderSettings: vi.fn(() => ({
				provider: "induscode" as const,
				auth: { accountId: "user-1", accessToken: "secret" },
			})),
			saveProviderSettings,
		};
		const identity = resolveIndusCodeAccountTelemetryIdentity(
			createUser({
				organizations: [
					{
						active: true,
						memberId: "member-1",
						name: "Acme",
						organizationId: "org-1",
						roles: ["member"],
					},
				],
			}),
		);

		expect(persistIndusCodeAccountTelemetryIdentity(manager, identity)).toBe(true);
		expect(saveProviderSettings).toHaveBeenCalledWith(
			{
				provider: "induscode",
				auth: {
					accountId: "user-1",
					accessToken: "secret",
					organizationId: "org-1",
					organizationName: "Acme",
					memberId: "member-1",
				},
			},
			{ setLastUsed: false },
		);
	});

	it("replaces stale persisted account identity after an account switch", () => {
		const saveProviderSettings = vi.fn();
		const manager = {
			getProviderSettings: vi.fn(() => ({
				provider: "induscode" as const,
				auth: { accountId: "old-user", accessToken: "secret" },
			})),
			saveProviderSettings,
		};

		persistIndusCodeAccountTelemetryIdentity(manager, {
			id: "new-user",
			provider: "induscode",
		});

		expect(saveProviderSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				auth: expect.objectContaining({ accountId: "new-user" }),
			}),
			{ setLastUsed: false },
		);
	});
});
