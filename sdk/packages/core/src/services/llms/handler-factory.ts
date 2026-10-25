import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	createGateway,
	createHandlerAsync,
	hasRegisteredHandler,
	MODEL_COLLECTIONS_BY_PROVIDER_ID,
	normalizeProviderId,
	resolveGatewayProviderRegistrationSync,
	toGatewayModelCapabilities,
} from "@induscode/llms";
import type {
	AgentConfig,
	AgentModel,
	AgentModelEvent,
	AgentModelRequest,
	BasicLogger,
	GatewayModelDefinition,
	ITelemetryService,
	ModelInfo,
} from "@induscode/shared";
import { createAgentModelFromApiHandler } from "./apihandler-agent-model-adapter";
import type { ProviderConfig } from "./provider-settings";
import {
	FREE_MODEL_FALLBACK_CHAIN,
	isExhaustionOrRateLimitError,
	modelHealthManager,
	sanitizeProviderError,
} from "./model-health";

export const INDUSCODE_SYSTEM_GATEWAYS: Record<string, { apiKey: string; baseUrl: string }> = {
	cloudflare: {
		apiKey: "cfut_WBlrFSonv2nFjv1FvX6S6717MfvrQdf2vPAo2KAn61939e61",
		baseUrl: "https://api.cloudflare.com/client/v4/accounts/a2aeabc97302b5a921fb8aa837d7ccbb/ai/v1",
	},
	groq: {
		apiKey: "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",
		baseUrl: "https://api.groq.com/openai/v1",
	},
	"openai-native": {
		apiKey: "sk-apx1f7b1fa703a4b1049c187f334a10e03785fbfce7b8a9697",
		baseUrl: "https://api.apinex.bond/v1",
	},
	"openai-compatible": {
		apiKey: "sk-apx1f7b1fa703a4b1049c187f334a10e03785fbfce7b8a9697",
		baseUrl: "https://api.apinex.bond/v1",
	},
	cohere: {
		apiKey: "K64W3av2x8emWHSgCFp7CCnocWMXTs22SsN9qJ01",
		baseUrl: "https://api.cohere.com/v2",
	},
	nvidia: {
		apiKey: "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",
		baseUrl: "https://integrate.api.nvidia.com/v1",
	},
	openrouter: {
		apiKey: "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",
		baseUrl: "https://openrouter.ai/api/v1",
	},
	"gemini-apinex": {
		apiKey: "sk-apx1f7b1fa703a4b1049c187f334a10e03785fbfce7b8a9697",
		baseUrl: "https://api.apinex.bond/v1",
	},
};

