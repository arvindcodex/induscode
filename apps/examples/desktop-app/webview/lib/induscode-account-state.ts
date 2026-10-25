// Shared between the sidecar (which produces this result) and the webview
// (which consumes it), like the desktop transport types.

/**
 * Typed result the `induscode_account` sidecar command returns when no IndusCode
 * account credentials exist. Being signed out is an expected state, so it
 * travels as a structured response instead of a thrown error: it must not be
 * reported to error telemetry or rendered as a raw error string.
 */
export const INDUSCODE_ACCOUNT_NOT_AUTHENTICATED_CODE =
	"ACCOUNT_NOT_AUTHENTICATED" as const;

export type IndusCodeAccountNotAuthenticatedResult = {
	signedIn: false;
	code: typeof INDUSCODE_ACCOUNT_NOT_AUTHENTICATED_CODE;
};

export const INDUSCODE_ACCOUNT_NOT_AUTHENTICATED_RESULT: IndusCodeAccountNotAuthenticatedResult =
	{
		signedIn: false,
		code: INDUSCODE_ACCOUNT_NOT_AUTHENTICATED_CODE,
	};

export function isIndusCodeAccountNotAuthenticatedResult(
	value: unknown,
): value is IndusCodeAccountNotAuthenticatedResult {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as IndusCodeAccountNotAuthenticatedResult).code ===
			INDUSCODE_ACCOUNT_NOT_AUTHENTICATED_CODE &&
		(value as IndusCodeAccountNotAuthenticatedResult).signedIn === false
	);
}
