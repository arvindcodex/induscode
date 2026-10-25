import * as sdkCore from "@induscode/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { IndusCodeEnv } from "@/config"
import {
	refreshIndusCodeRecommendedModels,
	resetIndusCodeRecommendedModelsCacheForTests,
} from "../refreshIndusCodeRecommendedModels"

// The HTTP fetch + normalization + offline fallback lives in the SDK
// (`@induscode/core` `fetchIndusCodeRecommendedModels`). These tests cover the
// extension-side wrapper: delegation to the SDK and in-memory caching. There is
// intentionally no feature-flag gate here; onboarding must not race against the
// remote-config cache and accidentally keep the hardcoded fallback list.

describe("refreshIndusCodeRecommendedModels", () => {
	beforeEach(() => {
		resetIndusCodeRecommendedModelsCacheForTests()
		// IndusCodeEnv is not initialized in the unit-test environment; the wrapper
		// passes its apiBaseUrl to the SDK, so provide a stable stub.
		vi.spyOn(IndusCodeEnv, "config").mockReturnValue({ apiBaseUrl: "https://api.induscode-test.bot" } as ReturnType<
			typeof IndusCodeEnv.config
		>)
	})

	afterEach(() => {
		resetIndusCodeRecommendedModelsCacheForTests()
		vi.restoreAllMocks()
	})

	it("delegates to the SDK fetch", async () => {
		const sdkResult = {
			recommended: [{ id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6", description: "Remote", tags: ["NEW"] }],
			free: [{ id: "induscode-free/glm-5", name: "GLM 5", description: "Remote free", tags: [] }],
			induscodePass: [],
		}
		const sdkSpy = vi.spyOn(sdkCore, "fetchIndusCodeRecommendedModels").mockResolvedValue(sdkResult)

		const result = await refreshIndusCodeRecommendedModels()

		expect(sdkSpy).toHaveBeenCalledTimes(1)
		expect(result).toEqual(sdkResult)
	})

	it("uses the in-memory cache after a populated upstream result", async () => {
		const sdkResult = {
			recommended: [{ id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", description: "Remote", tags: ["NEW"] }],
			free: [],
			induscodePass: [],
		}
		const sdkSpy = vi.spyOn(sdkCore, "fetchIndusCodeRecommendedModels").mockResolvedValue(sdkResult)

		const firstResult = await refreshIndusCodeRecommendedModels()
		const secondResult = await refreshIndusCodeRecommendedModels()

		expect(sdkSpy).toHaveBeenCalledTimes(1)
		expect(secondResult).toEqual(firstResult)
	})

	it("does not cache the SDK fallback result", async () => {
		const sdkFallbackClone = structuredClone(sdkCore.FALLBACK_INDUSCODE_RECOMMENDED_MODELS)
		const sdkSpy = vi
			.spyOn(sdkCore, "fetchIndusCodeRecommendedModels")
			.mockResolvedValueOnce(sdkFallbackClone)
			.mockResolvedValueOnce({
				recommended: [
					{ id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6", description: "Remote", tags: ["NEW"] },
				],
				free: [],
				induscodePass: [],
			})

		const firstResult = await refreshIndusCodeRecommendedModels()
		const secondResult = await refreshIndusCodeRecommendedModels()

		expect(sdkSpy).toHaveBeenCalledTimes(2)
		expect(firstResult).toEqual(sdkCore.FALLBACK_INDUSCODE_RECOMMENDED_MODELS)
		expect(secondResult).not.toEqual(sdkCore.FALLBACK_INDUSCODE_RECOMMENDED_MODELS)
	})
})
