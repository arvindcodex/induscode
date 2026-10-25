export type CloudModel = {
	id: string;
	name: string;
	catalogId: "induscode" | "induscode-pass" | "induscode-cloud";
};

function readCloudModel(
	value: unknown,
	catalogId: CloudModel["catalogId"],
): CloudModel | undefined {
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	const id = typeof record.id === "string" ? record.id.trim() : "";
	if (!id) return undefined;
	const displayName =
		typeof record.display_name === "string"
			? record.display_name.trim()
			: typeof record.displayName === "string"
				? record.displayName.trim()
				: "";
	const name = typeof record.name === "string" ? record.name.trim() : "";
	return { id, name: displayName || name || id, catalogId };
}

function readCloudModels(
	value: unknown,
	catalogId: CloudModel["catalogId"],
): CloudModel[] {
	return Array.isArray(value)
		? value.flatMap((entry) => {
				const model = readCloudModel(entry, catalogId);
				return model ? [model] : [];
			})
		: [];
}

export const BUILTIN_FREE_MODELS: CloudModel[] = [
	// High-Context & Deep Reasoning
	{ id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", catalogId: "induscode" },
	{ id: "gemini-3.1-pro", name: "Gemini 3.1 Pro", catalogId: "induscode" },
	{ id: "gemini-4-argon", name: "Gemini 4 Argon", catalogId: "induscode" },
	{ id: "free/gemini-3.8-flash", name: "Gemini 3.8 Flash", catalogId: "induscode" },
	{ id: "free/deepseek-v4.1-flash", name: "DeepSeek V4.1 Plus", catalogId: "induscode" },
	{ id: "free/gpt-6-luna", name: "GPT-6 Luna", catalogId: "induscode" },
	{ id: "free/muse-spark-1.3", name: "Muse Spark 1.3", catalogId: "induscode" },

	// Ultra-Fast Inference
	{ id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", catalogId: "induscode" },
	{ id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", catalogId: "induscode" },
	{ id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B", catalogId: "induscode" },

	// Advanced Engineering & Reasoning
	{ id: "cohere/north-mini-code:free", name: "North Mini Code", catalogId: "induscode" },
	{ id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B", catalogId: "induscode" },
	{ id: "minimax/minimax-m3.1-flash:free", name: "MiniMax M3.1", catalogId: "induscode" },
	{ id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "Nemotron 3 Nano Reasoning", catalogId: "induscode" },

	// Agentic & Tool Execution
	{ id: "command-r-plus-08-2024", name: "Command R+", catalogId: "induscode" },
	{ id: "command-a-03-2025", name: "Command A", catalogId: "induscode" },

	// Lightweight Distributed
	{ id: "@cf/qwen/qwen2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B", catalogId: "induscode" },
	{ id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 Distill 32B", catalogId: "induscode" },
	{ id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B Fast", catalogId: "induscode" },

	// Frontier Coding & Architecture
	{ id: "deepseek-ai/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", catalogId: "induscode" },
	{ id: "mistralai/codestral-22b-instruct-v0.1", name: "Codestral 22B", catalogId: "induscode" },
	{ id: "meta/codellama-70b", name: "CodeLlama 70B", catalogId: "induscode" },
	{ id: "bigcode/starcoder2-15b", name: "StarCoder2 15B", catalogId: "induscode" },
];


export async function loadCloudModels(
	apiBaseUrl: string,
	options: { isOrganizationSession?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<CloudModel[]> {
	const trimmedBaseUrl = apiBaseUrl.trim();
	let end = trimmedBaseUrl.length;
	while (end > 0 && trimmedBaseUrl[end - 1] === "/") end--;
	const baseUrl = trimmedBaseUrl.slice(0, end);
	const load = async (path: string): Promise<unknown> => {
		const response = await (options.fetchImpl ?? fetch)(`${baseUrl}${path}`, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return await response.json();
	};
	let catalogPayload: unknown;
	let recommendedPayload: unknown;
	try {
		[catalogPayload, recommendedPayload] = await Promise.all([
			load("/api/v1/ai/induscode/models"),
			load("/api/v1/ai/induscode/recommended-models"),
		]);
	} catch (error) {
		// Fallback to built-in free models so free users are never blocked
		return [...BUILTIN_FREE_MODELS];
	}
	const catalogRecord =
		catalogPayload && typeof catalogPayload === "object"
			? (catalogPayload as Record<string, unknown>)
			: undefined;
	const catalog = readCloudModels(
		Array.isArray(catalogPayload) ? catalogPayload : catalogRecord?.data,
		"induscode",
	);
	const recommendedEnvelope =
		recommendedPayload && typeof recommendedPayload === "object"
			? (recommendedPayload as Record<string, unknown>)
			: undefined;
	const recommended =
		recommendedEnvelope?.data && typeof recommendedEnvelope.data === "object"
			? (recommendedEnvelope.data as Record<string, unknown>)
			: recommendedEnvelope;
	const pass = readCloudModels(recommended?.induscodePass, "induscode-pass");
	const cloud = readCloudModels(recommended?.induscodeCloud, "induscode-cloud");
	const seen = new Set<string>();
	return [
		...(options.isOrganizationSession ? [] : pass),
		...cloud,
		...catalog,
	].filter((model) => {
		if (seen.has(model.id)) return false;
		seen.add(model.id);
		return true;
	});
}