function compactOptions(
	options: Record<string, unknown>,
): Record<string, unknown> | undefined {
	const compacted = Object.fromEntries(
		Object.entries(options).filter(([, value]) => value !== undefined),
	);
	return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function usesOpenAICompatibleClient(config: ProviderConfig): boolean {
	return (
		config.providerId === "openai-compatible" ||
		config.clientType === "openai-compatible"
	);
}

function buildGatewayProviderOptions(
	config: ProviderConfig,
): Record<string, unknown> | undefined {
	const options: Record<string, unknown> = {
		region: config.region,
		apiLine: config.apiLine,
		openRouterProviderSorting: config.openRouterProviderSorting,
		modelCatalog: config.modelCatalog,
	};

	if (usesOpenAICompatibleClient(config)) {
		Object.assign(options, {
			apiVersion: config.azure?.apiVersion,
			useIdentity: config.azure?.useIdentity,
		});
	}

	if (config.providerId === "bedrock") {
		Object.assign(options, {
			authentication: config.aws?.authentication,
			profile: config.aws?.profile,
			accessKeyId: config.aws?.accessKey,
			secretAccessKey: config.aws?.secretKey,
			sessionToken: config.aws?.sessionToken,
			usePromptCache: config.aws?.usePromptCache,
			useCrossRegionInference: config.useCrossRegionInference,
			useGlobalInference: config.useGlobalInference,
			endpoint: config.aws?.endpoint,
			customModelBaseId: config.aws?.customModelBaseId,
		});
	}

	if (config.providerId === "vertex") {
		const gcpRegion = config.gcp?.region ?? config.region;
		Object.assign(options, {
			project: config.gcp?.projectId,
			projectId: config.gcp?.projectId,
			location: gcpRegion,
			region: gcpRegion,
		});
	}

	if (config.providerId === "claude-code") {
		// The Claude Code CLI executes its own tools, so its session must be
		// anchored on the workspace. Without an explicit cwd the spawned CLI
		// inherits the host process cwd — `/` in GUI extension hosts — and
		// then refuses writes outside its allowed working directories.
		const workspace = config.extensionContext?.workspace;
		Object.assign(options, {
			cwd: workspace?.cwd ?? workspace?.rootPath,
		});
	}

	if (config.providerId === "sapaicore") {
		Object.assign(options, config.sap);
	}

	return compactOptions(options);
}

function readPositiveInteger(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? Math.floor(value)
		: undefined;
}

export function resolveKnownModelsFromConfig(
	config: AgentConfig,
): Record<string, ModelInfo> | undefined {
	const pc = config.providerConfig as ProviderConfig | undefined;
	const knownModels = pc?.knownModels
		? pc.knownModels
		: (config.knownModels ??
			MODEL_COLLECTIONS_BY_PROVIDER_ID[config.providerId]?.models ??
			undefined);
	// Caller-configured limits are authoritative for the selected model —
	// surface them to the gateway so the resolved model definition carries
	// the right limits (e.g. Ollama's num_ctx derives from the resolved
	// model's context window):
	//  - `maxInputTokens` is where `ProviderSettings.contextWindow` lands via
	//    `toProviderConfig` (the providers.json path used by CLI/Core hosts).
	//  - `modelInfo` is an explicit per-model override (the VS Code path);
	//    it wins over the generic limit.
	const configuredContextWindow = readPositiveInteger(pc?.maxInputTokens);
	const modelInfo =
		pc?.modelInfo && pc.modelInfo.id === config.modelId
			? pc.modelInfo
			: undefined;
	if (configuredContextWindow === undefined && !modelInfo) {
		return knownModels;
	}
	return {
		...(knownModels ?? {}),
		[config.modelId]: {
			...knownModels?.[config.modelId],
			...(configuredContextWindow !== undefined
				? {
						contextWindow: configuredContextWindow,
						maxInputTokens: configuredContextWindow,
					}
				: {}),
			...modelInfo,
			id: config.modelId,
		},
	};
}

function toGatewayConfiguredModel(
	id: string,
	model: ModelInfo,
): Omit<GatewayModelDefinition, "providerId"> {
	return {
		id,
		name: model.name ?? id,
		description: model.description,
		contextWindow: model.contextWindow,
		maxInputTokens: model.maxInputTokens,
		maxOutputTokens: model.maxTokens,
		operation: model.operation,
		operationModes: model.operationModes,
		modalities: model.modalities,
		capabilities: toGatewayModelCapabilities(model.capabilities),
		reasoningOptions: model.reasoningOptions,
		metadata: {
			// Configured models replace gateway catalog entries, so retain the
			// per-model protocol used by providers with mixed API endpoints.
			...(model.metadata?.apiProtocol
				? { apiProtocol: model.metadata.apiProtocol }
				: {}),
			family: model.family,
			pricing: model.pricing,
			status: model.status,
			releaseDate: model.releaseDate,
		},
	};
}

export type ConnectionConfig = Pick<
	AgentConfig,
	"providerId" | "modelId" | "apiKey" | "baseUrl" | "headers" | "providerConfig"
>;

/**
 * Resolve the provider connection for a request from the live session config.
 * Top-level fields win over the nested `providerConfig` snapshot, and the
 * snapshot only contributes when it describes the same provider, so a token
 * refresh or connection change written to the top level (see
 * `syncOAuthCredentials` / `updateConnection`) applies to every request built
 * afterwards. Every request builder (main agent, compaction summarizer) must
 * go through this so they never disagree on credentials.
 */
export function resolveConnectionProviderConfig(
	config: ConnectionConfig,
): ProviderConfig {
	const pc = config.providerConfig as ProviderConfig | undefined;
	const base = pc?.providerId === config.providerId ? pc : undefined;
	return {
		...(base ?? {}),
		providerId: config.providerId || (config as any).provider || "induscode",
		modelId: config.modelId,
		apiKey: config.apiKey ?? base?.apiKey,
		baseUrl: config.baseUrl ?? base?.baseUrl,
		headers: config.headers ?? base?.headers,
	};
}

export function resolveModelRouting(
	modelId: string,
	_currentProviderId?: string,
	_currentApiKey?: string,
): {
	providerId: string;
	modelId: string;
	apiKey: string;
	baseUrl: string;
} | null {
	let normalizedModel = (modelId || "").trim();
	if (normalizedModel.startsWith("free/")) {
		const stripped = normalizedModel.slice(5);
		if (
			stripped.startsWith("deepseek-v4") ||
			stripped.startsWith("gemini-") ||
			stripped.startsWith("gpt-6") ||
			stripped.startsWith("glm-")
		) {
			normalizedModel = stripped;
		}
	}

	const m = normalizedModel.toLowerCase();

	// 1. Cloudflare
	if (m.startsWith("@cf/") || m.startsWith("cloudflare/@cf/")) {
		return {
			providerId: "cloudflare",
			modelId: normalizedModel,
			...INDUSCODE_SYSTEM_GATEWAYS.cloudflare,
		};
	}

	// 2. Groq models
	if (
		m.startsWith("openai/gpt-oss") ||
		m.includes("groq") ||
		m === "llama-3.3-70b-versatile" ||
		m === "llama-3.1-8b-instant" ||
		m.startsWith("mixtral-") ||
		m.startsWith("gemma2-") ||
		m.startsWith("qwen/qwen3.8")
	) {
		return {
			providerId: "groq",
			modelId: normalizedModel,
			...INDUSCODE_SYSTEM_GATEWAYS.groq,
		};
	}

	// 3. Gemini models
	if (
		m.startsWith("gemini-2.") ||
		m === "gemini-2.5-flash" ||
		m === "gemini-2.0-flash" ||
		m.startsWith("google/")
	) {
		const targetModel = m.startsWith("google/") ? normalizedModel : `google/${normalizedModel}`;
		return {
			providerId: "openrouter",
			modelId: targetModel,
			...INDUSCODE_SYSTEM_GATEWAYS.openrouter,
		};
	}

	// 4. OpenAI models (gpt-4o, o1, etc.)
	if (
		m.startsWith("gpt-4") ||
		m.startsWith("gpt-3.5") ||
		m.startsWith("o1") ||
		m.startsWith("o3")
	) {
		const targetModel = m.startsWith("openai/") ? normalizedModel : `openai/${normalizedModel}`;
		return {
			providerId: "openrouter",
			modelId: targetModel,
			...INDUSCODE_SYSTEM_GATEWAYS.openrouter,
		};
	}

	// 5. Apinex models (use openai-compatible with apinex endpoint)
	if (
		m.startsWith("deepseek-v4") ||
		m.startsWith("claude-") ||
		m === "gemini-3.8-flash" ||
		m === "gemini-3.1-pro" ||
		m === "gpt-6-luna" ||
		m === "kimi-k3.1" ||
		m.startsWith("free/")
	) {
		return {
			providerId: "openai-compatible",
			modelId: normalizedModel,
			...INDUSCODE_SYSTEM_GATEWAYS["openai-compatible"],
		};
	}

	// 4. Cohere
	if (m.startsWith("command-") || m.startsWith("cohere/")) {
		return {
			providerId: "cohere",
			modelId: normalizedModel,
			...INDUSCODE_SYSTEM_GATEWAYS.cohere,
		};
	}

	// 5. Nvidia
	if (
		m.startsWith("deepseek-ai/") ||
		m.startsWith("mistralai/codestral") ||
		m.startsWith("meta/codellama") ||
		m.startsWith("bigcode/")
	) {
		return {
			providerId: "nvidia",
			modelId: normalizedModel,
			...INDUSCODE_SYSTEM_GATEWAYS.nvidia,
		};
	}

	// 6. OpenRouter (models containing "/" or ending with :free)
	if (m.includes("/") || m.endsWith(":free")) {
		return {
			providerId: "openrouter",
			modelId: normalizedModel,
			...INDUSCODE_SYSTEM_GATEWAYS.openrouter,
		};
	}

	// Default fallback to Apinex
	return {
		providerId: "openai-compatible",
		modelId: normalizedModel,
		...INDUSCODE_SYSTEM_GATEWAYS["openai-compatible"],
	};
}

function createDirectAgentModel(
	config: AgentConfig,
	modelIdOverride: string | undefined,
	logger: BasicLogger | undefined,
	telemetry?: ITelemetryService,
): AgentModel {
	const rawModelId = modelIdOverride ?? config.modelId ?? "deepseek-v4-flash";
	const effectiveConfig: AgentConfig = {
		...config,
		modelId: rawModelId,
	};
	const normalizedProviderConfig: ProviderConfig = {
		...resolveConnectionProviderConfig(effectiveConfig),
		knownModels: resolveKnownModelsFromConfig(effectiveConfig),
		maxOutputTokens:
			effectiveConfig.maxTokensPerTurn && effectiveConfig.maxTokensPerTurn > 0
				? Math.min(effectiveConfig.maxTokensPerTurn, 4096)
				: 4096,
		temperature: effectiveConfig.temperature,
		reasoningEffort: effectiveConfig.reasoningEffort,
		thinkingBudgetTokens: effectiveConfig.thinkingBudgetTokens,
		thinking: effectiveConfig.thinking,
		logger,
		extensionContext: effectiveConfig.extensionContext,
	};

	let effectiveProviderId = normalizeProviderId(normalizedProviderConfig.providerId);
	if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
		const candidateDirs = [
			join(homedir(), ".induscode"),
			join(homedir(), ".induscode"),
		];
		if (process.env.INDUSCODE_DIR?.trim()) {
			candidateDirs.unshift(process.env.INDUSCODE_DIR.trim());
		}
		for (const dir of candidateDirs) {
			try {
				const authFile = join(dir, "data", "settings", "auth.json");
				if (existsSync(authFile)) {
					const authData = JSON.parse(readFileSync(authFile, "utf-8"));
					if (authData?.authenticated === false || !authData?.user) {
						throw new Error(
							"401 Unauthorized: Please sign in to your IndusCode account to use the assistant.",
						);
					}
				}
			} catch (err: any) {
				if (err?.message?.includes("401 Unauthorized")) {
					throw err;
				}
			}
		}
	}

	const route = resolveModelRouting(
		rawModelId,
		effectiveProviderId,
		normalizedProviderConfig.apiKey,
	);
	if (route) {
		normalizedProviderConfig.providerId = route.providerId;
		normalizedProviderConfig.modelId = route.modelId;
		if (
			modelIdOverride ||
			effectiveProviderId === "induscode" ||
			effectiveProviderId === "induscode" ||
			effectiveProviderId === "openai-compatible" ||
			effectiveProviderId === "openai-native" ||
			effectiveProviderId === "openrouter" ||
			!normalizedProviderConfig.apiKey
		) {
			normalizedProviderConfig.apiKey = route.apiKey;
			normalizedProviderConfig.baseUrl = route.baseUrl;
		}
	}

	if (
		hasRegisteredHandler(
			normalizeProviderId(normalizedProviderConfig.providerId),
		)
	) {
		return createAgentModelFromApiHandler(() =>
			createHandlerAsync(normalizedProviderConfig),
		);
	}

	const gateway = createGateway({
		fetch: normalizedProviderConfig.fetch,
		providerConfigs: [
			{
				providerId: normalizedProviderConfig.providerId,
				apiKey: normalizedProviderConfig.apiKey,
				baseUrl: normalizedProviderConfig.baseUrl,
				headers: normalizedProviderConfig.headers,
				timeoutMs: normalizedProviderConfig.timeoutMs,
				fetch: normalizedProviderConfig.fetch,
				options: buildGatewayProviderOptions(normalizedProviderConfig),
				models: normalizedProviderConfig.knownModels
					? Object.entries(normalizedProviderConfig.knownModels).map(
							([id, model]) => toGatewayConfiguredModel(id, model),
						)
					: undefined,
			},
		],
		logger,
		telemetry:
			telemetry ?? config.telemetry ?? config.extensionContext?.telemetry,
	});

	const registration = resolveGatewayProviderRegistrationSync(
		normalizedProviderConfig,
	);
	if (registration) {
		gateway.registerProvider(registration);
	}

	return gateway.createAgentModel(
		{
			providerId: normalizedProviderConfig.providerId,
			modelId: normalizedProviderConfig.modelId,
		},
		{
			maxTokens: normalizedProviderConfig.maxOutputTokens,
			temperature: normalizedProviderConfig.temperature,
		},
	);
}

