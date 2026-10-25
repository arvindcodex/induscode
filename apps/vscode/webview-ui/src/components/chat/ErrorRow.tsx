import type { IndusCodeMessage } from "@shared/ExtensionMessage"
import { memo } from "react"
import { IndusCodeAuthStatus } from "@/components/account/IndusCodeAuthStatus"
import IndusCodeFreeModelLimitError from "@/components/chat/IndusCodeFreeModelLimitError"
import IndusCodeFreePromotionEndedError from "@/components/chat/IndusCodeFreePromotionEndedError"
import IndusCodePassLimitError from "@/components/chat/IndusCodePassLimitError"
import CreditLimitError from "@/components/chat/CreditLimitError"
import EntitlementError from "@/components/chat/EntitlementError"
import OrgIndusCodePassRestrictionError from "@/components/chat/OrgIndusCodePassRestrictionError"
import SpendLimitError from "@/components/chat/SpendLimitError"
import { Button } from "@/components/ui/button"
import { useIndusCodeAuth, useIndusCodeSignIn } from "@/context/IndusCodeAuthContext"
import { IndusCodeError, IndusCodeErrorType, MODEL_NOT_FOUND_GUIDANCE } from "../../../../src/services/error/IndusCodeError"

const _errorColor = "var(--vscode-errorForeground)"

interface ErrorRowProps {
	message: IndusCodeMessage
	errorType: "error" | "mistake_limit_reached" | "diff_error" | "induscodeignore_error"
	apiRequestFailedMessage?: string
	apiReqStreamingFailedMessage?: string
	retryFailedRequest?: () => Promise<boolean>
}

