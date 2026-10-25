import {
	type IndusCodeClientIdentity,
	getIndusCodeClientIdentity,
} from "@induscode/shared";
import { DEFAULT_INDUSCODE_REQUEST_HEADERS } from "./request-headers";

function trimNonEmpty(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function buildIndusCodeClientHeaders(
	identity: IndusCodeClientIdentity | undefined = getIndusCodeClientIdentity(),
): Record<string, string> {
	const clientType =
		trimNonEmpty(identity?.name) ??
		DEFAULT_INDUSCODE_REQUEST_HEADERS["X-CLIENT-TYPE"];
	const clientVersion = trimNonEmpty(identity?.version) ?? "unknown";
	return {
		...DEFAULT_INDUSCODE_REQUEST_HEADERS,
		"User-Agent": `IndusCode/${clientVersion}`,
		"X-CLIENT-TYPE": clientType,
		"X-CLIENT-VERSION": clientVersion,
		"X-PLATFORM": trimNonEmpty(identity?.platform) ?? clientType,
		"X-PLATFORM-VERSION":
			trimNonEmpty(identity?.platformVersion) ?? clientVersion,
	};
}
