import { describe, expect, it } from "vitest";
import { isIndusCodePassLimitMessage } from "../index.browser";
import {
	extractIndusCodeFreeModelLimitResetTime,
	extractIndusCodePassLimitMessage,
	isIndusCodeFreeModelLimitMessage,
} from "./errors";

describe("isIndusCodePassLimitMessage", () => {
	it("matches the IndusCodePass weekly limit message", () => {
		const message =
			"You have reached your weekly IndusCodepass limit. The limit resets in 7d, please try again later.";
		expect(isIndusCodePassLimitMessage(message)).toBe(true);
	});

	it("matches the 5-hour IndusCodePass limit message", () => {
		const message =
			"You have reached your 5-hour IndusCodepass limit. The limit resets in 5h, please try again later.";
		expect(isIndusCodePassLimitMessage(message)).toBe(true);
	});

	it("handles tab-heavy non-matches without regex backtracking", () => {
		expect(
			isIndusCodePassLimitMessage(`You have reached your\t${"\t".repeat(10_000)}`),
		).toBe(false);
		expect(
			isIndusCodePassLimitMessage(`You have reached your\t-${"\t".repeat(10_000)}`),
		).toBe(false);
		expect(
			isIndusCodePassLimitMessage(
				`You have reached your\t-\tIndusCodepass limit.The limit resets in\t${"\t".repeat(10_000)}`,
			),
		).toBe(false);
	});
});

describe("extractIndusCodePassLimitMessage", () => {
	it("extracts the IndusCodePass weekly limit message", () => {
		const message =
			"You have reached your weekly IndusCodepass limit. The limit resets in 7d, please try again later.";

		const extracted = extractIndusCodePassLimitMessage(`Error: ${message}`);
		expect(extracted).toBe(message);
	});

	it("extracts the 5-hour IndusCodePass limit message", () => {
		const message =
			"You have reached your 5-hour IndusCodepass limit. The limit resets in 5h, please try again later.";

		const extracted = extractIndusCodePassLimitMessage(`Error: ${message}`);
		expect(extracted).toBe(message);
	});
});

describe("IndusCode free model limit messages", () => {
	const message =
		"Daily free limit reached on model deepseek/deepseek-v4-flash. Try again in 23h 59m";

	it("detects the message in an HTTP error", () => {
		const error = `Error: Error 429: ${message}`;
		expect(isIndusCodeFreeModelLimitMessage(error)).toBe(true);
		expect(extractIndusCodeFreeModelLimitResetTime(error)).toBe("23h 59m");
	});

	it("does not match unrelated daily limits", () => {
		expect(
			isIndusCodeFreeModelLimitMessage(
				"Your daily spend limit has been reached. Try again in 23h 59m",
			),
		).toBe(false);
	});
});
