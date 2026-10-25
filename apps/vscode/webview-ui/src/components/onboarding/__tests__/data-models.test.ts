import type { OnboardingModel, OnboardingModelGroup } from "@shared/proto/induscode/state"
import { describe, expect, it } from "vitest"
import {
	INDUSCODEPASS_GROUP,
	getIndusCodeUIOnboardingGroups,
	getOnboardingGroupDisplayName,
	getRecommendedModelsData,
} from "../data-models"

function model(id: string, group: string): OnboardingModel {
	return {
		id,
		name: id,
		group,
		badge: "",
		score: 0,
		latency: 0,
		info: undefined,
	} as OnboardingModel
}

function groupOf(models: OnboardingModel[]): OnboardingModelGroup {
	return { models } as OnboardingModelGroup
}

describe("getIndusCodeUIOnboardingGroups", () => {
	it("buckets IndusCodePass models into the induscodePass group", () => {
		const result = getIndusCodeUIOnboardingGroups(
			groupOf([
				model("induscode-pass/glm-5.2", INDUSCODEPASS_GROUP),
				model("free-model", "free"),
				model("anthropic/claude", "frontier"),
				model("z-ai/glm", "open source"),
			]),
		)

		expect(result.induscodePass).toHaveLength(1)
		expect(result.induscodePass[0].group).toBe(INDUSCODEPASS_GROUP)
		expect(result.induscodePass[0].models.map((m) => m.id)).toEqual(["induscode-pass/glm-5.2"])
		expect(result.free[0].models.map((m) => m.id)).toEqual(["free-model"])
		expect(result.power.flatMap((g) => g.models.map((m) => m.id))).toEqual(["anthropic/claude", "z-ai/glm"])
	})

	it("does not bucket induscode-pass ids without a IndusCodePass group label", () => {
		const result = getIndusCodeUIOnboardingGroups(groupOf([model("induscode-pass/glm-5.2", "frontier")]))

		expect(result.induscodePass).toEqual([])
	})

	it("returns an empty induscodePass group when no IndusCodePass models are present", () => {
		const result = getIndusCodeUIOnboardingGroups(groupOf([model("free-model", "free")]))
		expect(result.induscodePass).toEqual([])
	})
})

describe("getRecommendedModelsData", () => {
	it("includes IndusCodePass-only responses without depending on feature-flag timing", () => {
		const result = getRecommendedModelsData({
			recommended: [],
			free: [],
			induscodePass: [{ id: "induscode-pass/glm-5.2", name: "GLM 5.1", description: "", tags: [] }],
		})

		expect(result?.induscodePass.map((model) => model.id)).toEqual(["induscode-pass/glm-5.2"])
	})

	it("keeps classic recommended/free responses and IndusCodePass responses", () => {
		const result = getRecommendedModelsData({
			recommended: [{ id: "anthropic/claude", name: "Claude", description: "", tags: [] }],
			free: [{ id: "free-model", name: "Free", description: "", tags: [] }],
			induscodePass: [{ id: "induscode-pass/glm-5.2", name: "GLM 5.1", description: "", tags: [] }],
		})

		expect(result?.recommended.map((model) => model.id)).toEqual(["anthropic/claude"])
		expect(result?.free.map((model) => model.id)).toEqual(["free-model"])
		expect(result?.induscodePass.map((model) => model.id)).toEqual(["induscode-pass/glm-5.2"])
	})

	it("returns undefined when every recommended bucket is empty", () => {
		const result = getRecommendedModelsData({ recommended: [], free: [], induscodePass: [] })

		expect(result).toBeUndefined()
	})
})

describe("onboarding display labels", () => {
	it("renders the canonical IndusCodePass group as a user-facing product name", () => {
		expect(getOnboardingGroupDisplayName(INDUSCODEPASS_GROUP)).toBe("IndusCodePass")
		expect(getOnboardingGroupDisplayName("frontier")).toBe("frontier")
	})
})
