import { getIndusCodeEnvironmentConfig } from "@induscode/shared";
import { buildIndusCodeClientHeaders } from "../providers/induscode-client-headers";
import type { ModelInfo } from "./types";

export interface IndusCodeRecommendedModelEntry {
	id: string;
	name?: string;
	description?: string;
	tags?: string[];
}

export interface IndusCodeRecommendedModelsPayload {
	recommended?: IndusCodeRecommendedModelEntry[];
	induscodePass?: IndusCodeRecommendedModelEntry[];
	free?: IndusCodeRecommendedModelEntry[];
	induscodeCloud?: IndusCodeRecommendedModelEntry[];
}

type ModelCapabilities = Pick<
	ModelInfo,
	| "contextWindow"
	| "maxInputTokens"
	| "maxTokens"
	| "capabilities"
	| "reasoningOptions"
	| "pricing"
>;

const INDUSCODE_PASS_PROVIDER_ID = "induscode-pass";
const INDUSCODE_PROVIDER_ID = "induscode";

const INDUSCODE_PASS_MODEL_DEFAULTS = {
	contextWindow: 128_000,
	maxInputTokens: 128_000,
	maxTokens: 8_192,
	capabilities: ["tools", "reasoning", "temperature"],
	pricing: {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
	},
} as const satisfies ModelCapabilities;

function findORModelCapabilities(
	entry: IndusCodeRecommendedModelEntry,
	openRouterModels: Record<string, ModelInfo>,
): ModelCapabilities {
	if (!openRouterModels) {
		return INDUSCODE_PASS_MODEL_DEFAULTS;
	}

	const modelSlug = entry.id.split("/").at(-1) ?? entry.id;

	return openRouterModels[modelSlug] || INDUSCODE_PASS_MODEL_DEFAULTS;
}

// IndusCode-Pass models have only the model name (and not the lab),
// so we need to look-up using glm-5.2 instead of induscode-pass/glm-5.2
function buildModelsNameMap(
	openrouterModels: Record<string, ModelInfo>,
): Record<string, ModelInfo> {
	const nameMap: Record<string, ModelInfo> = {};

	for (const model of Object.values(openrouterModels)) {
		const modelSlugWithoutProvider = model.id.split("/").at(-1) ?? model.id;

		nameMap[modelSlugWithoutProvider] = model;
	}

	return nameMap;
}

export function normalizeIndusCodeRecommendedProviderModels(
	payload: IndusCodeRecommendedModelsPayload,
	openRouterModels: Record<string, ModelInfo>,
	options: { includeIndusCodeCloudModels?: boolean } = {},
): Record<string, Record<string, ModelInfo>> {
	const induscodePass = payload.induscodePass ?? [];
	const models: Record<string, ModelInfo> = {};
	const induscodeModels: Record<string, ModelInfo> = {};
	const openRouterModelsByName = buildModelsNameMap(openRouterModels);

	induscodePass.forEach((entry) => {
		const capabilities = findORModelCapabilities(entry, openRouterModelsByName);

		models[entry.id] = {
			// We should use the OR name, unless there is not one (like when using defaults)
			name: entry.name,
			...capabilities,
			pricing: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			id: entry.id,
			description: entry.description,
		};
	});

	const addIndusCodeModel = (
		entry: IndusCodeRecommendedModelEntry,
		includeInIndusCodePass: boolean,
	) => {
		const capabilities =
			openRouterModels?.[entry.id] ??
			findORModelCapabilities(entry, openRouterModelsByName);
		// The recommended-models endpoint only sends slug-like names (e.g.
		// "deepseek-v4-flash"), so prefer the OpenRouter catalog's display name
		// for every free entry. Without this, the free overlay overwrites the
		// nice OpenRouter names in the merged induscode/induscode-pass catalogs and the
		// pickers end up rendering raw model ids for the Free section.
		const entryName =
			capabilities.name?.trim() || entry.name?.trim() || entry.id;
		// The feed bucket determines free access, regardless of the ID namespace.
		// Keep this visible even when a client has no featured-tier metadata.
		const name =
			!includeInIndusCodePass || /\(free\)$/i.test(entryName)
				? entryName
				: `${entryName} (free)`;

		const modelInfo = {
			...capabilities,
			name,
			id: entry.id,
			description: entry.description,
		};

		induscodeModels[entry.id] = {
			...modelInfo,
			pricing: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		};

		if (!includeInIndusCodePass || models[entry.id]) {
			return;
		}

		models[entry.id] = {
			...modelInfo,
			pricing: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		};
	};

	(payload.free ?? []).forEach((entry) => {
		addIndusCodeModel(entry, true);
	});
	if (options.includeIndusCodeCloudModels) {
		(payload.induscodeCloud ?? []).forEach((entry) => {
			addIndusCodeModel(entry, false);
		});
	}

	const result: Record<string, Record<string, ModelInfo>> = {};
	if (Object.keys(induscodeModels).length > 0) {
		result[INDUSCODE_PROVIDER_ID] = induscodeModels;
	}
	if (induscodePass.length > 0) {
		result[INDUSCODE_PASS_PROVIDER_ID] = models;
	}
	return result;
}

export async function fetchIndusCodeRecommendedModelsPayload(
	fetcher: typeof fetch = fetch,
): Promise<IndusCodeRecommendedModelsPayload> {
	const url = `${getIndusCodeEnvironmentConfig().apiBaseUrl}/api/v1/ai/induscode/recommended-models`;
	const response = await fetcher(url, { headers: buildIndusCodeClientHeaders() });
	if (!response.ok) {
		throw new Error(
			`Failed to load IndusCode recommended models from ${url}: HTTP ${response.status}`,
		);
	}

	return (await response.json()) as IndusCodeRecommendedModelsPayload;
}

export async function fetchIndusCodeRecommendedProviderModels(
	fetcher: typeof fetch = fetch,
	openRouterModels: Record<string, ModelInfo>,
): Promise<Record<string, Record<string, ModelInfo>>> {
	const payload = await fetchIndusCodeRecommendedModelsPayload(fetcher);
	return normalizeIndusCodeRecommendedProviderModels(payload, openRouterModels);
}
