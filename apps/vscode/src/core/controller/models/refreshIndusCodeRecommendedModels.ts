import { FALLBACK_INDUSCODE_RECOMMENDED_MODELS, fetchIndusCodeRecommendedModels } from "@induscode/core"
import { IndusCodeEnv } from "@/config"
import { fetch } from "@/shared/net"

interface IndusCodeRecommendedModelData {
	id: string
	name: string
	description: string
	tags: string[]
}

export interface IndusCodeRecommendedModelsData {
	recommended: IndusCodeRecommendedModelData[]
	free: IndusCodeRecommendedModelData[]
	induscodePass?: IndusCodeRecommendedModelData[]
}

const RECOMMENDED_MODELS_CACHE_TTL_MS = 60 * 60 * 1000

let pendingRefresh: Promise<IndusCodeRecommendedModelsData> | null = null
let inMemoryCache: { data: IndusCodeRecommendedModelsData; timestamp: number } | null = null

export async function refreshIndusCodeRecommendedModels(): Promise<IndusCodeRecommendedModelsData> {
	if (inMemoryCache && Date.now() - inMemoryCache.timestamp <= RECOMMENDED_MODELS_CACHE_TTL_MS) {
		return inMemoryCache.data
	}

	if (pendingRefresh) {
		return pendingRefresh
	}

	pendingRefresh = (async () => {
		try {
			return await fetchAndCacheIndusCodeRecommendedModels()
		} finally {
			pendingRefresh = null
		}
	})()

	return pendingRefresh
}

/** The last successfully fetched list, without fetching; undefined before the first success. */
export function getCachedIndusCodeRecommendedModels(): IndusCodeRecommendedModelsData | undefined {
	return inMemoryCache?.data
}

export function resetIndusCodeRecommendedModelsCacheForTests(): void {
	pendingRefresh = null
	inMemoryCache = null
}

function isFallbackRecommendedModels(data: IndusCodeRecommendedModelsData): boolean {
	return JSON.stringify(data) === JSON.stringify(FALLBACK_INDUSCODE_RECOMMENDED_MODELS)
}

async function fetchAndCacheIndusCodeRecommendedModels(): Promise<IndusCodeRecommendedModelsData> {
	// Delegate the actual HTTP fetch + response normalization + offline fallback
	// to the SDK so the CLI/JetBrains and the extension share one implementation.
	// We pass the proxy-aware fetch (per .induscoderules/network.md) and the
	// extension's configured API base URL. On failure the SDK returns its own
	// fallback list.
	const result = await fetchIndusCodeRecommendedModels({
		baseUrl: IndusCodeEnv.config().apiBaseUrl,
		fetchImpl: fetch,
	})

	// Only pin a populated, non-fallback result in memory for the full TTL; a
	// transient failure (SDK returns a clone of its fallback) should be retried
	// next call.
	if ((result.recommended.length > 0 || result.free.length > 0) && !isFallbackRecommendedModels(result)) {
		inMemoryCache = { data: result, timestamp: Date.now() }
	}
	return result
}