const ErrorRow = memo((props: ErrorRowProps) => {
	const { message, errorType, apiRequestFailedMessage, apiReqStreamingFailedMessage, retryFailedRequest } = props
	const { induscodeUser } = useIndusCodeAuth()
	const rawApiError = apiRequestFailedMessage || apiReqStreamingFailedMessage

	const { isLoginLoading, authStatusMessage, handleSignIn } = useIndusCodeSignIn()

	const renderErrorContent = () => {
		switch (errorType) {
			case "error":
			case "mistake_limit_reached":
				// Handle API request errors with special error parsing
				if (rawApiError) {
					// FIXME: IndusCodeError parsing should not be applied to non-IndusCode providers, but it seems we're using induscodeErrorMessage below in the default error display
					const induscodeError = IndusCodeError.parse(rawApiError)
					const errorMessage = induscodeError?._error?.message || induscodeError?.message || rawApiError
					const requestId = induscodeError?._error?.request_id
					const providerId = induscodeError?.providerId || induscodeError?._error?.providerId
					// Deliberately narrower than the shared isIndusCodeManagedProvider (which
					// also matches induscode-pass): only usage-billing errors get the credit
					// and login prompts below.
					const isIndusCodeUsageBillingProvider = providerId === "induscode"
					const errorCode = induscodeError?._error?.code

					if (induscodeError?.isErrorType(IndusCodeErrorType.Balance)) {
						const errorDetails = induscodeError._error?.details
						if (isIndusCodeUsageBillingProvider || errorDetails?.buy_credits_url) {
							return (
								<CreditLimitError
									buyCreditsUrl={errorDetails?.buy_credits_url}
									currentBalance={errorDetails?.current_balance}
									message={errorDetails?.message}
									retryFailedRequest={retryFailedRequest}
									totalPromotions={errorDetails?.total_promotions}
									totalSpent={errorDetails?.total_spent}
								/>
							)
						}
					}

					if (induscodeError?.isErrorType(IndusCodeErrorType.SpendLimit)) {
						const d = induscodeError._error?.details
						return (
							<SpendLimitError
								budgetPeriod={d?.budget_period}
								limitUsd={d?.limit_usd}
								message={d?.message || errorMessage}
								resetsAt={d?.resets_at}
								spentUsd={d?.spent_usd}
							/>
						)
					}

					if (induscodeError?.isErrorType(IndusCodeErrorType.Entitlement)) {
						const detailMessage = induscodeError?._error?.details?.message || errorMessage
						return <EntitlementError message={detailMessage} retryFailedRequest={retryFailedRequest} />
					}

					if (induscodeError?.isErrorType(IndusCodeErrorType.OrgIndusCodePassRestriction)) {
						return <OrgIndusCodePassRestrictionError />
					}

					if (induscodeError?.isErrorType(IndusCodeErrorType.IndusCodePassLimit)) {
						const detailMessage = induscodeError?._error?.details?.message || errorMessage
						return <IndusCodePassLimitError message={detailMessage} />
					}

					if (induscodeError?.isErrorType(IndusCodeErrorType.IndusCodeFreeModelLimit)) {
						const detailMessage = induscodeError?._error?.details?.message || errorMessage
						return <IndusCodeFreeModelLimitError message={detailMessage} />
					}

					// A retired free model answers model-not-found once its promotion
					// ends — dedicated copy plus a route into the model picker,
					// since retrying the deleted model can never succeed.
					if (induscodeError?.isErrorType(IndusCodeErrorType.IndusCodeFreePromotionEnded)) {
						return <IndusCodeFreePromotionEndedError />
					}

					if (induscodeError?.isErrorType(IndusCodeErrorType.RateLimit)) {
						return (
							<p className="m-0 whitespace-pre-wrap text-error wrap-anywhere">
								{errorMessage}
								{requestId && <div>Request ID: {requestId}</div>}
							</p>
						)
					}

					if (induscodeError?.isErrorType(IndusCodeErrorType.QuotaExceeded)) {
						const detailMessage = induscodeError?._error?.details?.message || errorMessage
						return <p className="m-0 whitespace-pre-wrap text-error wrap-anywhere">{detailMessage}</p>
					}

					// A 404/405/410 is the server saying the model id or endpoint
					// path does not exist. The host already appends this guidance
					// when it can recognise the message text; add it here only
					// when the status alone carried the verdict.
					const notFoundGuidance =
						induscodeError?.isErrorType(IndusCodeErrorType.NotFound) && !errorMessage.includes(MODEL_NOT_FOUND_GUIDANCE)
							? `The model or endpoint was not found. ${MODEL_NOT_FOUND_GUIDANCE}`
							: undefined

					if (induscodeError?.isErrorType(IndusCodeErrorType.Auth) && isIndusCodeUsageBillingProvider) {
						return !induscodeUser ? (
							// User is using IndusCode provider and is not logged in
							<div className="flex flex-col gap-3">
								<div className="flex items-center justify-center rounded border border-neutral-500/30 bg-vscode-editor-background p-6 text-center text-vscode-foreground">
									Whoops looks like you're logged out – click below to sign in
								</div>
								<Button className="w-full" disabled={isLoginLoading} onClick={handleSignIn}>
									Sign in to IndusCode
									{isLoginLoading && (
										<span className="ml-1 animate-spin">
											<span className="codicon codicon-refresh" />
										</span>
									)}
								</Button>
								<IndusCodeAuthStatus message={authStatusMessage} />
							</div>
						) : (
							// Don't show sign in button after the user has logged in, just ask them to retry
							<div className="mt-4">
								<span className="text-description">(Click "Retry" below)</span>
							</div>
						)
					}

					return (
						<p className="m-0 whitespace-pre-wrap text-error wrap-anywhere flex flex-col gap-3">
							{/* Display the well-formatted error extracted from the IndusCodeError instance */}

							<header>
								{providerId && <span className="uppercase">[{providerId}] </span>}
								{errorCode && <span>{errorCode}</span>}
								{errorMessage}
								{requestId && <div>Request ID: {requestId}</div>}
							</header>

							{notFoundGuidance && <div>{notFoundGuidance}</div>}

							{/* Windows Powershell Issue */}
							{errorMessage?.toLowerCase()?.includes("powershell") && (
								<div>
									It seems like you're having Windows PowerShell issues, please see this{" "}
									<a
										className="underline text-inherit"
										href="https://github.com/induscode/induscode/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22">
										troubleshooting guide
									</a>
									.
								</div>
							)}

							{/* Display raw API error if different from parsed error message */}
							{errorMessage !== rawApiError && <div>{rawApiError}</div>}
						</p>
					)
				}

				// Regular error message
				return <p className="m-0 mt-0 whitespace-pre-wrap text-error wrap-anywhere">{message.text}</p>

			case "diff_error":
				return (
					<div className="flex flex-col p-2 rounded text-xs opacity-80 bg-quote text-foreground">
						<div>The model used search patterns that don't match anything in the file. Retrying...</div>
					</div>
				)

			case "induscodeignore_error":
				return (
					<div className="flex flex-col p-2 rounded text-xs opacity-80 bg-quote text-foreground">
						<div>
							IndusCode tried to access <code>{message.text}</code> which is blocked by the <code>.induscodeignore</code>
							file.
						</div>
					</div>
				)

			default:
				return null
		}
	}

	// For diff_error and induscodeignore_error, we don't show the header separately
	if (errorType === "diff_error" || errorType === "induscodeignore_error") {
		return renderErrorContent()
	}

	// For other error types, show header + content
	return renderErrorContent()
})

export default ErrorRow
