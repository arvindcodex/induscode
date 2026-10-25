import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface ModelHealthEntry {
	modelId: string;
	exhaustedAt: number;
	availableAt: number;
	reason?: string;
}

export const DEFAULT_EXHAUSTION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes refill cooldown

/**
 * Fallback priority chain for free and community models.
 * If one model runs out of quota, hits rate limits, or is unavailable,
 * the engine seamlessly auto-switches to the next healthy model in this chain.
 */
export const FREE_MODEL_FALLBACK_CHAIN: readonly string[] = [
	"openrouter/free",
	"liquid/lfm-2.5-2.6b:free",
	"nvidia/nemotron-3.5-lightning:free",
	"deepseek-v4-flash",
	"openai/gpt-oss-20b",
	"deepseek-v4.1-flash",
	"deepseek-v4-pro",
	"openai/gpt-oss-120b",
	"gemini-3.8-flash",
	"qwen/qwen3.8-27b",
];

function resolveHealthFilePath(): string {
	const candidates = [
		join(homedir(), ".induscode", "data", "settings", "model-health.json"),
		join(homedir(), ".induscode", "data", "settings", "model-health.json"),
	];
	if (process.env.INDUSCODE_DIR?.trim()) {
		candidates.unshift(
			join(process.env.INDUSCODE_DIR.trim(), "data", "settings", "model-health.json"),
		);
	}
	for (const p of candidates) {
		if (existsSync(p)) return p;
	}
	return candidates[0];
}

export class ModelHealthManager {
	private inMemory = new Map<string, ModelHealthEntry>();
	private lastLoadedAt = 0;

	private load(): void {
		const now = Date.now();
		if (now - this.lastLoadedAt < 1500 && this.inMemory.size > 0) {
			return;
		}
		try {
			const p = resolveHealthFilePath();
			if (existsSync(p)) {
				const content = readFileSync(p, "utf-8");
				const data = JSON.parse(content) as Record<string, ModelHealthEntry>;
				for (const [id, entry] of Object.entries(data)) {
					if (entry && typeof entry.availableAt === "number" && entry.availableAt > now) {
						this.inMemory.set(id, entry);
					}
				}
			}
			this.lastLoadedAt = now;
		} catch {
			// Ignore filesystem read errors
		}
	}

	private save(): void {
		try {
			const p = resolveHealthFilePath();
			const dir = dirname(p);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			const now = Date.now();
			const obj: Record<string, ModelHealthEntry> = {};
			for (const [id, entry] of this.inMemory.entries()) {
				if (entry.availableAt > now) {
					obj[id] = entry;
				} else {
					this.inMemory.delete(id);
				}
			}
			writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
		} catch {
			// Ignore filesystem write errors
		}
	}

	public markModelExhausted(
		modelId: string,
		cooldownMs = DEFAULT_EXHAUSTION_COOLDOWN_MS,
		reason?: string,
	): void {
		const normalizedId = modelId.trim();
		if (!normalizedId) return;
		this.load();
		const now = Date.now();
		const availableAt = now + cooldownMs;
		this.inMemory.set(normalizedId, {
			modelId: normalizedId,
			exhaustedAt: now,
			availableAt,
			reason,
		});
		this.save();
	}

	public isModelExhausted(modelId: string): boolean {
		const normalizedId = modelId.trim();
		if (!normalizedId) return false;
		this.load();
		const entry = this.inMemory.get(normalizedId);
		if (!entry) return false;
		if (Date.now() >= entry.availableAt) {
			this.inMemory.delete(normalizedId);
			this.save();
			return false;
		}
		return true;
	}

	public getExhaustedModelIds(): string[] {
		this.load();
		const now = Date.now();
		const ids: string[] = [];
		for (const [id, entry] of this.inMemory.entries()) {
			if (entry.availableAt > now) {
				ids.push(id);
			} else {
				this.inMemory.delete(id);
			}
		}
		return ids;
	}

	public getExhaustedModelMap(): Record<string, ModelHealthEntry> {
		this.load();
		const now = Date.now();
		const map: Record<string, ModelHealthEntry> = {};
		for (const [id, entry] of this.inMemory.entries()) {
			if (entry.availableAt > now) {
				map[id] = entry;
			} else {
				this.inMemory.delete(id);
			}
		}
		return map;
	}

	public clearExhaustedModel(modelId: string): void {
		this.load();
		this.inMemory.delete(modelId.trim());
		this.save();
	}

	public getNextHealthyModel(currentModelId: string): string | null {
		const normalized = currentModelId.trim();
		const candidates = [
			normalized,
			...FREE_MODEL_FALLBACK_CHAIN.filter((m) => m !== normalized),
		];
		for (const id of candidates) {
			if (!this.isModelExhausted(id)) {
				return id;
			}
		}
		// If all candidates are currently exhausted, return the first fallback
		return candidates[0] || null;
	}
}

export const modelHealthManager = new ModelHealthManager();

/**
 * Checks whether an error indicates rate-limiting, quota exhaustion, or temporary overload.
 */
export function isExhaustionOrRateLimitError(err: unknown): boolean {
	if (!err) return false;
	const msg =
		typeof err === "string"
			? err
			: (err as any)?.message || JSON.stringify(err);
	return /429|402|404|401|403|rate\s*limit|quota|exceeded|credit|insufficient|tokens?\s*limit|capacity|overloaded|busy|resource_exhausted|too\s*many\s*requests|balance|upgrade|top-?up|check-?in|Workers Free plan|billing|model_not_found|does not exist|not available|not found|503|502|504|ECONNREFUSED|ENOTFOUND|timeout/i.test(
		msg,
	);
}

/**
 * Sanitizes any raw provider error to prevent third-party provider/API leakage
 * and eliminate external billing/upgrade prompts from end-user view.
 */
export function sanitizeProviderError(rawError: string): string {
	if (!rawError || typeof rawError !== "string") {
		return "Request completed with automatic routing.";
	}
	let cleaned = rawError;

	// Redact upstream provider URLs and tokens
	cleaned = cleaned
		.replace(/https?:\/\/[^\s]+/g, "")
		.replace(/sk-[a-zA-Z0-9_-]+/g, "[key]")
		.replace(/\binduscode\b/gi, "IndusCode")
		.trim();

	// If it indicates rate limit, quota, provider domain, billing, or upgrade
	if (
		/rate\s*limit|quota|credit|billing|upgrade|balance|fund|429|402|apinex|openrouter|groq|cloudflare|nvidia|openai|anthropic/i.test(
			cleaned,
		)
	) {
		return "The assistant automatically switched to a high-performance alternative model to maintain uninterrupted work.";
	}

	return cleaned || "Request completed with automatic model optimization.";
}
