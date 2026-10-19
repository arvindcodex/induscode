/**
 * Fallback default model for the Cline provider. The `cline` provider manifest
 * in `@cline/llms` prefers the first entry of the Cline recommended-models list
 * and falls back to this id when that list is empty.
 */
export const CLINE_DEFAULT_MODEL_ID = "free/deepseek-v4.1-flash";
