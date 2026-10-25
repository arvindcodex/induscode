import {
	GENERATED_INDUSCODE_RECOMMENDED_MODELS,
	getGeneratedProviderModels,
} from "@induscode/llms";
import { setIndusCodeClientIdentity } from "@induscode/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	applyIndusCodeFeaturedModels,
	type IndusCodeRecommendedModelsData,
	FALLBACK_INDUSCODE_RECOMMENDED_MODELS,
	fetchIndusCodeRecommendedModels,
	getCachedIndusCodeRecommendedModels,
	idSlug,
	peekIndusCodeRecommendedModels,
	resetIndusCodeRecommendedModelsCacheForTests,
} from "./induscode-recommended-models";
import type { ModelInfo } from "./provider-settings";

const BASE_URL = "https://api.example.test";

function jsonResponse(payload: unknown): typeof fetch {
	return async () =>
		new Response(JSON.stringify(payload), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
}

function model(id: string, name: string): ModelInfo {
	return { id, name };
}

// The endpoint only sends slug-like names, mirroring production behavior.
const ENDPOINT_PAYLOAD = {
	recommended: [
		{
			id: "anthropic/claude-opus-5",
			name: "claude-opus-5",
			description: "",
			tags: ["NEW"],
		},
		{ id: "vendor/named-model", name: "named-model", description: "" },
		{ id: "vendor/unnamed-model", description: "" },
		// Vercel-style id; the catalog keys this model under "z-ai/glm-5.2"
		{ id: "zai/glm-5.2", name: "glm-5.2", description: "" },
	],
	free: [
		{
			id: "deepseek/deepseek-v4-flash",
			name: "deepseek-v4-flash",
			description: "",
		},
		{ id: "induscode-free/glm-5.2", name: "induscode-free/glm-5.2", description: "" },
		{
			id: "poolside/laguna-s-2.1:free",
			name: "laguna-s-2.1:free",
			description: "",
		},
	],
	induscodePass: [
		{ id: "induscode-pass/glm-5.2", name: "induscode-pass/glm-5.2", description: "" },
		{ id: "induscode-pass/mystery", name: "induscode-pass/mystery", description: "" },
	],
};

const CATALOG = {
	openrouter: {
		"anthropic/claude-opus-5": model(
			"anthropic/claude-opus-5",
			"Claude Opus 5",
		),
		"z-ai/glm-5.2": model("z-ai/glm-5.2", "GLM-5.2"),
	},
	induscode: {
		"deepseek/deepseek-v4-flash": model(
			"deepseek/deepseek-v4-flash",
			"DeepSeek V4 Flash",
		),
		"induscode-free/glm-5.2": model("induscode-free/glm-5.2", "GLM-5.2 (free)"),
		"poolside/laguna-s-2.1:free": model(
			"poolside/laguna-s-2.1:free",
			"Laguna S 2.1 (free)",
		),
	},
	"induscode-pass": {
		"induscode-pass/glm-5.2": model("induscode-pass/glm-5.2", "GLM-5.2"),
	},
};

function namesOf(data: IndusCodeRecommendedModelsData) {
	return {
		recommended: data.recommended.map((m) => m.name),
		free: data.free.map((m) => m.name),
		induscodePass: data.induscodePass.map((m) => m.name),
	};
}

describe("fetchIndusCodeRecommendedModels", () => {
	afterEach(() => {
		setIndusCodeClientIdentity(undefined);
	});

	it("resolves display names from the models catalog", async () => {
		const data = await fetchIndusCodeRecommendedModels({
			baseUrl: BASE_URL,
			fetchImpl: jsonResponse(ENDPOINT_PAYLOAD),
			catalogLoader: async () => CATALOG,
		});

		expect(namesOf(data)).toEqual({
			// Catalog name first (including via id aliases like zai/ -> z-ai/);
			// endpoint name when the catalog misses; the id slug when the
			// endpoint name is just the id.
			recommended: ["Claude Opus 5", "named-model", "unnamed-model", "GLM-5.2"],
			// Free markers are redundant next to the pickers' FREE chips.
			free: ["DeepSeek V4 Flash", "GLM-5.2", "Laguna S 2.1"],
			induscodePass: ["GLM-5.2", "mystery"],
		});
		// Ids are preserved untouched.
		expect(data.free.map((m) => m.id)).toEqual([
			"deepseek/deepseek-v4-flash",
			"induscode-free/glm-5.2",
			"poolside/laguna-s-2.1:free",
		]);
	});

	it("identifies the client on the feed request", async () => {
		setIndusCodeClientIdentity({ name: "VSCode Extension", version: "3.40.0" });
		const fetchImpl = vi.fn(jsonResponse(ENDPOINT_PAYLOAD));

		await fetchIndusCodeRecommendedModels({
			baseUrl: BASE_URL,
			fetchImpl: fetchImpl as unknown as typeof fetch,
			catalogLoader: async () => CATALOG,
		});

		expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
			"X-CLIENT-TYPE": "VSCode Extension",
			"X-CLIENT-VERSION": "3.40.0",
		});
	});

	it("degrades to endpoint names and id slugs when the catalog is unavailable", async () => {
		const data = await fetchIndusCodeRecommendedModels({
			baseUrl: BASE_URL,
			fetchImpl: jsonResponse(ENDPOINT_PAYLOAD),
			catalogLoader: async () => {
				throw new Error("models.dev unreachable");
			},
		});

		expect(namesOf(data)).toEqual({
			recommended: ["claude-opus-5", "named-model", "unnamed-model", "glm-5.2"],
			free: ["deepseek-v4-flash", "glm-5.2", "laguna-s-2.1"],
			induscodePass: ["glm-5.2", "mystery"],
		});
	});

	it("does not wait for a hung catalog loader beyond the timeout", async () => {
		const data = await fetchIndusCodeRecommendedModels({
			baseUrl: BASE_URL,
			fetchImpl: jsonResponse(ENDPOINT_PAYLOAD),
			timeoutMs: 25,
			catalogLoader: () => new Promise(() => {}),
		});

		expect(data.recommended[0]?.name).toBe("claude-opus-5");
	});

	it("shares one timeout budget between the feed request and the catalog lookup", async () => {
		// A feed response that consumes most of the window must not grant the
		// hung catalog loader a fresh full window on top (which would roughly
		// double the worst-case loading time).
		const feedDelayMs = 400;
		const timeoutMs = 500;
		const slowFeed: typeof fetch = async () => {
			await new Promise((resolve) => setTimeout(resolve, feedDelayMs));
			return new Response(JSON.stringify(ENDPOINT_PAYLOAD), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};

		const startedAt = Date.now();
		const data = await fetchIndusCodeRecommendedModels({
			baseUrl: BASE_URL,
			fetchImpl: slowFeed,
			timeoutMs,
			catalogLoader: () => new Promise(() => {}),
		});
		const elapsedMs = Date.now() - startedAt;

		// Stacked windows would take ~feedDelayMs + timeoutMs (~900ms).
		expect(elapsedMs).toBeLessThan(feedDelayMs + timeoutMs - 100);
		expect(data.recommended[0]?.name).toBe("claude-opus-5");
	});

	it("still applies an instantly-resolving catalog when the budget is exhausted", async () => {
		// Simulates a cached catalog: getLiveModelsCatalog resolves cached data
		// on a microtask, which beats the zero-delay degradation timer even
		// when the feed request consumed the whole window.
		const timeoutMs = 50;
		const slowFeed: typeof fetch = async () => {
			await new Promise((resolve) => setTimeout(resolve, timeoutMs));
			return new Response(JSON.stringify(ENDPOINT_PAYLOAD), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};

		const data = await fetchIndusCodeRecommendedModels({
			baseUrl: BASE_URL,
			fetchImpl: slowFeed,
			timeoutMs,
			catalogLoader: async () => CATALOG,
		});

		expect(data.recommended[0]?.name).toBe("Claude Opus 5");
	});

	it("returns the bundled fallback untouched when the endpoint fails", async () => {
		const data = await fetchIndusCodeRecommendedModels({
			baseUrl: BASE_URL,
			fetchImpl: async () => new Response("nope", { status: 500 }),
			catalogLoader: async () => CATALOG,
		});

		// Exact equality lets callers detect a transient failure (the VS Code
		// controller compares against the fallback to skip caching it).
		expect(data).toEqual(FALLBACK_INDUSCODE_RECOMMENDED_MODELS);
	});
});

describe("applyIndusCodeFeaturedModels", () => {
	const data: IndusCodeRecommendedModelsData = {
		recommended: [
			{
				id: "anthropic/claude-opus-5",
				name: "Claude Opus 5",
				description: "Most intelligent model",
				tags: ["NEW"],
			},
			// Vercel-style spelling; the catalog keys it as "z-ai/glm-5.2".
			{ id: "zai/glm-5.2", name: "GLM 5.2", description: "", tags: [] },
		],
		free: [
			{
				id: "deepseek/deepseek-v4-flash",
				name: "DeepSeek V4 Flash",
				description: "Fast and efficient",
				tags: [],
			},
		],
		induscodePass: [
			{
				id: "induscode-pass/kimi-k3",
				name: "Kimi K3",
				description: "Leading open weights model",
				tags: [],
			},
		],
	};

	it("stamps recommended and free tiers onto the induscode model list", () => {
		const models = applyIndusCodeFeaturedModels(
			"induscode",
			[
				{ id: "anthropic/claude-opus-5", name: "Claude Opus 5" },
				{ id: "z-ai/glm-5.2", name: "GLM 5.2" },
				{ id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash" },
				{ id: "vendor/unrelated", name: "Unrelated" },
			],
			data,
		);

		expect(models[0]?.featured).toEqual({
			tier: "recommended",
			rank: 0,
			tags: ["NEW"],
		});
		expect(models[0]?.description).toBe("Most intelligent model");
		// Alias spellings resolve through the Vercel/OpenRouter rules.
		expect(models[1]?.featured).toEqual({
			tier: "recommended",
			rank: 1,
			tags: [],
		});
		expect(models[2]?.featured).toEqual({ tier: "free", rank: 0, tags: [] });
		expect(models[3]?.featured).toBeUndefined();
	});

	it("stamps subscribed and free tiers for induscode-pass and skips other providers", () => {
		const models = applyIndusCodeFeaturedModels(
			"induscode-pass",
			[
				{ id: "induscode-pass/kimi-k3", name: "Kimi K3" },
				{ id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash" },
			],
			data,
		);
		expect(models[0]?.featured?.tier).toBe("subscribed");
		expect(models[1]?.featured?.tier).toBe("free");

		const untouched = [{ id: "claude-sonnet-4-6", name: "Claude Sonnet" }];
		expect(applyIndusCodeFeaturedModels("anthropic", untouched, data)).toBe(
			untouched,
		);
	});

	it("matches vendor-prefix mismatches by unambiguous slug without duplicating tiers", () => {
		const fallbackVintage: IndusCodeRecommendedModelsData = {
			recommended: [],
			free: [
				{
					id: "kwaipilot/kat-coder-pro",
					name: "KwaiKAT Kat Coder Pro",
					description: "Advanced agentic coding model",
					tags: ["FREE"],
				},
			],
			induscodePass: [],
		};

		// Catalog knows the model only under the induscode-free prefix: the slug
		// fallback stamps it even though no alias rule covers the prefix.
		const slugOnly = applyIndusCodeFeaturedModels(
			"induscode",
			[{ id: "induscode-free/kat-coder-pro", name: "Kat Coder Pro" }],
			fallbackVintage,
		);
		expect(slugOnly[0]?.featured?.tier).toBe("free");

		// Catalog carries BOTH spellings: the exact id wins and the slug match
		// must not stamp the second row, or the tier would render twice.
		const bothSpellings = applyIndusCodeFeaturedModels(
			"induscode",
			[
				{ id: "kwaipilot/kat-coder-pro", name: "Kat Coder Pro" },
				{ id: "induscode-free/kat-coder-pro", name: "Kat Coder Pro (free)" },
			],
			fallbackVintage,
		);
		expect(bothSpellings[0]?.featured?.tier).toBe("free");
		expect(bothSpellings[1]?.featured).toBeUndefined();

		// An ambiguous slug (two different feed entries) stamps nothing.
		const ambiguous = applyIndusCodeFeaturedModels(
			"induscode",
			[{ id: "induscode-free/shared-slug", name: "Shared" }],
			{
				recommended: [
					{ id: "vendor-a/shared-slug", name: "A", description: "", tags: [] },
					{ id: "vendor-b/shared-slug", name: "B", description: "", tags: [] },
				],
				free: [],
				induscodePass: [],
			},
		);
		expect(ambiguous[0]?.featured).toBeUndefined();
	});

	it("keeps the model's own description when the feed entry has none", () => {
		const models = applyIndusCodeFeaturedModels(
			"induscode",
			[
				{
					id: "z-ai/glm-5.2",
					name: "GLM 5.2",
					description: "Catalog description",
				},
			],
			data,
		);
		expect(models[0]?.description).toBe("Catalog description");
	});
});

describe("getCachedIndusCodeRecommendedModels", () => {
	it("serves one fetch to concurrent and subsequent callers", async () => {
		resetIndusCodeRecommendedModelsCacheForTests();
		let calls = 0;
		const fetchImpl: typeof fetch = async () => {
			calls += 1;
			return new Response(JSON.stringify(ENDPOINT_PAYLOAD), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		const options = {
			baseUrl: BASE_URL,
			fetchImpl,
			catalogLoader: async () => CATALOG,
		};

		const [first, second] = await Promise.all([
			getCachedIndusCodeRecommendedModels(options),
			getCachedIndusCodeRecommendedModels(options),
		]);
		const third = await getCachedIndusCodeRecommendedModels(options);

		expect(calls).toBe(1);
		expect(first.recommended.length).toBeGreaterThan(0);
		expect(second.recommended.length).toBe(first.recommended.length);
		expect(third.recommended.length).toBe(first.recommended.length);
		resetIndusCodeRecommendedModelsCacheForTests();
	});

	it("caches the bundled fallback so offline callers do not re-pay the timeout", async () => {
		resetIndusCodeRecommendedModelsCacheForTests();
		let calls = 0;
		const fetchImpl: typeof fetch = async () => {
			calls += 1;
			return new Response("nope", { status: 500 });
		};
		const options = {
			baseUrl: BASE_URL,
			fetchImpl,
			catalogLoader: async () => CATALOG,
		};

		const first = await getCachedIndusCodeRecommendedModels(options);
		const second = await getCachedIndusCodeRecommendedModels(options);

		expect(calls).toBe(1);
		expect(first).toEqual(FALLBACK_INDUSCODE_RECOMMENDED_MODELS);
		expect(second).toEqual(FALLBACK_INDUSCODE_RECOMMENDED_MODELS);
		resetIndusCodeRecommendedModelsCacheForTests();
	});

	it("does not let an in-flight request repopulate the cache after a reset", async () => {
		resetIndusCodeRecommendedModelsCacheForTests();
		let release: (() => void) | undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const staleFetch: typeof fetch = async () => {
			await gate;
			return new Response(JSON.stringify(ENDPOINT_PAYLOAD), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		const stale = getCachedIndusCodeRecommendedModels({
			baseUrl: BASE_URL,
			fetchImpl: staleFetch,
			catalogLoader: async () => CATALOG,
		});

		// Reset while the first request is still in flight, then resolve it:
		// its result must not land in the cleared cache.
		resetIndusCodeRecommendedModelsCacheForTests();
		release?.();
		await stale;

		let calls = 0;
		const freshFetch: typeof fetch = async () => {
			calls += 1;
			return new Response(JSON.stringify(ENDPOINT_PAYLOAD), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		await getCachedIndusCodeRecommendedModels({
			baseUrl: BASE_URL,
			fetchImpl: freshFetch,
			catalogLoader: async () => CATALOG,
		});
		expect(calls).toBe(1);
		resetIndusCodeRecommendedModelsCacheForTests();
	});
});

describe("peekIndusCodeRecommendedModels", () => {
	it("returns the bundled fallback when the cache is cold", () => {
		resetIndusCodeRecommendedModelsCacheForTests();
		expect(peekIndusCodeRecommendedModels()).toEqual(
			FALLBACK_INDUSCODE_RECOMMENDED_MODELS,
		);
	});

	it("returns the cached live feed once warmed, without another fetch", async () => {
		resetIndusCodeRecommendedModelsCacheForTests();
		let calls = 0;
		await getCachedIndusCodeRecommendedModels({
			baseUrl: BASE_URL,
			fetchImpl: async () => {
				calls += 1;
				return new Response(JSON.stringify(ENDPOINT_PAYLOAD), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
			catalogLoader: async () => CATALOG,
		});

		const peeked = peekIndusCodeRecommendedModels();

		expect(calls).toBe(1);
		expect(peeked.recommended.map((m) => m.id)).toEqual(
			ENDPOINT_PAYLOAD.recommended.map((m) => m.id),
		);
		resetIndusCodeRecommendedModelsCacheForTests();
	});
});

describe("generated offline featured models", () => {
	it("preserves every generated tier and its authored order without loading a live catalog", async () => {
		let catalogLoaded = false;
		const data = await fetchIndusCodeRecommendedModels({
			baseUrl: BASE_URL,
			fetchImpl: async () => {
				throw new Error("offline");
			},
			catalogLoader: async () => {
				catalogLoaded = true;
				return {};
			},
		});
		for (const tier of ["recommended", "free", "induscodePass"] as const) {
			const generated = GENERATED_INDUSCODE_RECOMMENDED_MODELS[tier] ?? [];
			expect(generated.length).toBeGreaterThan(0);
			expect(data[tier].map((entry) => entry.id)).toEqual(
				generated.map((entry) => entry.id),
			);
			expect(data[tier].map((entry) => entry.tags)).toEqual(
				generated.map((entry) => entry.tags ?? []),
			);
		}
		expect(catalogLoaded).toBe(false);
		const catalog = getGeneratedProviderModels();
		const recommended = data.recommended.find(
			(entry) => catalog.openrouter?.[entry.id]?.name,
		);
		expect(recommended).toBeDefined();
		expect(recommended?.name).toBe(catalog.openrouter[recommended!.id].name);
		for (const providerId of ["induscode", "induscode-pass"]) {
			const featured = applyIndusCodeFeaturedModels(
				providerId,
				Object.values(
					providerId === "induscode"
						? { ...catalog.openrouter, ...catalog.induscode }
						: catalog["induscode-pass"],
				).map((entry) => ({ id: entry.id, name: entry.name ?? entry.id })),
				data,
			);
			const tiers =
				providerId === "induscode"
					? [
							{ tier: "recommended", entries: data.recommended },
							{ tier: "free", entries: data.free },
						]
					: [
							{ tier: "subscribed", entries: data.induscodePass },
							{ tier: "free", entries: data.free },
						];
			for (const { tier, entries } of tiers) {
				const stamped = featured
					.filter((entry) => entry.featured?.tier === tier)
					.sort((a, b) => a.featured!.rank - b.featured!.rank);
				// The feed can spell a vendor differently from the catalog
				// ("spacexai/grok-4.7" vs OpenRouter's "x-ai/grok-4.7"); the matcher
				// then stamps the catalog's id via its slug fallback, so compare
				// models by slug rather than verbatim id.
				expect(
					stamped.map((entry) => ({
						slug: idSlug(entry.id),
						description: entry.description ?? "",
						featured: entry.featured,
					})),
				).toEqual(
					entries.map((entry, rank) => ({
						slug: idSlug(entry.id),
						description: entry.description.trim(),
						featured: { tier, rank, tags: entry.tags },
					})),
				);
			}
		}
	});
});
