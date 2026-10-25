import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveIndusCodeDataDir } from "@induscode/shared/storage";

export type UserTier = "FREE_TIER" | "PRO_TIER" | "BYOK_TIER";

export type QuotaBucketType = "SHORT_TERM" | "LONG_TERM";

export interface QuotaStatus {
	tier: UserTier;
	bucketType: QuotaBucketType;
	remainingFraction: number; // 0.0 to 1.0
	remainingAmount: number; // remaining turns
	dailyQuota: number; // total daily allowed turns
	usedToday: number;
	resetTime: string; // ISO UTC string
	statusBadge: "green" | "yellow" | "red";
	isRateLimited: boolean;
	rateLimitResetSeconds?: number;
}

export interface QuotaRecord {
	date: string; // YYYY-MM-DD
	usedTurns: number;
	lastRequestTimestamp: number;
	shortTermTimestamps: number[]; // timestamps in last 60s
}

export class QuotaExceededError extends Error {
	public readonly reason: "RATE_LIMIT_EXCEEDED" | "QUOTA_EXHAUSTED" | "MODEL_QUOTA_LIMIT_EXCEEDED";
	public readonly quotaBucketType: 0 | 1;
	public readonly quotaResetUTCTimestamp: string;
	public readonly retryAfterSeconds?: number;

