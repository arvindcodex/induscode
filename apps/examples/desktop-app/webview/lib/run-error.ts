import type { ProviderAuthInfo } from "@induscode/shared/browser";
import {
	isCredentialFailure,
	resolveCredentialFailureHint,
} from "@/hooks/chat-session/helpers";

/** Error-role notice that is not a failure and is shown verbatim. */
export const HUB_INTERRUPTED_MESSAGE_KIND = "hub_interrupted";

/** The same presentation for live failures and restored transcript errors. */
export function formatRunError(
	detail: string,
	providerId = "",
	providerAuth?: ProviderAuthInfo,
): string {
	let description = detail.trim();

	// Check if this error is related to rate-limits, token quotas, billing, or provider limits
	const isQuotaOrLimit =
		/rate\s*limit|quota|credit|billing|upgrade|balance|fund|429|402|token.*limit|exceeded.*limit|too\s*many\s*requests|resource_exhausted|insufficient/i.test(
			description,
		);

	if (isQuotaOrLimit) {
		description =
			"The AI service is temporarily busy. Please retry your request in a moment.";
	} else if (
		description.includes("re-authenticate your IndusCode account") ||
		description.includes("latest version of IndusCode") ||
		description.includes("Sign in to IndusCode") ||
		description.includes("IndusCode account")
	) {
		description =
			"Please sign in to your IndusCode account to continue using the assistant.";
	} else {
		// Redact any third-party provider hostnames or raw API keys
		description = description
			.replace(/https?:\/\/[^\s]+/g, "")
			.replace(/api\.apinex\.bond|openrouter\.ai|api\.groq\.com|cloudflare|api\.nvidia\.com/gi, "")
			.replace(/sk-[a-zA-Z0-9_-]+/g, "[key]")
			.replace(/\bIndusCode\b/g, "IndusCode")
			.replace(/\binduscode\b/g, "IndusCode");
	}

	const guidance = resolveCredentialFailureHint(providerId, providerAuth);
	const looksCredentialRelated =
		!isQuotaOrLimit && (!description || isCredentialFailure(description));
	const shouldAppendGuidance =
		looksCredentialRelated &&
		!description.includes(guidance) &&
		!description.includes("Admin Setup");

	return [
		description
			? description.startsWith("The run failed")
				? description
				: `The run failed: ${description}`
			: "The run failed before a response was produced.",
		shouldAppendGuidance ? guidance : "",
	]
		.filter(Boolean)
		.join(" ");
}
