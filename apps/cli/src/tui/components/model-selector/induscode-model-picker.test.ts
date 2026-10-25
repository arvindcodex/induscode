import { describe, expect, it } from "vitest";
import {
	buildFeaturedModelEntries,
	INDUSCODE_PASS_FREE_SECTION_DESCRIPTION,
	freeTierDescriptionFor,
} from "./induscode-model-entries";

const model = (id: string) => ({ id, name: id, description: "", tags: [] });

describe("induscode model picker entries", () => {
	it("builds Recommended/Free sections for the induscode provider", () => {
		const entries = buildFeaturedModelEntries("induscode", {
			recommended: [model("anthropic/claude-sonnet-5")],
			free: [model("deepseek/deepseek-v4-flash")],
			induscodePass: [model("induscode-pass/glm-5.1")],
		});

		expect(entries).toEqual([
			{
				kind: "model",
				model: model("anthropic/claude-sonnet-5"),
				tier: "recommended",
			},
			{
				kind: "model",
				model: model("deepseek/deepseek-v4-flash"),
				tier: "free",
			},
			{ kind: "browse" },
		]);
	});

	it("builds Subscribed/Free sections for the induscode-pass provider", () => {
		const entries = buildFeaturedModelEntries("induscode-pass", {
			recommended: [model("anthropic/claude-sonnet-5")],
			free: [model("deepseek/deepseek-v4-flash")],
			induscodePass: [model("induscode-pass/glm-5.1"), model("induscode-pass/kimi-k2.6")],
		});

		expect(entries).toEqual([
			{ kind: "model", model: model("induscode-pass/glm-5.1"), tier: "subscribed" },
			{
				kind: "model",
				model: model("induscode-pass/kimi-k2.6"),
				tier: "subscribed",
			},
			{
				kind: "model",
				model: model("deepseek/deepseek-v4-flash"),
				tier: "free",
			},
		]);
	});

	it("adds the browse-all escape when the induscodePass bucket is empty", () => {
		// The fetch fell back to the bundled list (no pass models); the sections
		// alone would leave a subscriber able to pick only free models.
		const entries = buildFeaturedModelEntries("induscode-pass", {
			recommended: [],
			free: [model("deepseek/deepseek-v4-flash")],
			induscodePass: [],
		});

		expect(entries).toEqual([
			{
				kind: "model",
				model: model("deepseek/deepseek-v4-flash"),
				tier: "free",
			},
			{ kind: "browse" },
		]);
	});

	it("attaches the quota explainer only to the IndusCodePass picker's free section", () => {
		const data = {
			recommended: [model("anthropic/claude-sonnet-5")],
			free: [model("deepseek/deepseek-v4-flash")],
			induscodePass: [model("induscode-pass/glm-5.1")],
		};

		expect(
			freeTierDescriptionFor(buildFeaturedModelEntries("induscode-pass", data)),
		).toBe(INDUSCODE_PASS_FREE_SECTION_DESCRIPTION);
		expect(
			freeTierDescriptionFor(buildFeaturedModelEntries("induscode", data)),
		).toBe(undefined);
	});
});
