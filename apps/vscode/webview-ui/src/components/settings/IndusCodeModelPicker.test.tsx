import { toProtobufModelInfo } from "@shared/proto-conversions/models/typeConversion"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useDynamicProviderSelection } from "@/hooks/useDynamicProviderSelection"
import { useProviderConfig } from "@/hooks/useProviderConfig"
import { useProviderModels } from "@/hooks/useProviderModels"
import IndusCodeModelPicker from "./IndusCodeModelPicker"

const mocks = vi.hoisted(() => ({
	commitSelection: vi.fn(async () => undefined),
	writeProviderConfig: vi.fn(async () => undefined),
	updateApiConfigurationProto: vi.fn(async () => undefined),
	makeUnaryRequest: vi.fn(async () => ({
		recommended: [
			{
				id: "induscode-next",
				name: "IndusCode Next",
				description: "Next IndusCode model",
				tags: ["recommended"],
			},
		],
		free: [],
	})),
	toggleFavoriteModel: vi.fn(async () => undefined),
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(),
}))

vi.mock("@/hooks/useDynamicProviderSelection", () => ({
	useDynamicProviderSelection: vi.fn(),
}))

vi.mock("@/hooks/useProviderModels", () => ({
	useProviderModels: vi.fn(),
}))

vi.mock("@/hooks/useProviderConfig", () => ({
	useProviderConfig: vi.fn(),
}))

vi.mock("@/services/grpc-client", () => ({
	ModelsServiceClient: {
		makeUnaryRequest: mocks.makeUnaryRequest,
		updateApiConfigurationProto: mocks.updateApiConfigurationProto,
	},
	StateServiceClient: {
		toggleFavoriteModel: mocks.toggleFavoriteModel,
	},
}))

describe("IndusCodeModelPicker", () => {
	beforeEach(() => {
		vi.clearAllMocks()

		vi.mocked(useExtensionState).mockReturnValue({
			apiConfiguration: {
				actModeIndusCodeModelId: "induscode-default",
				actModeIndusCodeModelInfo: {
					name: "IndusCode Default",
					supportsPromptCache: true,
				},
			},
			favoritedModelIds: [],
			planActSeparateModelsSetting: true,
		} as ReturnType<typeof useExtensionState>)

		vi.mocked(useProviderModels).mockReturnValue({
			models: {
				"induscode-default": { name: "IndusCode Default", supportsPromptCache: true },
				"induscode-next": {
					name: "IndusCode Next",
					supportsPromptCache: true,
					contextWindow: 128_000,
				},
			},
			defaultModelId: "induscode-default",
			isLoading: false,
			isStale: false,
			error: undefined,
			refresh: vi.fn(),
			fingerprint: "fingerprint",
		})

		vi.mocked(useProviderConfig).mockReturnValue({
			config: undefined,
			write: mocks.writeProviderConfig,
			commitSelection: mocks.commitSelection,
		})

		vi.mocked(useDynamicProviderSelection).mockReturnValue({
			selectedModelId: "induscode-default",
			selectedModelInfo: { name: "IndusCode Default", supportsPromptCache: true },
			hideUsageCost: false,
		})
	})

	it("commits IndusCode model selections through provider config so providers.json is updated", async () => {
		render(<IndusCodeModelPicker currentMode="act" />)

		// Featured cards render the display name from the RPC, but selection
		// still commits the underlying model id.
		fireEvent.click(await screen.findByText("IndusCode Next"))

		await waitFor(() => expect(mocks.commitSelection).toHaveBeenCalledTimes(1))
		expect(mocks.commitSelection).toHaveBeenCalledWith("act", {
			providerId: "induscode",
			modelId: "induscode-next",
		})
	})

	it("renders RPC-provided display names on featured cards, falling back to ids", async () => {
		// Names arrive display-ready: the extension host resolves them against
		// the model catalog in fetchIndusCodeRecommendedModels.
		mocks.makeUnaryRequest.mockResolvedValueOnce({
			recommended: [{ id: "anthropic/claude-opus-5", name: "Claude Opus 5", description: "Frontier model", tags: ["NEW"] }],
			free: [
				{ id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", description: "Fast and efficient", tags: [] },
				{ id: "unknown/mystery-model", name: "", description: "No display name", tags: [] },
			],
		})

		render(<IndusCodeModelPicker currentMode="act" />)

		expect(await screen.findByText("Claude Opus 5")).toBeInTheDocument()

		fireEvent.click(screen.getByText("Free"))

		expect(await screen.findByText("DeepSeek V4 Flash")).toBeInTheDocument()
		// A missing display name degrades to the raw id
		expect(screen.getByText("unknown/mystery-model")).toBeInTheDocument()
	})

	it("hydrates the selected IndusCode model from provider config when legacy settings are empty", () => {
		vi.mocked(useExtensionState).mockReturnValue({
			apiConfiguration: {},
			favoritedModelIds: [],
			planActSeparateModelsSetting: true,
		} as ReturnType<typeof useExtensionState>)
		vi.mocked(useProviderConfig).mockReturnValue({
			config: {
				providerId: "induscode",
				actSelection: {
					providerId: "induscode",
					modelId: "induscode-next",
					modelInfo: toProtobufModelInfo({
						name: "IndusCode Next",
						supportsPromptCache: true,
						contextWindow: 128_000,
					}),
				},
			},
			write: mocks.writeProviderConfig,
			commitSelection: mocks.commitSelection,
		})

		render(<IndusCodeModelPicker currentMode="act" />)

		expect(screen.getByRole("combobox")).toHaveValue("induscode-next")
	})

	it("uses live catalog reasoning support when the saved IndusCode model snapshot is stale", () => {
		vi.mocked(useExtensionState).mockReturnValue({
			apiConfiguration: {
				actModeIndusCodeModelId: "glm-5.2",
				actModeIndusCodeModelInfo: {
					name: "GLM 5.2",
					supportsPromptCache: true,
				},
			},
			favoritedModelIds: [],
			planActSeparateModelsSetting: true,
		} as ReturnType<typeof useExtensionState>)
		vi.mocked(useProviderModels).mockReturnValue({
			models: {
				"glm-5.2": {
					name: "GLM 5.2",
					supportsPromptCache: true,
					contextWindow: 1_048_576,
					supportsReasoning: true,
				},
			},
			defaultModelId: "glm-5.2",
			isLoading: false,
			isStale: false,
			error: undefined,
			refresh: vi.fn(),
			fingerprint: "fingerprint",
		})
		vi.mocked(useProviderConfig).mockReturnValue({
			config: {
				providerId: "induscode",
				actSelection: {
					providerId: "induscode",
					modelId: "glm-5.2",
					modelInfo: toProtobufModelInfo({
						name: "GLM 5.2",
						supportsPromptCache: true,
					}),
				},
			},
			write: mocks.writeProviderConfig,
			commitSelection: mocks.commitSelection,
		})
		vi.mocked(useDynamicProviderSelection).mockReturnValue({
			selectedModelId: "glm-5.2",
			selectedModelInfo: { name: "GLM 5.2", supportsPromptCache: true },
			hideUsageCost: false,
		})

		render(<IndusCodeModelPicker currentMode="act" />)

		expect(screen.getByText("Reasoning Effort")).toBeInTheDocument()
	})
})
