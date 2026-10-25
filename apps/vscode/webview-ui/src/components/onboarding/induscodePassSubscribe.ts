import { StringRequest } from "@shared/proto/induscode/common"
import { UiServiceClient } from "@/services/grpc-client"

// IndusCodePass subscription signup page in the dashboard (requires auth).
const INDUSCODE_PASS_SUBSCRIBE_PATH = "/onboarding/individual-plan"
const INDUSCODE_PASS_USAGE_PATH = "/dashboard/subscription"
export const DEFAULT_APP_BASE_URL = "https://app.induscode.bot"

// Module-level so the pending intent survives OnboardingView unmounting: handleAuthCallback
// completes the welcome view (unmounting onboarding) before it pushes the auth-status update
// that sets induscodeUser, so this must outlive the component to fire the redirect.
let pendingIndusCodePassSubscribe = false

export function setPendingIndusCodePassSubscribe(pending: boolean): void {
	pendingIndusCodePassSubscribe = pending
}

// Appends a dashboard path to the app base URL, preserving any path prefix in
// the base (new URL(path, base) would drop it for leading-slash paths).
function joinAppBaseUrl(appBaseUrl: string | undefined, path: string): string {
	const baseUrl = appBaseUrl || DEFAULT_APP_BASE_URL
	return `${baseUrl.replace(/\/+$/, "")}${path}`
}

// Opens the IndusCodePass subscription page once a pending signup is authenticated (guarded so it fires once).
export function openIndusCodePassSubscriptionIfPending(appBaseUrl: string | undefined): void {
	if (!pendingIndusCodePassSubscribe) {
		return
	}
	pendingIndusCodePassSubscribe = false
	UiServiceClient.openUrl(StringRequest.create({ value: joinAppBaseUrl(appBaseUrl, INDUSCODE_PASS_SUBSCRIBE_PATH) })).catch((err) =>
		console.error("Failed to open IndusCodePass subscription page:", err),
	)
}

export function buildIndusCodePassSubscriptionPageUrl(appBaseUrl: string | undefined): string {
	// IndusCodePass always bills the personal account, so force the personal
	// dashboard context for org-context users (matches EntitlementError and
	// the CLI's subscription links).
	return `${joinAppBaseUrl(appBaseUrl, INDUSCODE_PASS_USAGE_PATH)}?personal=true`
}

// Signup/subscribe page for users who don't have a IndusCodePass subscription yet.
export function buildIndusCodePassSubscribeUrl(appBaseUrl: string | undefined): string {
	return joinAppBaseUrl(appBaseUrl, INDUSCODE_PASS_SUBSCRIBE_PATH)
}
