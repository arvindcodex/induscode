import { buildIndusCodeSystemPrompt } from "@induscode/shared";
import type { DelegatedAgentRuntimeConfig } from "./delegated-agent";

export function buildTeammateSystemPrompt(
	prompt: string,
	config: DelegatedAgentRuntimeConfig,
): string {
	const trimmedPrompt = prompt.trim();
	if (config.providerId.toLowerCase() !== "induscode") {
		return trimmedPrompt;
	}

	return buildIndusCodeSystemPrompt({
		ide: config.induscodeIdeName?.trim() || "Terminal",
		workspaceRoot: config.cwd?.trim() || "/",
		providerId: config.providerId,
		rules: `# Team Teammate Role\n${trimmedPrompt}`,
		platform: config.induscodePlatform,
		metadata: config.workspaceMetadata,
	});
}

export function buildSubAgentSystemPrompt(
	// The prompt provided when spawning the subagent
	prompt: string,
	config: DelegatedAgentRuntimeConfig,
): string {
	const trimmedPrompt = prompt.trim();
	if (config.providerId.toLowerCase() !== "induscode") {
		return trimmedPrompt;
	}

	return buildIndusCodeSystemPrompt({
		ide: config.induscodeIdeName || "Terminal",
		workspaceRoot: config.cwd?.trim() || "/",
		providerId: config.providerId,
		overridePrompt: trimmedPrompt,
		metadata: config.workspaceMetadata,
		platform: config.induscodePlatform,
	});
}
