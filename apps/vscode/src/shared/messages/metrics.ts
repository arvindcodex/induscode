import { Mode } from "../storage/types"

export interface IndusCodeMessageModelInfo {
	modelId: string
	providerId: string
	mode: Mode
}

interface IndusCodeTokensInfo {
	prompt: number // Total input tokens (includes cached + non-cached)
	completion: number // Total output tokens
	cached: number // Subset of prompt_tokens that were cache hits
}

export interface IndusCodeMessageMetricsInfo {
	tokens?: IndusCodeTokensInfo
	cost?: number // Monetary cost for this turn
}
