interface IndusCodeRecommendedModel {
	id: string
	name: string
	description: string
	tags: string[]
}

export interface IndusCodeRecommendedModelsData {
	recommended: IndusCodeRecommendedModel[]
	free: IndusCodeRecommendedModel[]
}

/**
 * Hardcoded fallback shown when upstream recommended models are not enabled or unavailable.
 */
export const INDUSCODE_RECOMMENDED_MODELS_FALLBACK: IndusCodeRecommendedModelsData = {
	recommended: [
		{
			id: "google/gemini-3.1-pro-preview",
			name: "Google Gemini 3.1 Pro Preview",
			description: "Latest Gemini release with 1m ctx window and strong coding performance",
			tags: ["NEW"],
		},
		{
			id: "anthropic/claude-sonnet-4.6",
			name: "Anthropic Claude Sonnet 4.6",
			description: "Latest Sonnet release with strong coding and agent performance",
			tags: ["NEW"],
		},
		{
			id: "anthropic/claude-opus-4.6",
			name: "Anthropic Claude Opus 4.6",
			description: "Most intelligent model for agents and coding",
			tags: ["BEST"],
		},
		{
			id: "openai/gpt-5.3-codex",
			name: "OpenAI GPT-5.3 Codex",
			description: "OpenAI's latest with strong coding abilities",
			tags: ["NEW"],
		},
	],
	free: [
		// Ultra-Fast Inference Models
		{
			id: "openai/gpt-oss-120b",
			name: "OpenAI GPT-OSS 120B",
			description: "High-throughput 120B reasoning model with ultra-fast inference",
			tags: ["FAST"],
		},
		{
			id: "openai/gpt-oss-20b",
			name: "OpenAI GPT-OSS 20B",
			description: "Ultra-fast lightweight coding model",
			tags: ["FAST"],
		},
		{
			id: "qwen/qwen3.8-27b",
			name: "Qwen 3.8 27B",
			description: "High performance coding & reasoning model",
			tags: ["FAST", "CODE"],
		},
		{
			id: "llama-3.3-70b-versatile",
			name: "Llama 3.3 70B Versatile",
			description: "Flagship 70B model with blazing fast inference",
			tags: ["FAST"],
		},
		{
			id: "llama-3.1-8b-instant",
			name: "Llama 3.1 8B Instant",
			description: "Near-instant responses for everyday code generation",
			tags: ["FAST"],
		},
		{
			id: "mixtral-8x7b-32768",
			name: "Mixtral 8x7B",
			description: "High speed Mixture-of-Experts with 32k context",
			tags: ["FAST"],
		},
		{
			id: "gemma2-9b-it",
			name: "Google Gemma 2 9B",
			description: "Fast instruction-tuned model",
			tags: ["FAST"],
		},

		// Deep Reasoning Models
		{
			id: "gemini-3.8-flash",
			name: "Gemini 3.8 Flash",
			description: "High-speed 1M context multimodal reasoning and coding",
			tags: ["FAST", "REASONING"],
		},
		{
			id: "gemini-3.1-pro",
			name: "Gemini 3.1 Pro",
			description: "Frontier multimodal agent with massive context window",
			tags: ["REASONING"],
		},
		{
			id: "gemini-2.5-flash",
			name: "Gemini 2.5 Flash",
			description: "Ultra-fast multimodal reasoning for rapid agent loops",
			tags: ["FAST", "REASONING"],
		},
		{
			id: "gemini-2.5-pro",
			name: "Gemini 2.5 Pro",
			description: "Comprehensive multimodal coding and problem solving",
			tags: ["REASONING"],
		},
		{
			id: "free/gemini-3.8-flash",
			name: "Gemini 3.8 Flash",
			description: "High-speed access with 1M context window",
			tags: ["REASONING"],
		},
		{
			id: "free/muse-spark-1.3",
			name: "Muse Spark 1.3",
			description: "High-context reasoning model with 1M context",
			tags: ["REASONING"],
		},

		// Advanced Engineering & Reasoning Models
		{
			id: "cohere/north-mini-code:free",
			name: "North Mini Code",
			description: "Specialized agentic coding assistant",
			tags: ["CODE"],
		},
		{
			id: "google/gemma-4-31b-it:free",
			name: "Gemma 4 31B",
			description: "Powerful instruction-tuned open weights model",
			tags: ["PRO"],
		},
		{
			id: "minimax/minimax-m3.1-flash:free",
			name: "MiniMax M3.1 Flash",
			description: "Ultra-fast code generation and conversational intelligence",
			tags: ["FAST"],
		},
		{
			id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
			name: "Nemotron 3 Nano Reasoning",
			description: "High-performance multimodal reasoning model",
			tags: ["REASONING"],
		},
		{
			id: "deepseek/deepseek-r1:free",
			name: "DeepSeek R1",
			description: "Flagship open-weights reasoning model",
			tags: ["REASONING"],
		},
		{
			id: "meta-llama/llama-3.3-70b-instruct:free",
			name: "Llama 3.3 70B Instruct",
			description: "High-grade 70B instruction model",
			tags: ["PRO"],
		},
		{
			id: "qwen/qwen-2.5-coder-32b-instruct:free",
			name: "Qwen 2.5 Coder 32B",
			description: "State-of-the-art open coding model",
			tags: ["CODE"],
		},

		// Lightweight Distributed Models
		{
			id: "@cf/qwen/qwen2.5-coder-32b-instruct",
			name: "Qwen 2.5 Coder 32B",
			description: "Distributed edge inference for code synthesis",
			tags: ["CODE", "LIGHT"],
		},
		{
			id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
			name: "DeepSeek R1 Distill 32B",
			description: "Distilled reasoning model on distributed edge",
			tags: ["REASONING", "LIGHT"],
		},
		{
			id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			name: "Llama 3.3 70B Fast",
			description: "Quantized low-latency 70B model for fast generation",
			tags: ["FAST", "LIGHT"],
		},
		{
			id: "@cf/meta/llama-3.1-8b-instruct",
			name: "Llama 3.1 8B Instruct",
			description: "Lightweight edge inference model",
			tags: ["LIGHT"],
		},

		// Agentic & Tool Execution Models
		{
			id: "command-r-plus-08-2024",
			name: "Command R+",
			description: "Enterprise grade agentic model for complex workflows & tools",
			tags: ["AGENT"],
		},
		{
			id: "command-r-08-2024",
			name: "Command R",
			description: "High-accuracy multilingual reasoning and tool use",
			tags: ["AGENT"],
		},
		{
			id: "command-a-03-2025",
			name: "Command A",
			description: "Next-gen low latency agent model",
			tags: ["AGENT", "FAST"],
		},

		// Frontier Coding & Architecture Models
		{
			id: "deepseek-ai/deepseek-v4.1-flash",
			name: "DeepSeek V4.1 Flash",
			description: "High-performance enterprise reasoning and coding",
			tags: ["CODE", "FAST"],
		},
		{
			id: "mistralai/codestral-22b-instruct-v0.1",
			name: "Codestral 22B",
			description: "Dedicated code generation model",
			tags: ["CODE"],
		},
		{
			id: "meta/codellama-70b",
			name: "CodeLlama 70B",
			description: "Comprehensive code synthesis and debugging",
			tags: ["CODE"],
		},
		{
			id: "bigcode/starcoder2-15b",
			name: "StarCoder2 15B",
			description: "Code intelligence trained on 600+ programming languages",
			tags: ["CODE"],
		},

		// Builtin Fallback
		{
			id: "kwaipilot/kat-coder-pro",
			name: "KwaiKAT Kat Coder Pro",
			description: "Advanced agentic coding model in the KAT-Coder series",
			tags: ["CODE"],
		},
		{
			id: "arcee-ai/trinity-large-preview:free",
			name: "Arcee AI Trinity Large Preview",
			description: "Advanced large preview model in the Trinity series",
			tags: ["PRO"],
		},
	],
}
