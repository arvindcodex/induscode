import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useApiConfigurationHandlers } from "@/components/settings/utils/useApiConfigurationHandlers"
import { useIndusCodeAuth } from "@/context/IndusCodeAuthContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useIndusCodePassPromo } from "../useIndusCodePassPromo"

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(),
}))

vi.mock("@/context/IndusCodeAuthContext", () => ({
	useIndusCodeAuth: vi.fn(),
}))

vi.mock("@/components/settings/utils/useApiConfigurationHandlers", () => ({
	useApiConfigurationHandlers: vi.fn(),
}))

vi.mock("@/services/grpc-client", () => ({
	UiServiceClient: {
		openUrl: vi.fn(() => Promise.resolve({})),
	},
}))

const mockNavigateToSettings = vi.fn()
const mockHandleModeFieldChange = vi.fn(() => Promise.resolve())

const mockExtensionState = (overrides: Record<string, unknown> = {}) => {
	vi.mocked(useExtensionState).mockReturnValue({
		apiConfiguration: { planModeApiProvider: "anthropic", actModeApiProvider: "anthropic" },
		environment: "production",
		navigateToSettings: mockNavigateToSettings,
		remoteConfigSettings: undefined,
		mode: "act",
		planActSeparateModelsSetting: false,
		...overrides,
	} as any)
}

describe("useIndusCodePassPromo", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(useIndusCodeAuth).mockReturnValue({ induscodeUser: null } as any)
		vi.mocked(useApiConfigurationHandlers).mockReturnValue({
			handleModeFieldChange: mockHandleModeFieldChange,
		} as any)
		mockExtensionState()
	})

	it("is enabled when no remote config restricts providers", () => {
		const { result } = renderHook(() => useIndusCodePassPromo())
		expect(result.current.isIndusCodePassEnabled).toBe(true)
	})

	it("is disabled in self-hosted mode", () => {
		mockExtensionState({ environment: "selfHosted" })
		const { result } = renderHook(() => useIndusCodePassPromo())
		expect(result.current.isIndusCodePassEnabled).toBe(false)
	})

	it("is disabled when the environment is unknown", () => {
		mockExtensionState({ environment: undefined })
		const { result } = renderHook(() => useIndusCodePassPromo())
		expect(result.current.isIndusCodePassEnabled).toBe(false)
	})

	it("is disabled when the org remote config excludes induscode-pass", () => {
		mockExtensionState({ remoteConfigSettings: { remoteConfiguredProviders: ["anthropic", "openrouter"] } })
		const { result } = renderHook(() => useIndusCodePassPromo())
		expect(result.current.isIndusCodePassEnabled).toBe(false)
	})

	it("stays enabled when the org remote config includes induscode-pass", () => {
		mockExtensionState({ remoteConfigSettings: { remoteConfiguredProviders: ["anthropic", "induscode-pass"] } })
		const { result } = renderHook(() => useIndusCodePassPromo())
		expect(result.current.isIndusCodePassEnabled).toBe(true)
	})

	it("detects when either mode already uses the IndusCodePass provider", () => {
		mockExtensionState({
			apiConfiguration: { planModeApiProvider: "induscode-pass", actModeApiProvider: "anthropic" },
		})
		const { result } = renderHook(() => useIndusCodePassPromo())
		expect(result.current.isUsingIndusCodePass).toBe(true)
	})

	it("only reflects the current mode's provider when plan/act use separate models", () => {
		mockExtensionState({
			apiConfiguration: { planModeApiProvider: "induscode-pass", actModeApiProvider: "anthropic" },
			planActSeparateModelsSetting: true,
			mode: "act",
		})
		const { result: actResult } = renderHook(() => useIndusCodePassPromo())
		expect(actResult.current.isUsingIndusCodePass).toBe(false)

		mockExtensionState({
			apiConfiguration: { planModeApiProvider: "induscode-pass", actModeApiProvider: "anthropic" },
			planActSeparateModelsSetting: true,
			mode: "plan",
		})
		const { result: planResult } = renderHook(() => useIndusCodePassPromo())
		expect(planResult.current.isUsingIndusCodePass).toBe(true)
	})

	it("switches provider mode-aware and navigates to API settings on success", async () => {
		const { result } = renderHook(() => useIndusCodePassPromo())
		await result.current.switchToIndusCodePassProvider()
		// handleModeFieldChange only touches the current mode when plan/act use
		// separate models, so the other mode's provider is never overwritten.
		expect(mockHandleModeFieldChange).toHaveBeenCalledWith(
			{ plan: "planModeApiProvider", act: "actModeApiProvider" },
			"induscode-pass",
			"act",
		)
		expect(mockNavigateToSettings).toHaveBeenCalledWith("api-config")
	})

	it("passes the current plan mode to the provider update", async () => {
		mockExtensionState({ mode: "plan" })
		const { result } = renderHook(() => useIndusCodePassPromo())
		await result.current.switchToIndusCodePassProvider()
		expect(mockHandleModeFieldChange).toHaveBeenCalledWith(
			{ plan: "planModeApiProvider", act: "actModeApiProvider" },
			"induscode-pass",
			"plan",
		)
	})

	it("does not navigate to settings when the provider update fails", async () => {
		mockHandleModeFieldChange.mockRejectedValueOnce(new Error("update failed"))
		const { result } = renderHook(() => useIndusCodePassPromo())
		await result.current.switchToIndusCodePassProvider()
		expect(mockNavigateToSettings).not.toHaveBeenCalled()
	})

	it("reports selection success and failure via the returned promise", async () => {
		const { result } = renderHook(() => useIndusCodePassPromo())
		await expect(result.current.selectIndusCodePassProvider()).resolves.toBe(true)
		mockHandleModeFieldChange.mockRejectedValueOnce(new Error("update failed"))
		await expect(result.current.selectIndusCodePassProvider()).resolves.toBe(false)
	})
})
