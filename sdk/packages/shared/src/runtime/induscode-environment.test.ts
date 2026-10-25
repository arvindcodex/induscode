import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	INDUSCODE_ENVIRONMENT_ENV,
	INDUSCODE_ENVIRONMENT_OVERRIDE_ENV,
	INDUSCODE_ENVIRONMENTS,
	DEFAULT_INDUSCODE_ENVIRONMENT,
	getIndusCodeEnvironmentConfig,
	resolveIndusCodeEnvironment,
} from "./induscode-environment";

const ENV_KEYS = [
	INDUSCODE_ENVIRONMENT_ENV,
	INDUSCODE_ENVIRONMENT_OVERRIDE_ENV,
	"INDUSCODE_API_BASE_URL",
] as const;

const originalEnvValues = Object.fromEntries(
	ENV_KEYS.map((key) => [key, process.env[key]]),
);

beforeEach(() => {
	vi.unstubAllGlobals();
	for (const key of ENV_KEYS) {
		delete process.env[key];
	}
});

afterEach(() => {
	vi.unstubAllGlobals();
	for (const key of ENV_KEYS) {
		const value = originalEnvValues[key];
		if (typeof value === "string") {
			process.env[key] = value;
		} else {
			delete process.env[key];
		}
	}
});

describe("resolveIndusCodeEnvironment", () => {
	it("defaults to production when no env var is set", () => {
		expect(resolveIndusCodeEnvironment()).toBe(DEFAULT_INDUSCODE_ENVIRONMENT);
	});

	it("reads INDUSCODE_ENVIRONMENT from process.env", () => {
		process.env[INDUSCODE_ENVIRONMENT_ENV] = "staging";
		expect(resolveIndusCodeEnvironment()).toBe("staging");

		process.env[INDUSCODE_ENVIRONMENT_ENV] = "local";
		expect(resolveIndusCodeEnvironment()).toBe("local");
	});

	it("prefers INDUSCODE_ENVIRONMENT_OVERRIDE over INDUSCODE_ENVIRONMENT", () => {
		process.env[INDUSCODE_ENVIRONMENT_OVERRIDE_ENV] = "local";
		process.env[INDUSCODE_ENVIRONMENT_ENV] = "staging";

		expect(resolveIndusCodeEnvironment()).toBe("local");
	});

	it("normalizes case and surrounding whitespace", () => {
		process.env[INDUSCODE_ENVIRONMENT_ENV] = "  STAGING  ";

		expect(resolveIndusCodeEnvironment()).toBe("staging");
	});

	it("ignores unknown values and falls through to the next source", () => {
		process.env[INDUSCODE_ENVIRONMENT_OVERRIDE_ENV] = "qa";
		process.env[INDUSCODE_ENVIRONMENT_ENV] = "staging";
		expect(resolveIndusCodeEnvironment()).toBe("staging");

		delete process.env[INDUSCODE_ENVIRONMENT_OVERRIDE_ENV];
		process.env[INDUSCODE_ENVIRONMENT_ENV] = "qa";
		expect(resolveIndusCodeEnvironment()).toBe(DEFAULT_INDUSCODE_ENVIRONMENT);
	});

	it("defaults to production when process is unavailable", () => {
		vi.stubGlobal("process", undefined);

		expect(resolveIndusCodeEnvironment()).toBe(DEFAULT_INDUSCODE_ENVIRONMENT);
	});
});

describe("getIndusCodeEnvironmentConfig", () => {
	it("returns the config for an explicit environment", () => {
		expect(getIndusCodeEnvironmentConfig("staging")).toBe(
			INDUSCODE_ENVIRONMENTS.staging,
		);
		expect(getIndusCodeEnvironmentConfig("local")).toBe(INDUSCODE_ENVIRONMENTS.local);
		expect(getIndusCodeEnvironmentConfig("production")).toBe(
			INDUSCODE_ENVIRONMENTS.production,
		);
	});

	it("falls back to production by default", () => {
		expect(getIndusCodeEnvironmentConfig()).toBe(INDUSCODE_ENVIRONMENTS.production);
	});

	it("uses the resolved process.env environment when no explicit environment is provided", () => {
		process.env[INDUSCODE_ENVIRONMENT_ENV] = "staging";

		expect(getIndusCodeEnvironmentConfig()).toBe(INDUSCODE_ENVIRONMENTS.staging);
	});

	it("applies INDUSCODE_API_BASE_URL without mutating the catalog config", () => {
		process.env.INDUSCODE_API_BASE_URL = "http://127.0.0.1:3000";

		expect(getIndusCodeEnvironmentConfig("local")).toEqual({
			...INDUSCODE_ENVIRONMENTS.local,
			apiBaseUrl: "http://127.0.0.1:3000",
			mcpBaseUrl: "http://127.0.0.1:3000/v1/mcp",
		});
		expect(INDUSCODE_ENVIRONMENTS.local.apiBaseUrl).toBe("http://localhost:7777");
	});

	it("defaults to production when process is unavailable", () => {
		vi.stubGlobal("process", undefined);

		expect(getIndusCodeEnvironmentConfig()).toBe(INDUSCODE_ENVIRONMENTS.production);
	});
});

describe("INDUSCODE_ENVIRONMENTS catalog", () => {
	it("exposes an environment field that matches its key", () => {
		for (const [key, config] of Object.entries(INDUSCODE_ENVIRONMENTS)) {
			expect(config.environment).toBe(key);
		}
	});

	it("populates appBaseUrl, apiBaseUrl, and mcpBaseUrl for every environment", () => {
		for (const config of Object.values(INDUSCODE_ENVIRONMENTS)) {
			expect(config.appBaseUrl).toMatch(/^https?:\/\//);
			expect(config.apiBaseUrl).toMatch(/^https?:\/\//);
			expect(config.mcpBaseUrl).toMatch(/^https?:\/\//);
		}
	});
});