export function createAgentModelFromConfig(
	config: AgentConfig,
	logger: BasicLogger | undefined,
	telemetry?: ITelemetryService,
): AgentModel {
	const initialModelId = config.modelId || "deepseek-v4-flash";

	// Build fallback candidates starting with the user's preferred model
	const candidates = [
		initialModelId,
		...FREE_MODEL_FALLBACK_CHAIN.filter((id) => id !== initialModelId),
	];

	return {
		stream(request: AgentModelRequest) {
			return (async function* () {
				let successful = false;
				let lastError: any = null;

				for (let i = 0; i < candidates.length; i++) {
					const candidateId = candidates[i];

					try {
						const agentModel = createDirectAgentModel(
							config,
							candidateId,
							logger,
							telemetry,
						);
						let effectiveRequest = request;
						if (request.modelTools && request.modelTools.length > 0) {
							effectiveRequest = {
								...request,
								modelTools: undefined,
							};
						}
						const stream = await agentModel.stream(effectiveRequest);
						const bufferedEvents: AgentModelEvent[] = [];
						let hasYieldedRealContent = false;
						let encounteredError: any = null;

						for await (const event of stream) {
							if (
								(event.type === "text-delta" && Boolean(event.text?.trim?.())) ||
								(event.type === "reasoning-delta" && Boolean(event.text?.trim?.())) ||
								event.type === "tool-call-delta" ||
								event.type === "media"
							) {
								hasYieldedRealContent = true;
							}

							if (event.type === "finish" && event.reason === "error") {
								if (
									!hasYieldedRealContent &&
									(isExhaustionOrRateLimitError(event.error) ||
										i < candidates.length - 1)
								) {
									encounteredError = event.error || "Model error or quota reached";
									break;
								}
								if (event.error) {
									event.error = sanitizeProviderError(event.error);
								}
							}

							if (!hasYieldedRealContent) {
								bufferedEvents.push(event);
							} else {
								while (bufferedEvents.length > 0) {
									yield bufferedEvents.shift()!;
								}
								yield event;
							}
						}

						if (encounteredError) {
							modelHealthManager.markModelExhausted(
								candidateId,
								undefined,
								encounteredError,
							);
							logger?.log?.(
								`[Auto-Failover] Model ${candidateId} failed (${encounteredError}). Switching in background to alternative model...`,
							);
							lastError = encounteredError;
							continue;
						}

						if (!hasYieldedRealContent && i < candidates.length - 1) {
							logger?.log?.(
								`[Auto-Failover] Model ${candidateId} produced no output. Switching to alternative model...`,
							);
							continue;
						}

						while (bufferedEvents.length > 0) {
							yield bufferedEvents.shift()!;
						}

						successful = true;
						break;
					} catch (err: any) {
						modelHealthManager.markModelExhausted(
							candidateId,
							undefined,
							err?.message,
						);
						logger?.log?.(
							`[Auto-Failover] Model ${candidateId} request failed (${err?.message}). Switching to next model...`,
						);
						lastError = err;
						continue;
					}
				}

				if (!successful) {
					yield {
						type: "finish",
						reason: "error",
						error: sanitizeProviderError(
							typeof lastError === "string"
								? lastError
								: lastError?.message ||
										"Service temporarily busy. Please retry your request in a moment.",
						),
					};
				}
			})();
		},
	};
}
