import type { Anthropic } from "@anthropic-ai/sdk"
import type { IndusCodeMessageMetricsInfo, IndusCodeMessageModelInfo } from "./metrics"

export type IndusCodePromptInputContent = string

export type IndusCodeMessageRole = "user" | "assistant"

export interface IndusCodeReasoningDetailParam {
	type: "reasoning.text" | string
	text: string
	signature: string
	format: "anthropic-claude-v1" | string
	index: number
}

interface IndusCodeSharedMessageParam {
	// The id of the response that the block belongs to
	call_id?: string
}

export const REASONING_DETAILS_PROVIDERS = ["induscode", "openrouter"]

/**
 * An extension of Anthropic.MessageParam that includes IndusCode-specific fields: reasoning_details.
 * This ensures backward compatibility where the messages were stored in Anthropic format with additional
 * fields unknown to Anthropic SDK.
 */
export interface IndusCodeTextContentBlock extends Anthropic.TextBlockParam, IndusCodeSharedMessageParam {
	// reasoning_details only exists for providers listed in REASONING_DETAILS_PROVIDERS
	reasoning_details?: IndusCodeReasoningDetailParam[]
	// Thought Signature associates with Gemini
	signature?: string
}

export interface IndusCodeImageContentBlock extends Anthropic.ImageBlockParam, IndusCodeSharedMessageParam {}

export interface IndusCodeDocumentContentBlock extends Anthropic.DocumentBlockParam, IndusCodeSharedMessageParam {}

export interface IndusCodeUserToolResultContentBlock extends Anthropic.ToolResultBlockParam, IndusCodeSharedMessageParam {}

/**
 * Assistant only content types
 */
export interface IndusCodeAssistantToolUseBlock extends Anthropic.ToolUseBlockParam, IndusCodeSharedMessageParam {
	// reasoning_details only exists for providers listed in REASONING_DETAILS_PROVIDERS
	reasoning_details?: unknown[] | IndusCodeReasoningDetailParam[]
	// Thought Signature associates with Gemini
	signature?: string
}

export interface IndusCodeAssistantThinkingBlock extends Anthropic.ThinkingBlock, IndusCodeSharedMessageParam {
	// The summary items returned by OpenAI response API
	// The reasoning details that will be moved to the text block when finalized
	summary?: unknown[] | IndusCodeReasoningDetailParam[]
}

export interface IndusCodeAssistantRedactedThinkingBlock extends Anthropic.RedactedThinkingBlockParam, IndusCodeSharedMessageParam {}

export type IndusCodeToolResponseContent = IndusCodePromptInputContent | Array<IndusCodeTextContentBlock | IndusCodeImageContentBlock>

export type IndusCodeUserContent =
	| IndusCodeTextContentBlock
	| IndusCodeImageContentBlock
	| IndusCodeDocumentContentBlock
	| IndusCodeUserToolResultContentBlock

export type IndusCodeAssistantContent =
	| IndusCodeTextContentBlock
	| IndusCodeImageContentBlock
	| IndusCodeDocumentContentBlock
	| IndusCodeAssistantToolUseBlock
	| IndusCodeAssistantThinkingBlock
	| IndusCodeAssistantRedactedThinkingBlock

export type IndusCodeContent = IndusCodeUserContent | IndusCodeAssistantContent

/**
 * An extension of Anthropic.MessageParam that includes IndusCode-specific fields.
 * This ensures backward compatibility where the messages were stored in Anthropic format,
 * while allowing for additional metadata specific to IndusCode to avoid unknown fields in Anthropic SDK
 * added by ignoring the type checking for those fields.
 */
export interface IndusCodeStorageMessage extends Anthropic.MessageParam {
	/**
	 * Response ID associated with this message
	 */
	id?: string
	role: IndusCodeMessageRole
	content: IndusCodePromptInputContent | IndusCodeContent[]
	/**
	 * NOTE: model information used when generating this message.
	 * Internal use for message conversion only.
	 * MUST be removed before sending message to any LLM provider.
	 */
	modelInfo?: IndusCodeMessageModelInfo
	/**
	 * LLM operational and performance metrics for this message
	 * Includes token counts, costs.
	 */
	metrics?: IndusCodeMessageMetricsInfo
	/**
	 * Timestamp of when the message was created
	 */
	ts?: number
}

/**
 * Converts IndusCodeStorageMessage to Anthropic.MessageParam by removing IndusCode-specific fields
 * IndusCode-specific fields (like modelInfo, reasoning_details) are properly omitted.
 */
export function convertIndusCodeStorageToAnthropicMessage(
	induscodeMessage: IndusCodeStorageMessage,
	provider = "anthropic",
): Anthropic.MessageParam {
	const { role, content } = induscodeMessage

	// Handle string content - fast path
	if (typeof content === "string") {
		return { role, content }
	}

	// Removes thinking block that has no signature (invalid thinking block that's incompatible with Anthropic API)
	const filteredContent = content.filter((b) => b.type !== "thinking" || !!b.signature)

	// Handle array content - strip IndusCode-specific fields for non-reasoning_details providers
	const shouldCleanContent = !REASONING_DETAILS_PROVIDERS.includes(provider)
	const cleanedContent = shouldCleanContent
		? filteredContent.map(cleanContentBlock)
		: (filteredContent as Anthropic.MessageParam["content"])

	return { role, content: cleanedContent }
}

/**
 * IndusCode stores images as base64, so an image block's source is always a base64 source.
 * The Anthropic SDK types the source as a Base64ImageSource | URLImageSource union, so this
 * narrows to the base64 variant for the transform layer. URL sources are not produced by IndusCode,
 * so they degrade to empty values rather than throwing.
 */
export function getBase64ImageSource(source: Anthropic.ImageBlockParam["source"]): { mediaType: string; data: string } {
	if (source.type === "base64") {
		return { mediaType: source.media_type, data: source.data }
	}
	return { mediaType: "", data: "" }
}

/**
 * Builds a base64 data URL from an image block's source. See getBase64ImageSource.
 */
export function getImageDataUrl(source: Anthropic.ImageBlockParam["source"]): string {
	const { mediaType, data } = getBase64ImageSource(source)
	return `data:${mediaType};base64,${data}`
}

/**
 * Clean a content block by removing IndusCode-specific fields and returning only Anthropic-compatible fields
 */
export function cleanContentBlock(block: IndusCodeContent): Anthropic.ContentBlock {
	// Fast path: if no IndusCode-specific fields exist, return as-is
	const hasIndusCodeFields =
		"reasoning_details" in block ||
		"call_id" in block ||
		"summary" in block ||
		(block.type !== "thinking" && "signature" in block)

	if (!hasIndusCodeFields) {
		return block as Anthropic.ContentBlock
	}

	// Removes IndusCode-specific fields & the signature field that's added for Gemini.
	const { reasoning_details, call_id, summary, ...rest } = block as any

	// Remove signature from non-thinking blocks that were added for Gemini
	if (block.type !== "thinking" && rest.signature) {
		rest.signature = undefined
	}

	return rest satisfies Anthropic.ContentBlock
}