	constructor(
		message: string,
		reason: "RATE_LIMIT_EXCEEDED" | "QUOTA_EXHAUSTED" | "MODEL_QUOTA_LIMIT_EXCEEDED",
		quotaBucketType: 0 | 1,
		quotaResetUTCTimestamp: string,
		retryAfterSeconds?: number,
	) {
		super(message);
		this.name = "QuotaExceededError";
		this.reason = reason;
		this.quotaBucketType = quotaBucketType;
		this.quotaResetUTCTimestamp = quotaResetUTCTimestamp;
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

const DEFAULT_FREE_DAILY_TURNS = 100;
const DEFAULT_FREE_BURST_RPM = 10;
const DEFAULT_PRO_DAILY_TURNS = 1000;
const DEFAULT_PRO_BURST_RPM = 60;

export class QuotaService {
	private quotaFilePath: string;
	private inMemoryRecord: QuotaRecord | null = null;

	constructor(customFilePath?: string) {
		if (customFilePath) {
			this.quotaFilePath = customFilePath;
		} else {
			const dataDir = resolveIndusCodeDataDir();
			this.quotaFilePath = join(dataDir, "settings", "quota-status.json");
		}
	}

	private getTodayDateString(): string {
		return new Date().toISOString().slice(0, 10);
	}

	private getNextMidnightUTCTimestamp(): string {
		const now = new Date();
		const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
		return tomorrow.toISOString();
	}

	private loadRecord(): QuotaRecord {
		const today = this.getTodayDateString();
		if (this.inMemoryRecord && this.inMemoryRecord.date === today) {
			return this.inMemoryRecord;
		}

		try {
			if (existsSync(this.quotaFilePath)) {
				const raw = readFileSync(this.quotaFilePath, "utf8");
				const parsed = JSON.parse(raw) as QuotaRecord;
				if (parsed && parsed.date === today) {
					this.inMemoryRecord = parsed;
					return parsed;
				}
			}
		} catch {
			// fallback to new record
		}

		const newRecord: QuotaRecord = {
			date: today,
			usedTurns: 0,
			lastRequestTimestamp: Date.now(),
			shortTermTimestamps: [],
		};
		this.saveRecord(newRecord);
		return newRecord;
	}

	private saveRecord(record: QuotaRecord): void {
		this.inMemoryRecord = record;
		try {
			const dir = dirname(this.quotaFilePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			writeFileSync(this.quotaFilePath, JSON.stringify(record, null, 2), "utf8");
		} catch {
			// ignore disk write errors
		}
	}

	public getStatus(tier: UserTier = "FREE_TIER"): QuotaStatus {
		if (tier === "BYOK_TIER") {
			return {
				tier,
				bucketType: "LONG_TERM",
				remainingFraction: 1.0,
				remainingAmount: 999999,
				dailyQuota: 999999,
				usedToday: 0,
				resetTime: this.getNextMidnightUTCTimestamp(),
				statusBadge: "green",
				isRateLimited: false,
			};
		}

		const record = this.loadRecord();
		const dailyLimit = tier === "PRO_TIER" ? DEFAULT_PRO_DAILY_TURNS : DEFAULT_FREE_DAILY_TURNS;
		const remaining = Math.max(0, dailyLimit - record.usedTurns);
		const fraction = Math.min(1.0, Math.max(0, remaining / dailyLimit));

		// Clean up short term timestamps older than 60s
		const now = Date.now();
		const recentTimestamps = (record.shortTermTimestamps || []).filter((ts) => now - ts < 60_000);
		const burstLimit = tier === "PRO_TIER" ? DEFAULT_PRO_BURST_RPM : DEFAULT_FREE_BURST_RPM;
		const isRateLimited = recentTimestamps.length >= burstLimit;

		let statusBadge: "green" | "yellow" | "red" = "green";
		if (fraction < 0.10) {
			statusBadge = "red";
		} else if (fraction < 0.25) {
			statusBadge = "yellow";
		}

		let rateLimitResetSeconds: number | undefined;
		if (isRateLimited && recentTimestamps.length > 0) {
			const oldestRecent = Math.min(...recentTimestamps);
			rateLimitResetSeconds = Math.max(1, Math.ceil((60_000 - (now - oldestRecent)) / 1000));
		}

		return {
			tier,
			bucketType: isRateLimited ? "SHORT_TERM" : "LONG_TERM",
			remainingFraction: fraction,
			remainingAmount: remaining,
			dailyQuota: dailyLimit,
			usedToday: record.usedTurns,
			resetTime: this.getNextMidnightUTCTimestamp(),
			statusBadge,
			isRateLimited,
			rateLimitResetSeconds,
		};
	}

	public checkAndConsumeTurn(tier: UserTier = "FREE_TIER", modelId?: string): void {
		if (tier === "BYOK_TIER") {
			return; // Unlimited
		}

		const now = Date.now();
		const record = this.loadRecord();

		// 1. Bucket 0: Check short-term burst rate limit
		const burstLimit = tier === "PRO_TIER" ? DEFAULT_PRO_BURST_RPM : DEFAULT_FREE_BURST_RPM;
		record.shortTermTimestamps = (record.shortTermTimestamps || []).filter((ts) => now - ts < 60_000);

		if (record.shortTermTimestamps.length >= burstLimit) {
			const oldest = Math.min(...record.shortTermTimestamps);
			const retryAfter = Math.max(1, Math.ceil((60_000 - (now - oldest)) / 1000));
			throw new QuotaExceededError(
				`Too many requests, please try again in ${retryAfter}s!`,
				"RATE_LIMIT_EXCEEDED",
				0,
				new Date(now + retryAfter * 1000).toISOString(),
				retryAfter,
			);
		}

		// 2. Bucket 1: Check long-term daily turn quota
		const dailyLimit = tier === "PRO_TIER" ? DEFAULT_PRO_DAILY_TURNS : DEFAULT_FREE_DAILY_TURNS;
		if (record.usedTurns >= dailyLimit) {
			const resetTime = this.getNextMidnightUTCTimestamp();
			const readableDate = new Date(resetTime).toLocaleTimeString();
			throw new QuotaExceededError(
				`Free tier daily quota of ${dailyLimit} turns reached for ${modelId || "this model"}. Your plan's baseline quota will refresh at ${readableDate} UTC. Switch to BYOK or upgrade to continue.`,
				"MODEL_QUOTA_LIMIT_EXCEEDED",
				1,
				resetTime,
			);
		}

		// 3. Increment usage
		record.usedTurns += 1;
		record.shortTermTimestamps.push(now);
		record.lastRequestTimestamp = now;
		this.saveRecord(record);
	}
}

export const defaultQuotaService = new QuotaService();
