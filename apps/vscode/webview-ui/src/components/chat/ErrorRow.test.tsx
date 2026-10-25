import type { IndusCodeMessage } from "@shared/ExtensionMessage"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ErrorRow from "./ErrorRow"

const mockSetUserOrganization = vi.hoisted(() => vi.fn())
const mockUpdateApiConfigurationProto = vi.hoisted(() => vi.fn())
const mockNavigateToSettingsModelPicker = vi.hoisted(() => vi.fn())
const mockApiConfiguration = vi.hoisted(() => ({
	planModeApiProvider: "induscode-pass",
	actModeApiProvider: "induscode-pass",
	planModeIndusCodePassModelId: "induscode-pass/test-plan-model",
	actModeIndusCodePassModelId: "induscode-pass/test-act-model",
}))

// Mock the auth context
vi.mock("@/context/IndusCodeAuthContext", () => ({
	useIndusCodeAuth: () => ({
		induscodeUser: null,
		switchOrganization: mockSetUserOrganization,
		accountSwitch: null,
	}),
	useIndusCodeSignIn: () => ({
		isLoginLoading: false,
	}),
	handleSignOut: vi.fn(),
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		apiConfiguration: mockApiConfiguration,
		mode: "act",
		providerModelsByProvider: {},
		startProviderModelsRequest: vi.fn(),
		applyProviderModelsResponse: vi.fn(),
		navigateToSettingsModelPicker: mockNavigateToSettingsModelPicker,
	}),
}))

// Mock CreditLimitError component
vi.mock("@/components/chat/CreditLimitError", () => ({
	default: ({ message }: { message: string }) => <div data-testid="credit-limit-error">{message}</div>,
}))

// Mock EntitlementError component
vi.mock("@/components/chat/EntitlementError", () => ({
	default: ({ message }: { message: string }) => <div data-testid="entitlement-error">{message}</div>,
}))

vi.mock("@/services/grpc-client", () => ({
	AccountServiceClient: {
		setUserOrganization: mockSetUserOrganization,
	},
	ModelsServiceClient: {
		updateApiConfigurationProto: mockUpdateApiConfigurationProto,
		commitModelSelection: vi.fn().mockResolvedValue({}),
		resolveProviderModels: vi.fn().mockResolvedValue({ providerId: "induscode", models: {} }),
	},
}))

// Mock IndusCodeError
vi.mock("../../../../src/services/error/IndusCodeError", () => ({
	IndusCodeError: {
		parse: vi.fn(),
	},
	IndusCodeErrorType: {
		Balance: "balance",
		RateLimit: "rateLimit",
		Auth: "auth",
		Entitlement: "entitlement",
		OrgIndusCodePassRestriction: "orgIndusCodePassRestriction",
		IndusCodePassLimit: "induscodePassLimit",
		IndusCodeFreeModelLimit: "induscodeFreeModelLimit",
		IndusCodeFreePromotionEnded: "induscodeFreePromotionEnded",
		QuotaExceeded: "quotaExceeded",
		NotFound: "notFound",
	},
	MODEL_NOT_FOUND_GUIDANCE: "Check the model ID and base URL in API Configuration settings.",
}))

