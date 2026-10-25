import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	listLocalProviders: vi.fn(async () => ({ providers: [], settingsPath: "" })),
}));

vi.mock("@induscode/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@induscode/core")>();
	return {
		...actual,
		listLocalProviders: mocks.listLocalProviders,
	};
});

describe("listLocalProviders", () => {
	it("enables IndusCodePass when listing the SDK provider list", async () => {
		const { listLocalProviders } = await import("./provider-catalog");
		const manager = {} as never;

		await listLocalProviders(manager);

		expect(mocks.listLocalProviders).toHaveBeenCalledWith(manager, {
			isIndusCodePassEnabled: true,
		});
	});
});
