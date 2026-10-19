import type { ProviderAuthInfo } from "@cline/shared/browser";
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

	// Sanitize any upstream messages mentioning Cline
	if (
		description.includes("re-authenticate your Cline account") ||
		description.includes("latest version of Cline") ||
		description.includes("Sign in to Cline") ||
		description.includes("Cline account")
	) {
		description =
			"AI Provider is not configured or authenticated. Please set up your AI API Key in Admin Setup (http://localhost:3000/admin) or in Settings → Providers.";
	} else {
		description = description
			.replace(/\bCline\b/g, "IndusCode")
			.replace(/\bcline\b/g, "IndusCode");
	}

	const guidance = resolveCredentialFailureHint(providerId, providerAuth);
	const looksCredentialRelated =
		!description || isCredentialFailure(description);
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
