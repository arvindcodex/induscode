import { desktopClient } from "@/lib/desktop-client";

export interface ClientModelHealth {
	modelId: string;
	availableAt: number;
	reason?: string;
}

const STORAGE_KEY = "induscode.model-health.cache.v1";
let inMemoryHealth: Map<string, number> = new Map();
let lastSyncTime = 0;

function loadFromLocalStorage(): void {
	if (typeof window === "undefined") return;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as Record<string, number>;
			const now = Date.now();
			for (const [id, availableAt] of Object.entries(parsed)) {
				if (typeof availableAt === "number" && availableAt > now) {
					inMemoryHealth.set(id, availableAt);
				}
			}
		}
	} catch {
		// Ignore storage errors
	}
}

function saveToLocalStorage(): void {
	if (typeof window === "undefined") return;
	try {
		const now = Date.now();
		const obj: Record<string, number> = {};
		for (const [id, availableAt] of inMemoryHealth.entries()) {
			if (availableAt > now) {
				obj[id] = availableAt;
			} else {
				inMemoryHealth.delete(id);
			}
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
	} catch {
		// Ignore storage errors
	}
}

/**
 * Checks if a model is currently exhausted/cooling down.
 * If its refill time has passed, it automatically becomes available again.
 */
export function isModelCurrentlyExhausted(modelId: string): boolean {
	if (!modelId) return false;
	const id = modelId.trim();
	if (inMemoryHealth.size === 0) {
		loadFromLocalStorage();
	}
	const availableAt = inMemoryHealth.get(id);
	if (!availableAt) return false;
	if (Date.now() >= availableAt) {
		inMemoryHealth.delete(id);
		saveToLocalStorage();
		return false;
	}
	return true;
}

/**
 * Marks a model as exhausted in client state and local storage.
 */
export function markModelExhaustedClient(
	modelId: string,
	cooldownMs = 5 * 60 * 1000,
): void {
	if (!modelId) return;
	const id = modelId.trim();
	inMemoryHealth.set(id, Date.now() + cooldownMs);
	saveToLocalStorage();
}

/**
 * Syncs the client model health map with the desktop backend sidecar.
 */
export async function syncModelHealthFromBackend(): Promise<void> {
	if (typeof window === "undefined") return;
	const now = Date.now();
	if (now - lastSyncTime < 4000) return;
	lastSyncTime = now;

	try {
		const res = await desktopClient.invoke<{
			exhaustedModelIds?: string[];
			exhaustedModelMap?: Record<string, { availableAt: number }>;
		}>("get_exhausted_models");

		if (res?.exhaustedModelMap) {
			for (const [id, entry] of Object.entries(res.exhaustedModelMap)) {
				if (entry && entry.availableAt > now) {
					inMemoryHealth.set(id, entry.availableAt);
				}
			}
			saveToLocalStorage();
		}
	} catch {
		// Ignore backend invoke errors
	}
}

// Initial hydration
if (typeof window !== "undefined") {
	loadFromLocalStorage();
	void syncModelHealthFromBackend();
	// Periodically sync every 15 seconds
	setInterval(() => {
		void syncModelHealthFromBackend();
	}, 15_000);
}
