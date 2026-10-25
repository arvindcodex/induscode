import {
	type IndusCodeSubscriptionPlan,
	extractIndusCodeFreeModelLimitResetTime,
	extractIndusCodePassLimitMessage,
	getIndusCodeOrgIndividualInferenceSubscriptionMessage,
	isIndusCodeFreeModelLimitError,
	isIndusCodeFreeModelLimitMessage,
	isIndusCodeModelNotFoundMessage,
	isIndusCodeNotSubscribedError,
	isIndusCodeNotSubscribedMessage,
	isIndusCodeOrgIndividualInferenceSubscriptionError,
	isIndusCodeOrgIndividualInferenceSubscriptionMessage,
	isIndusCodePassLimitError,
	isIndusCodePassLimitMessage,
} from "@induscode/core";

import { getIndusCodeEnvironmentConfig } from "@induscode/shared";

export { getIndusCodeOrgIndividualInferenceSubscriptionMessage };

export function getCliSubscriptionUrl(): string {
	return new URL(
		`/dashboard/subscription?personal=true`,
		getIndusCodeEnvironmentConfig().appBaseUrl,
	).toString();
}

export function getCliNotSubscribedMessage(): string {
	return `No access to IndusCodePass subscription models yet. Subscribe to IndusCodePass, the low cost open weights model coding plan: ${getCliSubscriptionUrl()}`;
}

export function getCliIndusCodePassLimitMessage(message: string): string {
	const detail = getIndusCodePassLimitDetailMessage(message) ?? message.trim();
	const lines = [
		"IndusCodePass limit reached",
		detail,
		"Switch to IndusCode usage-based billing and retry with the IndusCode provider.",
		"Interactive CLI: open the model selector with /model, choose IndusCode, then retry.",
		"Headless CLI: rerun with --provider induscode.",
	];
	return lines.filter((line) => line.trim().length > 0).join("\n");
}

const INDUSCODE_FREE_MODEL_PREFIX = "induscode-free/";
const INDUSCODE_FREE_PROMOTION_ENDED_HEADER = "Free model promotion ended";
const INDUSCODE_FREE_MODEL_LIMIT_HEADER = "Daily free model limit reached";

export function getCliIndusCodeFreePromotionEndedMessage(): string {
	return [
		INDUSCODE_FREE_PROMOTION_ENDED_HEADER,
		"The free promotion for this model has ended and it is no longer available.",
		"Select another model to continue.",
		"Open the model selector with /model.",
	].join("\n");
}

export function getCliIndusCodeFreeModelLimitMessage(message: string): string {
	const resetTime = extractIndusCodeFreeModelLimitResetTime(message);
	return [
		INDUSCODE_FREE_MODEL_LIMIT_HEADER,
		"You've reached today's free usage limit for this model.",
		resetTime
			? `Try again in ${resetTime} or select another model.`
			: "Try again later or select another model.",
		"Open the model selector with /model.",
	].join("\n");
}

export function getIndividualPlanFeatures(
	plans: IndusCodeSubscriptionPlan[],
): string[] {
	const planWithFeatures = plans.find((plan) => plan.interval === "Monthly");

	return planWithFeatures?.features?.included ?? [];
}

function isFormattedIndusCodePassSubscriptionMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	return (
		normalized.includes("no access to induscodepass subscription models yet") &&
		normalized.includes("subscribe to induscodepass")
	);
}

export function isIndusCodePassSubscriptionError(error: unknown): boolean {
	if (isIndusCodeNotSubscribedError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "IndusCodeNotSubscribedError" ||
			isIndusCodeNotSubscribedMessage(error.message) ||
			isFormattedIndusCodePassSubscriptionMessage(error.message)
		);
	}
	return (
		typeof error === "string" &&
		(isIndusCodeNotSubscribedMessage(error) ||
			isFormattedIndusCodePassSubscriptionMessage(error))
	);
}

export function isIndusCodeOrgIndividualInferenceSubscriptionErrorMessage(
	error: unknown,
): boolean {
	if (isIndusCodeOrgIndividualInferenceSubscriptionError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "IndusCodeOrgIndividualInferenceSubscriptionError" ||
			isIndusCodeOrgIndividualInferenceSubscriptionMessage(error.message) ||
			error.message === getIndusCodeOrgIndividualInferenceSubscriptionMessage()
		);
	}
	return (
		typeof error === "string" &&
		(isIndusCodeOrgIndividualInferenceSubscriptionMessage(error) ||
			error === getIndusCodeOrgIndividualInferenceSubscriptionMessage())
	);
}

export function getIndusCodePassLimitDetailMessage(
	error: unknown,
): string | undefined {
	return extractIndusCodePassLimitMessage(
		error instanceof Error ? error.message : String(error),
	);
}

export function isIndusCodePassLimitErrorMessage(error: unknown): boolean {
	if (isIndusCodePassLimitError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "IndusCodePassLimitError" ||
			isIndusCodePassLimitMessage(error.message)
		);
	}
	return typeof error === "string" && isIndusCodePassLimitMessage(error);
}

// Detects that a deleted free model was requested: the backend answers "model
// not found" once a free promotion ends and the induscode-free/ model is removed.
// The modelId gate keeps regular model-not-found errors on their generic path.
export function isIndusCodeFreePromotionEndedErrorMessage(
	error: unknown,
	modelId?: string,
): boolean {
	const message =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "";
	if (
		message
			.toLowerCase()
			.includes(INDUSCODE_FREE_PROMOTION_ENDED_HEADER.toLowerCase())
	) {
		return true;
	}
	if (!modelId?.startsWith(INDUSCODE_FREE_MODEL_PREFIX)) {
		return false;
	}
	return isIndusCodeModelNotFoundMessage(message);
}

export function isIndusCodeFreeModelLimitErrorMessage(error: unknown): boolean {
	if (isIndusCodeFreeModelLimitError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "IndusCodeFreeModelLimitError" ||
			isIndusCodeFreeModelLimitMessage(error.message)
		);
	}
	return (
		typeof error === "string" &&
		(error
			.toLowerCase()
			.includes(INDUSCODE_FREE_MODEL_LIMIT_HEADER.toLowerCase()) ||
			isIndusCodeFreeModelLimitMessage(error))
	);
}

export function formatCliErrorMessage(
	error: unknown,
	options?: { modelId?: string },
): string {
	if (isIndusCodePassSubscriptionError(error)) {
		return getCliNotSubscribedMessage();
	}
	if (isIndusCodeOrgIndividualInferenceSubscriptionErrorMessage(error)) {
		return getIndusCodeOrgIndividualInferenceSubscriptionMessage();
	}
	if (isIndusCodePassLimitErrorMessage(error)) {
		return getCliIndusCodePassLimitMessage(
			error instanceof Error ? error.message : String(error),
		);
	}
	if (isIndusCodeFreeModelLimitErrorMessage(error)) {
		return getCliIndusCodeFreeModelLimitMessage(
			error instanceof Error ? error.message : String(error),
		);
	}
	if (isIndusCodeFreePromotionEndedErrorMessage(error, options?.modelId)) {
		return getCliIndusCodeFreePromotionEndedMessage();
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
