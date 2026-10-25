"use client";

import type { SearchComboboxOption, SearchComboboxSection } from "@induscode/ui";
import type {
	ProviderModel,
	ProviderModelFeaturedTier,
} from "@/lib/provider-schema";
import { isModelCurrentlyExhausted } from "@/lib/model-health";

export type ModelPickerData = {
	options: SearchComboboxOption[];
	sections?: SearchComboboxSection[];
};

// Section copy mirrors the CLI's featured picker so the products read the same.
const FREE_SECTION_DESCRIPTION = "Try with limited usage at no cost";
const INDUSCODE_PASS_FREE_SECTION_DESCRIPTION =
	"Try with limited usage, separate from IndusPass quota";

function displayName(model: ProviderModel): string {
	if (model.id === "free/deepseek-v4.1-flash") {
		return "DeepSeek V4.1 Plus";
	}
	let raw = model.name?.trim() || model.id;
	raw = raw
		.replace(/\s*\((?:free|FREE|Free Tier|free tier)\)/gi, "")
		.replace(/\s*\((?:Groq|GROQ|Groq LPU|Groq Fast|Groq 32k)\)/gi, "")
		.replace(/\s*\((?:Apinex|Apinex Fast|Apinex High Context|Apinex Deep Reasoning)\)/gi, "")
		.replace(/\s*\((?:Cloudflare)\)/gi, "")
		.replace(/\s*\((?:NVIDIA NIM|NVIDIA)\)/gi, "")
		.replace(/\s*\((?:OpenRouter Free|OpenRouter)\)/gi, "")
		.replace(/\s*\((?:Intelligence|Fast Agent)\)/gi, "")
		.replace(/^free\//i, "")
		.trim();
	return raw;
}

function cleanDescription(desc?: string): string | undefined {
	if (!desc) return undefined;
	return desc
		.replace(/on Groq LPU|powered by Groq LPU|on Groq|via Groq|Groq/gi, "on high-throughput LPU acceleration")
		.replace(/on OpenRouter free tier|on OpenRouter|via OpenRouter|OpenRouter/gi, "")
		.replace(/on Cloudflare Workers AI|on Cloudflare edge|on Cloudflare|Cloudflare/gi, "on distributed edge")
		.replace(/on NVIDIA NIM|via NVIDIA NIM|NVIDIA NIM|NVIDIA/gi, "on dedicated neural compute")
		.replace(/Apinex/gi, "IndusCode")
		.replace(/free tier access with|free tier|at zero cost|free/gi, "optimized for")
		.replace(/\s+/g, " ")
		.trim() || undefined;
}

function byLabel(a: SearchComboboxOption, b: SearchComboboxOption): number {
	return a.label.localeCompare(b.label);
}

function flatOptions(models: ProviderModel[]): SearchComboboxOption[] {
	const labelCounts = new Map<string, number>();
	for (const model of models) {
		const label = displayName(model);
		labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
	}
	return models
		.map((model) => {
			const label = displayName(model);
			return {
				label:
					(labelCounts.get(label) ?? 0) > 1 ? `${label} (${model.id})` : label,
				value: model.id,
			};
		})
		.sort(byLabel);
}

export function cleanBadge(tag?: string, modelId?: string): string {
	if (!tag) return "PRO";
	const upper = tag.toUpperCase().trim();
	if (
		upper.includes("GROQ") ||
		upper.includes("GEMINI") ||
		upper.includes("CLOUDFLARE") ||
		upper.includes("COHERE") ||
		upper.includes("NVIDIA") ||
		upper.includes("OPENROUTER") ||
		upper.includes("FREE") ||
		upper.includes("TIER") ||
		upper.includes("APINEX")
	) {
		if (modelId) {
			const id = modelId.toLowerCase();
			if (id.includes("flash") || id.includes("instant") || id.includes("oss")) return "FAST";
			if (id.includes("pro") || id.includes("r1") || id.includes("reasoning")) return "REASONING";
			if (id.includes("coder") || id.includes("codestral") || id.includes("llama")) return "CODE";
			if (id.includes("command")) return "AGENT";
		}
		return "PRO";
	}
	return upper;
}

function tierOptions(
	models: ProviderModel[],
	tier: ProviderModelFeaturedTier,
	section: string,
	badge?: (model: ProviderModel) => string | undefined,
): SearchComboboxOption[] {
	return models
		.filter((model) => model.featured?.tier === tier)
		.sort((a, b) => (a.featured?.rank ?? 0) - (b.featured?.rank ?? 0))
		.map((model) => {
			const rawBadge = badge?.(model);
			const sanitizedBadge = rawBadge ? cleanBadge(rawBadge, model.id) : undefined;
			return {
				badge: sanitizedBadge,
				description: cleanDescription(model.description),
				label: displayName(model),
				section,
				value: model.id,
			};
		});
}

/**
 * Builds the sectioned model picker for a provider from the tier data the SDK
 * stamps onto `ProviderModel.featured` (see @induscode/core's
 * applyIndusCodeFeaturedModels). The `induscode` provider gets Recommended / Free /
 * All models; `induscode-pass` gets Subscribed / Free only — its offer is exactly
 * those tiers, and stale catalog leftovers must not be advertised (the full
 * catalog returns in the same two groups when the subscribed tier is empty, so a subscriber is
 * never limited to free models offline). Every other provider renders its
 * catalog as a flat list ordered by display name.
 */
export function buildModelPickerData(
	providerId: string,
	models: ProviderModel[],
): ModelPickerData {
	// Render all models in the picker; failover occurs transparently in background
	const modelsToRender = models;

	if (
		providerId === "induscode" ||
		providerId === "induscode" ||
		providerId === "openai-native"
	) {
		const recommended = tierOptions(
			modelsToRender,
			"recommended",
			"recommended",
			(model) => cleanBadge(model.featured?.tags[0] ?? "FRONTIER", model.id),
		);

		const freeModels = modelsToRender.filter((m) => m.featured?.tier === "free");

		if (recommended.length === 0 && freeModels.length === 0) {
			return { options: flatOptions(modelsToRender) };
		}

		// Helper to group options into capability-driven sections
		const fastOptions: SearchComboboxOption[] = [];
		const reasoningOptions: SearchComboboxOption[] = [];
		const codingOptions: SearchComboboxOption[] = [];
		const agenticOptions: SearchComboboxOption[] = [];
		const edgeOptions: SearchComboboxOption[] = [];
		const generalOptions: SearchComboboxOption[] = [];

		for (const model of freeModels) {
			const tags = model.featured?.tags ?? [];
			const id = model.id.toLowerCase();
			const desc = cleanDescription(model.description);
			const name = displayName(model);

			if (
				tags.includes("GROQ") ||
				tags.includes("FAST") ||
				id.includes("groq") ||
				id.startsWith("openai/gpt-oss") ||
				id.startsWith("qwen/qwen3.8") ||
				id.startsWith("llama-3.3-70b-versatile") ||
				id.startsWith("llama-3.1-8b-instant") ||
				id.startsWith("mixtral-") ||
				id.startsWith("gemma2-")
			) {
				fastOptions.push({
					badge: "FAST",
					description: desc,
					label: name,
					section: "fast",
					value: model.id,
				});
			} else if (
				tags.includes("GEMINI") ||
				tags.includes("REASONING") ||
				id.includes("gemini") ||
				id.includes("muse-spark") ||
				id.includes("gpt-6") ||
				id.includes("deepseek-r1") ||
				id.includes("nemotron-3-nano")
			) {
				reasoningOptions.push({
					badge: "REASONING",
					description: desc,
					label: name,
					section: "reasoning",
					value: model.id,
				});
			} else if (
				tags.includes("NVIDIA") ||
				tags.includes("CODE") ||
				id.startsWith("deepseek-ai/") ||
				id.startsWith("mistralai/codestral") ||
				id.startsWith("meta/codellama") ||
				id.startsWith("bigcode/") ||
				id.includes("coder") ||
				id.includes("kat-coder")
			) {
				codingOptions.push({
					badge: "CODE",
					description: desc,
					label: name,
					section: "coding",
					value: model.id,
				});
			} else if (
				tags.includes("COHERE") ||
				tags.includes("AGENT") ||
				id.startsWith("command-") ||
				id.includes("cohere")
			) {
				agenticOptions.push({
					badge: "AGENT",
					description: desc,
					label: name,
					section: "agentic",
					value: model.id,
				});
			} else if (
				tags.includes("CLOUDFLARE") ||
				tags.includes("LIGHT") ||
				id.startsWith("@cf/") ||
				id.includes("solar-mini")
			) {
				edgeOptions.push({
					badge: "LIGHT",
					description: desc,
					label: name,
					section: "edge",
					value: model.id,
				});
			} else {
				generalOptions.push({
					badge: "PRO",
					description: desc,
					label: name,
					section: "general",
					value: model.id,
				});
			}
		}

		const categorizedIds = new Set([
			...recommended.map((o) => o.value),
			...fastOptions.map((o) => o.value),
			...reasoningOptions.map((o) => o.value),
			...codingOptions.map((o) => o.value),
			...agenticOptions.map((o) => o.value),
			...edgeOptions.map((o) => o.value),
			...generalOptions.map((o) => o.value),
		]);

		const rest = flatOptions(
			modelsToRender.filter((model) => !categorizedIds.has(model.id)),
		).map((option) => ({ ...option, section: "all" }));

		const options = [
			...recommended,
			...fastOptions,
			...reasoningOptions,
			...codingOptions,
			...agenticOptions,
			...edgeOptions,
			...generalOptions,
			...rest,
		];

		const sections: SearchComboboxSection[] = [
			{ id: "recommended", label: "Recommended (Frontier)" },
			{
				id: "fast",
				label: "Ultra-Fast Inference Models",
				description: "Sub-second token generation for rapid coding & iteration",
			},
			{
				id: "reasoning",
				label: "Deep Reasoning & Long Context",
				description: "Large context window with deep multi-step thinking",
			},
			{
				id: "coding",
				label: "Frontier Coding & Architecture",
				description: "Frontier code synthesis, refactoring, and debugging",
			},
			{
				id: "agentic",
				label: "Autonomous Agent & Tool Execution",
				description: "Enterprise agentic models for complex tool execution",
			},
			{
				id: "edge",
				label: "Lightweight & Efficient Models",
				description: "Lightweight and efficient distributed models",
			},
			{
				id: "general",
				label: "General Intelligence Models",
				description: "High-accuracy general intelligence models",
			},
			{ id: "all", label: "All Models" },
		].filter((sec) => options.some((opt) => opt.section === sec.id));

		return { options, sections };
	}

	if (providerId === "induscode-pass") {
		const subscribed = tierOptions(models, "subscribed", "subscribed");
		const free = tierOptions(models, "free", "free");
		if (subscribed.length === 0) {
			// IndusCodePass catalogs contain subscription routes under induscode-pass/
			// plus the free feed overlay (induscode-free/ or upstream IDs). Keep those
			// groups separate offline too; live featured tiers remain authoritative.
			const fallback = models.filter((model) => !model.featured);
			subscribed.push(
				...flatOptions(
					fallback.filter((model) => model.id.startsWith("induscode-pass/")),
				).map((option) => ({ ...option, section: "subscribed" })),
			);
			free.push(
				...flatOptions(
					fallback.filter((model) => !model.id.startsWith("induscode-pass/")),
				).map((option) => ({ ...option, section: "free" })),
			);
		}
		return {
			options: [...subscribed, ...free],
			sections: [
				{ id: "subscribed", label: "Subscribed" },
				{
					description: "High-performance inference models",
					id: "free",
					label: "Standard",
				},
			],
		};
	}

	return { options: flatOptions(modelsToRender) };
}
