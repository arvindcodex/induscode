import { isIndusCodeAccountNotAuthenticatedResult } from "@/lib/induscode-account-state";
import type {
	IndusCodeGitHubRepository,
	IndusCodeIntegration,
} from "@/lib/induscode-integrations-types";
import { desktopClient, openExternalUrl } from "@/lib/desktop-client";

export * from "@/lib/induscode-integrations-types";

export type IndusCodeIntegrationsListResult =
	| { status: "ok"; integrations: IndusCodeIntegration[] }
	| { status: "not-authenticated" };

export async function listIndusCodeIntegrations(): Promise<IndusCodeIntegrationsListResult> {
	const result = await desktopClient.invoke("induscode_integrations", {
		operation: "list",
	});
	if (isIndusCodeAccountNotAuthenticatedResult(result)) {
		return { status: "not-authenticated" };
	}
	return {
		status: "ok",
		integrations: Array.isArray(result) ? (result as IndusCodeIntegration[]) : [],
	};
}

export async function listIndusCodeGitHubRepositories(): Promise<
	IndusCodeGitHubRepository[]
> {
	const result = await desktopClient.invoke("induscode_integrations", {
		operation: "listGitHubRepositories",
	});
	return Array.isArray(result) ? (result as IndusCodeGitHubRepository[]) : [];
}

export async function fetchGitHubInstallUrl(): Promise<string> {
	const result = await desktopClient.invoke("induscode_integrations", {
		operation: "githubInstallUrl",
	});
	if (isIndusCodeAccountNotAuthenticatedResult(result)) {
		throw new Error("sign in to your IndusCode account first");
	}
	const url = (result as { url?: unknown } | null)?.url;
	if (typeof url !== "string" || !url.trim()) {
		throw new Error("no GitHub install URL was returned");
	}
	return url;
}

export async function openPersonalGitHubInstallUrl(
	fallbackUrl: string,
): Promise<void> {
	let url = fallbackUrl;
	try {
		url = await fetchGitHubInstallUrl();
	} catch {}
	await openExternalUrl(url);
}
