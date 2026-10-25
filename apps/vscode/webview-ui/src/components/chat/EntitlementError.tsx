import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import React from "react"
import VSCodeButtonLink from "@/components/common/VSCodeButtonLink"
import { useIndusCodeAuth } from "@/context/IndusCodeAuthContext"

interface EntitlementErrorProps {
	message?: string
	retryFailedRequest?: () => Promise<boolean>
}

// Relative (no leading slash) so it appends to path-prefixed app URLs (e.g. self-hosted/proxy) instead of resetting to origin.
const INDUSCODE_PASS_SUBSCRIBE_PATH = "dashboard/subscription"

const HEADLINE = "This model requires a IndusCodePass subscription."

function buildSubscribeUrl(appBaseUrl?: string): string | undefined {
	if (!appBaseUrl) {
		return undefined
	}
	try {
		const base = appBaseUrl.endsWith("/") ? appBaseUrl : `${appBaseUrl}/`
		const url = new URL(INDUSCODE_PASS_SUBSCRIBE_PATH, base)
		url.searchParams.set("personal", "true")
		return url.toString()
	} catch {
		// Malformed appBaseUrl: omit the link rather than crashing the error card.
		return undefined
	}
}

const EntitlementError: React.FC<EntitlementErrorProps> = ({ message, retryFailedRequest }) => {
	const { induscodeUser } = useIndusCodeAuth()
	const subscribeUrl = buildSubscribeUrl(induscodeUser?.appBaseUrl)
	const backendDetail = message && message !== HEADLINE ? message : undefined

	return (
		<div className="p-2 border-none rounded-md mb-2 bg-(--vscode-textBlockQuote-background)">
			<div className="mb-3">
				<div className="text-error mb-2">{HEADLINE}</div>
				<div className="text-(--vscode-descriptionForeground) text-xs">
					Subscribe to IndusCodePass to use this model, then retry your request.
				</div>
				{backendDetail && (
					<div className="text-(--vscode-descriptionForeground) text-xs mt-1 opacity-80 wrap-anywhere">
						{backendDetail}
					</div>
				)}
			</div>

			{subscribeUrl && (
				<VSCodeButtonLink className="w-full mb-2" href={subscribeUrl}>
					<span className="codicon codicon-rocket mr-[6px] text-[14px]" />
					Get IndusCodePass
				</VSCodeButtonLink>
			)}

			<VSCodeButton
				appearance="secondary"
				className="w-full"
				disabled={!retryFailedRequest}
				onClick={async () => {
					try {
						await retryFailedRequest?.()
					} catch (error) {
						console.error("Error invoking action:", error)
					}
				}}>
				<span className="codicon codicon-refresh mr-1.5" />
				Retry Request
			</VSCodeButton>
		</div>
	)
}

export default EntitlementError
