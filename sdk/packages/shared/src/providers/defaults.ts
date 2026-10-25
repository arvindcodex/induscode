/**
 * Fallback default model for the IndusCode provider. The `induscode` provider manifest
 * in `@induscode/llms` prefers the first entry of the IndusCode recommended-models list
 * and falls back to this id when that list is empty.
 */
export const INDUSCODE_DEFAULT_MODEL_ID = "free/deepseek-v4.1-flash";