describe("ErrorRow", () => {
	const mockMessage: IndusCodeMessage = {
		ts: 123456789,
		type: "say",
		say: "error",
		text: "Test error message",
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockSetUserOrganization.mockResolvedValue(true)
		mockUpdateApiConfigurationProto.mockResolvedValue({})
	})

	it("renders basic error message", () => {
		render(<ErrorRow errorType="error" message={mockMessage} />)

		expect(screen.getByText("Test error message")).toBeInTheDocument()
	})

	it("renders mistake limit reached error", () => {
		const mistakeMessage = { ...mockMessage, text: "Mistake limit reached" }
		render(<ErrorRow errorType="mistake_limit_reached" message={mistakeMessage} />)

		expect(screen.getByText("Mistake limit reached")).toBeInTheDocument()
	})

	it("renders diff error", () => {
		render(<ErrorRow errorType="diff_error" message={mockMessage} />)

		expect(
			screen.getByText("The model used search patterns that don't match anything in the file. Retrying..."),
		).toBeInTheDocument()
	})

	it("renders induscodeignore error", () => {
		const induscodeignoreMessage = { ...mockMessage, text: "/path/to/file.txt" }
		render(<ErrorRow errorType="induscodeignore_error" message={induscodeignoreMessage} />)

		expect(screen.getByText(/IndusCode tried to access/)).toBeInTheDocument()
		expect(screen.getByText("/path/to/file.txt")).toBeInTheDocument()
	})

	describe("API error handling", () => {
		it("renders credit limit error when balance error is detected", async () => {
			const mockIndusCodeError = {
				message: "Insufficient credits",
				isErrorType: vi.fn((type) => type === "balance"),
				_error: {
					details: {
						current_balance: 0,
						total_spent: 10.5,
						total_promotions: 5.0,
						message: "You have run out of credits.",
						buy_credits_url: "https://app.induscode.bot/dashboard",
					},
				},
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage="Insufficient credits error" errorType="error" message={mockMessage} />)

			expect(screen.getByTestId("credit-limit-error")).toBeInTheDocument()
			expect(screen.getByText("You have run out of credits.")).toBeInTheDocument()
		})

		it("does not show IndusCode credits CTA for non-IndusCode balance errors without a provider URL", async () => {
			const mockIndusCodeError = {
				message: "Not enough credits available",
				providerId: "zai",
				isErrorType: vi.fn((type) => type === "balance"),
				_error: {
					code: "insufficient_credits",
					providerId: "zai",
					details: {
						current_balance: 0,
						message: "Not enough credits available",
					},
				},
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage="Insufficient credits error" errorType="error" message={mockMessage} />)

			expect(screen.queryByTestId("credit-limit-error")).not.toBeInTheDocument()
			expect(screen.getByText(/\[zai\]/)).toBeInTheDocument()
		})

		it("renders rate limit error with request ID", async () => {
			const mockIndusCodeError = {
				message: "Rate limit exceeded",
				isErrorType: vi.fn((type) => type === "rateLimit"),
				_error: {
					request_id: "req_123456",
				},
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage="Rate limit exceeded" errorType="error" message={mockMessage} />)

			expect(screen.getByText("Rate limit exceeded")).toBeInTheDocument()
			expect(screen.getByText("Request ID: req_123456")).toBeInTheDocument()
		})

		it("renders quota exceeded error", async () => {
			const mockIndusCodeError = {
				message: "Inference cap reached",
				isErrorType: vi.fn((type) => type === "quotaexceeded"),
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage="The message" errorType="error" message="" />)
			expect(screen.getByText("Inference cap reached")).toBeInTheDocument()
		})

		it("renders entitlement error when IndusCodeError detects IndusCodeNotSubscribedError", async () => {
			const cliMessage =
				"No access to IndusCodePass subscription models yet. Subscribe to IndusCodePass, the low cost open weights model coding plan:"
			const mockIndusCodeError = {
				message: cliMessage,
				isErrorType: vi.fn((type) => type === "entitlement"),
				providerId: "induscode-pass",
				_error: {
					message: cliMessage,
				},
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage={cliMessage} errorType="error" message={mockMessage} />)

			expect(screen.getByTestId("entitlement-error")).toBeInTheDocument()
			expect(screen.getByText(cliMessage)).toBeInTheDocument()
			expect(screen.queryByText(/\[induscode-pass\]/i)).not.toBeInTheDocument()
		})

		it("renders entitlement error when IndusCodeError detects a raw required-plan message", async () => {
			const rawMessage = "403 Error 403: the user is not subscribed to required model plan"
			const mockIndusCodeError = {
				message: rawMessage,
				isErrorType: vi.fn((type) => type === "entitlement"),
				providerId: "induscode-pass",
				_error: {
					message: rawMessage,
				},
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage={rawMessage} errorType="error" message={mockMessage} />)

			expect(screen.getByTestId("entitlement-error")).toBeInTheDocument()
			expect(screen.getByText(rawMessage)).toBeInTheDocument()
		})

		it("renders organization account IndusCodePass restriction with friendly account switching copy", async () => {
			const rawMessage = "403 Error 403: organization accounts cannot use individual model inference subscriptions"
			const mockIndusCodeError = {
				message: rawMessage,
				isErrorType: vi.fn((type) => type === "orgIndusCodePassRestriction"),
				providerId: "induscode",
				_error: {
					message: rawMessage,
				},
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage={rawMessage} errorType="error" message={mockMessage} />)

			expect(screen.getByTestId("org-induscode-pass-restriction-error")).toBeInTheDocument()
			expect(screen.getByText(/Organization accounts cannot use IndusCodePass subscriptions/)).toBeInTheDocument()
			expect(screen.queryByText(rawMessage)).not.toBeInTheDocument()

			fireEvent.click(screen.getByText("Switch to personal account"))

			await waitFor(() => expect(mockSetUserOrganization).toHaveBeenCalledWith())
			expect(screen.getByText("Switched to personal account")).toBeInTheDocument()
		})

		it("renders organization IndusCodePass restriction when IndusCodeError detects the SDK formatted message", async () => {
			const formattedMessage =
				"Organization accounts cannot use IndusCodePass subscriptions. Go to /account -> change account to switch to your personal account for IndusCodePass"
			const mockIndusCodeError = {
				message: formattedMessage,
				isErrorType: vi.fn((type) => type === "orgIndusCodePassRestriction"),
				providerId: "induscode-pass",
				_error: {
					message: formattedMessage,
				},
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage={formattedMessage} errorType="error" message={mockMessage} />)

			expect(screen.getByTestId("org-induscode-pass-restriction-error")).toBeInTheDocument()
			expect(screen.queryByText(formattedMessage)).not.toBeInTheDocument()
		})

		it("renders IndusCodePass limit error and switches to IndusCode usage-based billing", async () => {
			const limitMessage = "You have reached your weekly IndusCodepass limit. The limit resets in 7d, please try again later."
			const mockIndusCodeError = {
				message: limitMessage,
				isErrorType: vi.fn((type) => type === "induscodePassLimit"),
				providerId: "induscode-pass",
				_error: {
					message: limitMessage,
				},
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage={limitMessage} errorType="error" message={mockMessage} />)

			expect(screen.getByTestId("induscode-pass-limit-error")).toBeInTheDocument()
			expect(screen.getByText(limitMessage)).toBeInTheDocument()

			fireEvent.click(screen.getByText("Switch to Usage-Based billing"))

			await waitFor(() => expect(mockUpdateApiConfigurationProto).toHaveBeenCalledTimes(1))
			const request = mockUpdateApiConfigurationProto.mock.calls[0][0]
			expect(request.apiConfiguration.planModeApiProvider).toBe("induscode")
			expect(request.apiConfiguration.actModeApiProvider).toBe("induscode")
			expect(request.apiConfiguration.planModeIndusCodeModelId).toBeUndefined()
			expect(request.apiConfiguration.actModeIndusCodeModelId).toBeUndefined()
			expect(screen.getByText("Switched to Usage-Based billing")).toBeInTheDocument()
		})

		it("renders a daily free model limit without usage-billing guidance", async () => {
			const limitMessage = "Daily free limit reached on model deepseek/deepseek-v4-flash. Try again in 23h 59m"
			const mockIndusCodeError = {
				message: limitMessage,
				isErrorType: vi.fn((type) => type === "induscodeFreeModelLimit"),
				providerId: "induscode",
				_error: { message: limitMessage },
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage={limitMessage} errorType="error" message={mockMessage} />)

			expect(screen.getByTestId("induscode-free-model-limit-error")).toBeInTheDocument()
			expect(screen.getByText(/You've reached today's free usage limit for this model/)).toBeInTheDocument()
			expect(screen.getByText(/Try again in 23h 59m/)).toBeInTheDocument()
			expect(screen.queryByText(limitMessage)).not.toBeInTheDocument()
			expect(screen.queryByText(/deepseek-v4-flash/i)).not.toBeInTheDocument()
			expect(screen.queryByText(/Switch to Usage-Based billing/i)).not.toBeInTheDocument()
		})

		it("renders the promotion-ended card with a route into the model picker", async () => {
			const rawMessage = "Error 404: Model not found"
			const mockIndusCodeError = {
				message: rawMessage,
				isErrorType: vi.fn((type) => type === "induscodeFreePromotionEnded"),
				providerId: "induscode",
				modelId: "induscode-free/glm-5",
				_error: { message: rawMessage },
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage={rawMessage} errorType="error" message={mockMessage} />)

			expect(screen.getByTestId("induscode-free-promotion-ended-error")).toBeInTheDocument()
			expect(screen.getByText("Free model promotion ended")).toBeInTheDocument()
			expect(screen.getByText(/no longer available/)).toBeInTheDocument()
			// The raw backend message is replaced by the dedicated copy.
			expect(screen.queryByText(rawMessage)).not.toBeInTheDocument()

			fireEvent.click(screen.getByText("Select a Model"))
			expect(mockNavigateToSettingsModelPicker).toHaveBeenCalledWith({ targetSection: "api-config" })
		})

		it("renders friendly logged-out message and sign in button when user is not signed in", async () => {
			const mockIndusCodeError = {
				message: "Authentication failed",
				isErrorType: vi.fn((type) => type === "auth"),
				providerId: "induscode",
				_error: {},
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage="Authentication failed" errorType="error" message={mockMessage} />)

			expect(screen.queryByText("Authentication failed")).not.toBeInTheDocument()
			expect(screen.getByText(/Whoops looks like you're logged out/)).toBeInTheDocument()
			expect(screen.getByText("Sign in to IndusCode")).toBeInTheDocument()
		})

		it("renders a 404 as the real message plus model/endpoint guidance, never the sign-in prompt", async () => {
			const rawMessage = 'model "qwen3-coder" not found'
			const mockIndusCodeError = {
				message: rawMessage,
				isErrorType: vi.fn((type) => type === "notFound"),
				providerId: "openai-compatible",
				_error: { message: rawMessage, status: 404 },
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage={rawMessage} errorType="error" message={mockMessage} />)

			expect(screen.getByText(rawMessage)).toBeInTheDocument()
			expect(screen.getByText(/The model or endpoint was not found/)).toBeInTheDocument()
			expect(screen.getByText(/Check the model ID and base URL/)).toBeInTheDocument()
			expect(screen.queryByText(/logged out/)).not.toBeInTheDocument()
			expect(screen.queryByText("Sign in to IndusCode")).not.toBeInTheDocument()
		})

		it("does not repeat guidance the host already appended to a not-found message", async () => {
			const rawMessage = "Model not found Check the model ID and base URL in API Configuration settings."
			const mockIndusCodeError = {
				message: rawMessage,
				isErrorType: vi.fn((type) => type === "notFound"),
				providerId: "induscode",
				_error: { message: rawMessage, status: 404 },
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage={rawMessage} errorType="error" message={mockMessage} />)

			expect(screen.getAllByText(/Check the model ID and base URL/)).toHaveLength(1)
			expect(screen.queryByText(/The model or endpoint was not found/)).not.toBeInTheDocument()
		})

		it("renders a 404 from the induscode provider as the real message, not the logged-out card", async () => {
			const rawMessage = "Error 404: Model not found"
			const mockIndusCodeError = {
				message: rawMessage,
				isErrorType: vi.fn((type) => type === "notFound"),
				providerId: "induscode",
				_error: { message: rawMessage, status: 404 },
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiRequestFailedMessage={rawMessage} errorType="error" message={mockMessage} />)

			expect(screen.getByText(rawMessage)).toBeInTheDocument()
			expect(screen.queryByText(/logged out/)).not.toBeInTheDocument()
			expect(screen.queryByText("Sign in to IndusCode")).not.toBeInTheDocument()
		})

		it("renders PowerShell troubleshooting link when error mentions PowerShell", async () => {
			const mockIndusCodeError = {
				message: "PowerShell is not recognized as an internal or external command",
				isErrorType: vi.fn(() => false),
				_error: {},
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(
				<ErrorRow
					apiRequestFailedMessage="PowerShell is not recognized as an internal or external command"
					errorType="error"
					message={mockMessage}
				/>,
			)

			expect(screen.getByText(/PowerShell is not recognized/)).toBeInTheDocument()
			expect(screen.getByText("troubleshooting guide")).toBeInTheDocument()
			expect(screen.getByRole("link", { name: "troubleshooting guide" })).toHaveAttribute(
				"href",
				"https://github.com/induscode/induscode/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22",
			)
		})

		it("handles apiReqStreamingFailedMessage instead of apiRequestFailedMessage", async () => {
			const mockIndusCodeError = {
				message: "Streaming failed",
				isErrorType: vi.fn(() => false),
				_error: {},
			}

			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(mockIndusCodeError as any)

			render(<ErrorRow apiReqStreamingFailedMessage="Streaming failed" errorType="error" message={mockMessage} />)

			expect(screen.getByText("Streaming failed")).toBeInTheDocument()
		})

		it("falls back to regular error message when IndusCodeError.parse returns null", async () => {
			const { IndusCodeError } = await import("../../../../src/services/error/IndusCodeError")
			vi.mocked(IndusCodeError.parse).mockReturnValue(undefined)

			render(<ErrorRow apiRequestFailedMessage="Some API error" errorType="error" message={mockMessage} />)

			// When IndusCodeError.parse returns null, we display the raw error message for non-IndusCode providers
			// Since induscodeError is undefined, isIndusCodeUsageBillingProvider is false, so we show the raw apiRequestFailedMessage
			expect(screen.getByText("Some API error")).toBeInTheDocument()
		})

		it("renders regular error message when no API error messages are provided", () => {
			render(<ErrorRow errorType="error" message={mockMessage} />)

			expect(screen.getByText("Test error message")).toBeInTheDocument()
		})
	})
})
