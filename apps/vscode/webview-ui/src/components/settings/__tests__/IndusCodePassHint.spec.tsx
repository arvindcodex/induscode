import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useIndusCodePassPromo } from "@/hooks/useIndusCodePassPromo"
import { StateServiceClient } from "@/services/grpc-client"
import { clearSessionBannerDismissalsForTesting } from "@/utils/sessionBannerDismissals"
import { IndusCodePassHint } from "../IndusCodePassHint"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

vi.mock("@/hooks/useIndusCodePassPromo", async (importOriginal) => {
	const actual = await importOriginal()
	return {
		...(actual as Record<string, unknown>),
		useIndusCodePassPromo: vi.fn(),
	}
})

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(),
}))

vi.mock("@/services/grpc-client", () => ({
	StateServiceClient: {
		dismissBanner: vi.fn(() => Promise.resolve({})),
	},
}))

vi.mock("../utils/useApiConfigurationHandlers", () => ({
	useApiConfigurationHandlers: vi.fn(),
}))

const mockHandleModeFieldChange = vi.fn(() => Promise.resolve())

const mockExtensionState = (overrides: Record<string, unknown> = {}) => {
	vi.mocked(useExtensionState).mockReturnValue({
		dismissedBanners: [],
		...overrides,
	} as any)
}

const mockPromo = (overrides: Partial<ReturnType<typeof useIndusCodePassPromo>> = {}) => {
	vi.mocked(useIndusCodePassPromo).mockReturnValue({
		isIndusCodePassEnabled: true,
		...overrides,
	} as any)
}

describe("IndusCodePassHint", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		clearSessionBannerDismissalsForTesting()
		mockPromo()
		vi.mocked(useApiConfigurationHandlers).mockReturnValue({
			handleModeFieldChange: mockHandleModeFieldChange,
		} as any)
		mockExtensionState()
	})

	it("shows the hint for non-IndusCodePass providers", () => {
		render(<IndusCodePassHint currentMode="plan" selectedProvider="anthropic" />)
		expect(screen.getByTestId("induscode-pass-settings-hint")).toBeInTheDocument()
	})

	it("selects the IndusCodePass provider for the current mode when clicking Try it", () => {
		render(<IndusCodePassHint currentMode="plan" selectedProvider="anthropic" />)
		fireEvent.click(screen.getByText("Try it"))
		expect(mockHandleModeFieldChange).toHaveBeenCalledWith(
			{ plan: "planModeApiProvider", act: "actModeApiProvider" },
			"induscode-pass",
			"plan",
		)
	})

	it("hides the hint when IndusCodePass promotions are disabled (self-hosted or org allowlist)", () => {
		mockPromo({ isIndusCodePassEnabled: false })
		render(<IndusCodePassHint currentMode="plan" selectedProvider="anthropic" />)
		expect(screen.queryByTestId("induscode-pass-settings-hint")).not.toBeInTheDocument()
	})

	it("hides the hint when IndusCodePass is already selected", () => {
		render(<IndusCodePassHint currentMode="plan" selectedProvider="induscode-pass" />)
		expect(screen.queryByTestId("induscode-pass-settings-hint")).not.toBeInTheDocument()
	})

	it("hides the hint once dismissed and persists the dismissal", () => {
		render(<IndusCodePassHint currentMode="plan" selectedProvider="anthropic" />)
		fireEvent.click(screen.getByLabelText("Dismiss IndusCodePass hint"))
		expect(screen.queryByTestId("induscode-pass-settings-hint")).not.toBeInTheDocument()
		expect(StateServiceClient.dismissBanner).toHaveBeenCalledWith({ value: "induscode-pass-settings-hint-v1" })
	})

	it("stays hidden after a remount within the same session", () => {
		const { unmount } = render(<IndusCodePassHint currentMode="plan" selectedProvider="anthropic" />)
		fireEvent.click(screen.getByLabelText("Dismiss IndusCodePass hint"))
		unmount()
		// Remount before the persisted dismissal has synced back from the host
		render(<IndusCodePassHint currentMode="plan" selectedProvider="anthropic" />)
		expect(screen.queryByTestId("induscode-pass-settings-hint")).not.toBeInTheDocument()
	})

	it("stays hidden when a previous dismissal is in extension state", () => {
		mockExtensionState({ dismissedBanners: [{ bannerId: "induscode-pass-settings-hint-v1", dismissedAt: 1 }] })
		render(<IndusCodePassHint currentMode="plan" selectedProvider="anthropic" />)
		expect(screen.queryByTestId("induscode-pass-settings-hint")).not.toBeInTheDocument()
	})
})
