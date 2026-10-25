import { StringRequest } from "@shared/proto/induscode/common"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState } from "react"
import { IndusCodeAuthStatus } from "@/components/account/IndusCodeAuthStatus"
import { useIndusCodeAuth, useIndusCodeSignIn } from "@/context/IndusCodeAuthContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { UiServiceClient } from "@/services/grpc-client"

export const IndusCodeAccountInfoCard = ({ usageLink }: { usageLink?: string }) => {
	const { induscodeUser } = useIndusCodeAuth()
	const { navigateToAccount } = useExtensionState()
	const { isLoginLoading, authStatusMessage, handleSignIn } = useIndusCodeSignIn()
	const [didStartLogin, setDidStartLogin] = useState(false)

	const user = induscodeUser || undefined

	const handleLogin = () => {
		setDidStartLogin(true)
		handleSignIn()
	}

	useEffect(() => {
		if (didStartLogin && user) {
			navigateToAccount()
		}
	}, [didStartLogin, navigateToAccount, user])

	const handleShowAccount = () => {
		if (!usageLink) {
			return navigateToAccount()
		}

		UiServiceClient.openUrl(StringRequest.create({ value: usageLink })).catch((err) => {
			console.error("Failed to open usage link:", err)
		})
	}

	return (
		<div className="max-w-[600px]">
			{user ? (
				<VSCodeButton appearance="secondary" onClick={handleShowAccount}>
					View Billing & Usage
				</VSCodeButton>
			) : (
				<div className="flex flex-col gap-3">
					<VSCodeButton className="mt-0" disabled={isLoginLoading} onClick={handleLogin}>
						Sign Up with IndusCode
						{isLoginLoading && (
							<span className="ml-1 animate-spin">
								<span className="codicon codicon-refresh" />
							</span>
						)}
					</VSCodeButton>
					<IndusCodeAuthStatus message={authStatusMessage} />
				</div>
			)}
		</div>
	)
}
