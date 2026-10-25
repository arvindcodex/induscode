import { describe, expect, it } from "vitest";
import {
	formatCliErrorMessage,
	getCliIndusCodeFreeModelLimitMessage,
	getCliIndusCodePassLimitMessage,
	getCliNotSubscribedMessage,
	getIndusCodeOrgIndividualInferenceSubscriptionMessage,
	getIndusCodePassLimitDetailMessage,
	isIndusCodeFreeModelLimitErrorMessage,
	isIndusCodeFreePromotionEndedErrorMessage,
	isIndusCodeOrgIndividualInferenceSubscriptionErrorMessage,
	isIndusCodePassLimitErrorMessage,
	isIndusCodePassSubscriptionError,
} from "./induscode-pass-errors";

describe("induscode-pass-errors", () => {
	it("recognizes both raw and formatted IndusCodePass subscription messages", () => {
		expect(
			isIndusCodePassSubscriptionError(
				"the user is not subscribed to required model plan",
			),
		).toBe(true);

		const sdkFormatted =
			"No access to IndusCodePass subscription models yet. Subscribe to IndusCodePass, the low cost open weights model coding plan: https://app.induscode.bot/dashboard/subscription?personal=true";
		const formatted = getCliNotSubscribedMessage();
		expect(isIndusCodePassSubscriptionError(sdkFormatted)).toBe(true);
		expect(isIndusCodePassSubscriptionError(formatted)).toBe(true);
		expect(formatCliErrorMessage(new Error(sdkFormatted))).toBe(formatted);
		expect(formatCliErrorMessage(new Error(formatted))).toBe(formatted);
	});

	it("recognizes and formats organization account individual subscription errors", () => {
		const raw =
			"403 Error 403: organization accounts cannot use individual model inference subscriptions";
		const formatted = getIndusCodeOrgIndividualInferenceSubscriptionMessage();

		expect(isIndusCodeOrgIndividualInferenceSubscriptionErrorMessage(raw)).toBe(
			true,
		);
		expect(
			isIndusCodeOrgIndividualInferenceSubscriptionErrorMessage(
				new Error(formatted),
			),
		).toBe(true);
		expect(formatCliErrorMessage(new Error(raw))).toBe(formatted);
		expect(formatCliErrorMessage(new Error(raw))).not.toContain(
			"deepseek-v4-flash",
		);
	});

	it("recognizes and formats IndusCodePass period limit errors with usage-billing guidance", () => {
		const raw =
			"Error: You have reached your 5-hour IndusCodepass limit. The limit resets in 5h, please try again later.";
		const detail =
			"You have reached your 5-hour IndusCodepass limit. The limit resets in 5h, please try again later.";

		expect(isIndusCodePassLimitErrorMessage(raw)).toBe(true);
		expect(isIndusCodePassLimitErrorMessage(new Error(raw))).toBe(true);
		expect(getIndusCodePassLimitDetailMessage(raw)).toBe(detail);
		expect(formatCliErrorMessage(new Error(raw))).toBe(
			getCliIndusCodePassLimitMessage(raw),
		);
		expect(formatCliErrorMessage(new Error(raw))).toContain(
			"Switch to IndusCode usage-based billing",
		);
		expect(formatCliErrorMessage(new Error(raw))).toContain("--provider induscode");
	});

	it("recognizes and formats daily free model limits without usage-billing guidance", () => {
		const raw =
			"Error: Error 429: Daily free limit reached on model deepseek/deepseek-v4-flash. Try again in 23h 59m";

		expect(isIndusCodeFreeModelLimitErrorMessage(raw)).toBe(true);
		expect(isIndusCodeFreeModelLimitErrorMessage(new Error(raw))).toBe(true);
		expect(formatCliErrorMessage(new Error(raw))).toBe(
			getCliIndusCodeFreeModelLimitMessage(raw),
		);
		expect(formatCliErrorMessage(new Error(raw))).not.toContain("Error 429");
		expect(formatCliErrorMessage(new Error(raw))).toContain(
			"Try again in 23h 59m",
		);
		expect(formatCliErrorMessage(new Error(raw))).toContain(
			"select another model",
		);
		expect(formatCliErrorMessage(new Error(raw))).not.toContain(
			"usage-based billing",
		);
		expect(
			isIndusCodeFreeModelLimitErrorMessage(getCliIndusCodeFreeModelLimitMessage(raw)),
		).toBe(true);
	});

	it("formats model-not-found errors for removed free models", () => {
		const raw = new Error("Error 404: model not found");

		expect(
			formatCliErrorMessage(raw, { modelId: "induscode-free/retired-model" }),
		).toContain("Free model promotion ended");
		expect(
			isIndusCodeFreePromotionEndedErrorMessage(
				formatCliErrorMessage(raw, { modelId: "induscode-free/retired-model" }),
			),
		).toBe(true);
		expect(
			formatCliErrorMessage(raw, { modelId: "vendor/retired-model" }),
		).toBe(raw.message);
	});
});
