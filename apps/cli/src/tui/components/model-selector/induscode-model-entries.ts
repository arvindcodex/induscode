import type {
	IndusCodeRecommendedModel,
	IndusCodeRecommendedModelsData,
} from "@induscode/core";

export type IndusCodeModelPickerTier = "recommended" | "subscribed" | "free";

export interface IndusCodeModelPickerItem {
	kind: "model";
	model: IndusCodeRecommendedModel;
	tier: IndusCodeModelPickerTier;
}

export interface IndusCodeModelPickerBrowse {
	kind: "browse";
}

export type IndusCodeModelPickerEntry =
	| IndusCodeModelPickerItem
	| IndusCodeModelPickerBrowse;

export const INDUSCODE_MODEL_PICKER_TIER_LABELS: Record<
	IndusCodeModelPickerTier,
	string
> = {
	recommended: "Recommended",
	subscribed: "Subscribed",
	free: "Free",
};

// Featured entries for the sectioned picker, keyed by provider: induscode gets
// Recommended/Free with a browse-all escape into the full catalog; induscode-pass
// gets Subscribed/Free (see buildIndusCodePassModelEntries for why no browse-all).
export function buildFeaturedModelEntries(
	providerId: string,
	data: IndusCodeRecommendedModelsData,
): IndusCodeModelPickerEntry[] {
	return providerId === "induscode-pass"
		? buildIndusCodePassModelEntries(data)
		: buildIndusCodeModelEntries(data);
}

function buildIndusCodeModelEntries(
	data: IndusCodeRecommendedModelsData,
): IndusCodeModelPickerEntry[] {
	const entries: IndusCodeModelPickerEntry[] = [];
	for (const m of data.recommended) {
		entries.push({ kind: "model", model: m, tier: "recommended" });
	}
	for (const m of data.free) {
		entries.push({ kind: "model", model: m, tier: "free" });
	}
	entries.push({ kind: "browse" });
	return entries;
}

// Shown under the Free section header when picking a model for IndusCodePass
export const INDUSCODE_PASS_FREE_SECTION_DESCRIPTION =
	"Try with limited usage, separate from IndusCodePass quota.";

// IndusCodePass shows the subscription's models plus the IndusCode free models — both
// providers hit the same IndusCode API, so free models are selectable in place
// (they ride usage billing at $0 instead of the subscription quota).
// No "browse all" entry when the induscodePass bucket is populated: unlike induscode,
// the IndusCodePass catalog contains exactly these two buckets, so the sections
// already list every selectable model. An empty induscodePass bucket means the
// fetch fell back to the bundled list (which has no pass models) — without an
// escape into the full catalog a subscriber could only pick free models, so
// browse-all comes back in that degraded mode.
function buildIndusCodePassModelEntries(
	data: IndusCodeRecommendedModelsData,
): IndusCodeModelPickerEntry[] {
	const entries: IndusCodeModelPickerEntry[] = [];
	for (const m of data.induscodePass) {
		entries.push({ kind: "model", model: m, tier: "subscribed" });
	}
	for (const m of data.free) {
		entries.push({ kind: "model", model: m, tier: "free" });
	}
	if (data.induscodePass.length === 0) {
		entries.push({ kind: "browse" });
	}
	return entries;
}

// The quota explainer only makes sense in the IndusCodePass picker, which is the
// only picker that has a "subscribed" section
export function freeTierDescriptionFor(
	entries: IndusCodeModelPickerEntry[],
): string | undefined {
	const isIndusCodePassPicker = entries.some(
		(entry) => entry.kind === "model" && entry.tier === "subscribed",
	);
	return isIndusCodePassPicker ? INDUSCODE_PASS_FREE_SECTION_DESCRIPTION : undefined;
}
