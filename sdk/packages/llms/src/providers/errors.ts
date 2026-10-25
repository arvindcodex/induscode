import { getIndusCodeEnvironmentConfig } from "@induscode/shared";

export const INDUSCODE_NOT_SUBSCRIBED_RESPONSE_MESSAGE =
	"the user is not subscribed to required model plan";
const INDUSCODE_NOT_SUBSCRIBED_FORMATTED_MESSAGE_PREFIX =
	"no access to induscodepass subscription models yet. subscribe to induscodepass";
export const INDUSCODE_ORG_INDIVIDUAL_INFERENCE_SUBSCRIPTION_RESPONSE_MESSAGE =
	"organization accounts cannot use individual model inference subscriptions";

const INDUSCODE_PASS_LIMIT_PREFIX = "you have reached your";
const INDUSCODE_PASS_LIMIT_MARKER = "induscodepass limit";
const INDUSCODE_PASS_LIMIT_SUFFIX = "please try again later.";
const INDUSCODE_FREE_MODEL_LIMIT_MARKER = "free limit reached on model";
const INDUSCODE_FREE_MODEL_LIMIT_RETRY_MARKER = "try again in ";
const INDUSCODE_MODEL_NOT_FOUND_MARKER = "model not found";

function findIndusCodePassLimitMessageBounds(
	text: string,
): { start: number; end: number } | undefined {
	const normalized = text.toLowerCase();
	const start = normalized.indexOf(INDUSCODE_PASS_LIMIT_PREFIX);
	if (start === -1) {
		return undefined;
	}

	const suffixStart = normalized.indexOf(INDUSCODE_PASS_LIMIT_SUFFIX, start);
	if (suffixStart === -1) {
		return undefined;
	}

	const end = suffixStart + INDUSCODE_PASS_LIMIT_SUFFIX.length;
	if (!normalized.slice(start, end).includes(INDUSCODE_PASS_LIMIT_MARKER)) {
		return undefined;
	}

	return { start, end };
}

export function getIndusCodePassSubscriptionUrl(): string {
	return `${new URL(
		"/dashboard/subscription?personal=true",
		getIndusCodeEnvironmentConfig().appBaseUrl,
	).toString()}`;
}

export function getIndusCodeNotSubscribedMessage(): string {
	return `No access to IndusCodePass subscription models yet. Subscribe to IndusCodePass, the low cost open weights model coding plan: ${getIndusCodePassSubscriptionUrl()}`;
}

export class IndusCodeNotSubscribedError extends Error {
	public readonly providerId?: string;

	constructor(providerId?: string) {
		super(getIndusCodeNotSubscribedMessage());
		this.name = "IndusCodeNotSubscribedError";
		this.providerId = providerId;
	}
}

export function getIndusCodeOrgIndividualInferenceSubscriptionMessage(): string {
	return "Organization accounts cannot use IndusCodePass subscriptions. Go to /account -> change account to switch to your personal account for IndusCodePass";
}

export class IndusCodeOrgIndividualInferenceSubscriptionError extends Error {
	public readonly providerId?: string;

	constructor(providerId?: string) {
		super(getIndusCodeOrgIndividualInferenceSubscriptionMessage());
		this.name = "IndusCodeOrgIndividualInferenceSubscriptionError";
		this.providerId = providerId;
	}
}

export class IndusCodePassLimitError extends Error {
	public readonly providerId?: string;

	constructor(message: string, providerId?: string) {
		super(message);
		this.name = "IndusCodePassLimitError";
		this.providerId = providerId;
	}
}

export class IndusCodeFreeModelLimitError extends Error {
	public readonly providerId?: string;

	constructor(message: string, providerId?: string) {
		super(message);
		this.name = "IndusCodeFreeModelLimitError";
		this.providerId = providerId;
	}
}

export function isIndusCodeNotSubscribedError(
	error: unknown,
): error is IndusCodeNotSubscribedError {
	return error instanceof IndusCodeNotSubscribedError;
}

export function isIndusCodeOrgIndividualInferenceSubscriptionError(
	error: unknown,
): error is IndusCodeOrgIndividualInferenceSubscriptionError {
	return error instanceof IndusCodeOrgIndividualInferenceSubscriptionError;
}

export function isIndusCodePassLimitError(
	error: unknown,
): error is IndusCodePassLimitError {
	return error instanceof IndusCodePassLimitError;
}

export function isIndusCodeFreeModelLimitError(
	error: unknown,
): error is IndusCodeFreeModelLimitError {
	return error instanceof IndusCodeFreeModelLimitError;
}

export function isIndusCodeNotSubscribedMessage(text: string): boolean {
	const normalized = text.trim().toLowerCase();
	return (
		normalized.includes(INDUSCODE_NOT_SUBSCRIBED_RESPONSE_MESSAGE) ||
		normalized.includes(INDUSCODE_NOT_SUBSCRIBED_FORMATTED_MESSAGE_PREFIX)
	);
}

export function isIndusCodeOrgIndividualInferenceSubscriptionMessage(
	text: string,
): boolean {
	return text
		.toLowerCase()
		.includes(INDUSCODE_ORG_INDIVIDUAL_INFERENCE_SUBSCRIPTION_RESPONSE_MESSAGE);
}

export function isIndusCodePassLimitMessage(text: string): boolean {
	return findIndusCodePassLimitMessageBounds(text) !== undefined;
}

export function extractIndusCodePassLimitMessage(text: string): string | undefined {
	const bounds = findIndusCodePassLimitMessageBounds(text);
	return bounds ? text.slice(bounds.start, bounds.end) : undefined;
}

export function isIndusCodeFreeModelLimitMessage(text: string): boolean {
	return text.toLowerCase().includes(INDUSCODE_FREE_MODEL_LIMIT_MARKER);
}

export function isIndusCodeModelNotFoundMessage(text: string): boolean {
	return text.toLowerCase().includes(INDUSCODE_MODEL_NOT_FOUND_MARKER);
}

export function extractIndusCodeFreeModelLimitResetTime(
	text: string,
): string | undefined {
	const message = text.toLowerCase();
	const resetStart = message.indexOf(INDUSCODE_FREE_MODEL_LIMIT_RETRY_MARKER);
	if (resetStart === -1) {
		return undefined;
	}

	const resetTime = message
		.slice(resetStart + INDUSCODE_FREE_MODEL_LIMIT_RETRY_MARKER.length)
		.trim();
	return resetTime || undefined;
}
