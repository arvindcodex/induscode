export const INDUSCODE_ENVIRONMENT_ENV = "INDUSCODE_ENVIRONMENT";
export const INDUSCODE_ENVIRONMENT_OVERRIDE_ENV = "INDUSCODE_ENVIRONMENT_OVERRIDE";

export type IndusCodeEnvironment = "production" | "staging" | "local";

export interface IndusCodeEnvironmentConfig {
	readonly environment: IndusCodeEnvironment;
	readonly appBaseUrl: string;
	readonly apiBaseUrl: string;
	readonly mcpBaseUrl: string;
	readonly workOsClientId: string;
}

export const INDUSCODE_ENVIRONMENTS: Readonly<
	Record<IndusCodeEnvironment, IndusCodeEnvironmentConfig>
> = {
	production: {
		environment: "production",
		appBaseUrl: "http://localhost:3000",
		apiBaseUrl: "https://api.induscode.bot",
		mcpBaseUrl: "https://api.induscode.bot/v1/mcp",
		workOsClientId: "client_induscode",
	},
	staging: {
		environment: "staging",
		appBaseUrl: "https://staging-app.induscode.bot",
		apiBaseUrl: "https://core-api.staging.int.induscode.bot",
		mcpBaseUrl: "https://core-api.staging.int.induscode.bot/v1/mcp",
		workOsClientId: "client_01K3A5415VF6QBQBG3XYCW91G6",
	},
	local: {
		environment: "local",
		appBaseUrl: "http://localhost:3000",
		apiBaseUrl: "http://localhost:7777",
		mcpBaseUrl: "http://localhost:7777/v1/mcp",
		workOsClientId: "client_01K6XQAY7JK6T5HXVSZW2S5VYK",
	},
};

export const DEFAULT_INDUSCODE_ENVIRONMENT: IndusCodeEnvironment = "production";

export interface ResolveIndusCodeEnvironmentOptions {
	env?: Partial<NodeJS.ProcessEnv>;
}

function normalizeIndusCodeEnvironment(
	value: string | undefined,
): IndusCodeEnvironment | undefined {
	const normalized = value?.trim().toLowerCase();
	if (
		normalized === "production" ||
		normalized === "staging" ||
		normalized === "local"
	) {
		return normalized;
	}
	return undefined;
}

function readProcessEnv(): NodeJS.ProcessEnv {
	// `process` may be absent in browser-style runtimes (this module ships
	// from the browser entry of `@induscode/shared`). Treat its absence as "no
	// env vars set" so callers always get a deterministic default.
	if (typeof process === "undefined" || !process?.env) {
		return {};
	}
	return process.env;
}

export function resolveIndusCodeEnvironment(): IndusCodeEnvironment {
	const env = readProcessEnv();
	return (
		normalizeIndusCodeEnvironment(env[INDUSCODE_ENVIRONMENT_OVERRIDE_ENV]) ??
		normalizeIndusCodeEnvironment(env[INDUSCODE_ENVIRONMENT_ENV]) ??
		DEFAULT_INDUSCODE_ENVIRONMENT
	);
}

function getEnvConfig(env?: IndusCodeEnvironment) {
	if (typeof env === "string") {
		return INDUSCODE_ENVIRONMENTS[env];
	}
	return INDUSCODE_ENVIRONMENTS[resolveIndusCodeEnvironment()];
}

function applyConfigOverrides(
	config: IndusCodeEnvironmentConfig,
	env: NodeJS.ProcessEnv,
): IndusCodeEnvironmentConfig {
	if (env.INDUSCODE_API_BASE_URL) {
		config = {
			...config,
			apiBaseUrl: env.INDUSCODE_API_BASE_URL,
			mcpBaseUrl: `${env.INDUSCODE_API_BASE_URL}/v1/mcp`,
		};
	}

	return config;
}

export function getIndusCodeEnvironmentConfig(
	env?: IndusCodeEnvironment,
): IndusCodeEnvironmentConfig {
	const config = getEnvConfig(env);

	return applyConfigOverrides(config, readProcessEnv());
}
