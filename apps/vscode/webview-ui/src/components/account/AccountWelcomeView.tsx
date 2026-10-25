import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { IndusCodeAuthStatus } from "@/components/account/IndusCodeAuthStatus"
import { useIndusCodeSignIn } from "@/context/IndusCodeAuthContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import IndusCodeLogoVariable from "../../assets/IndusCodeLogoVariable"
import { IndusCodePassWelcomeCallout } from "./IndusCodePassCard"

// export const AccountWelcomeView = () => (
// 	<div className="flex flex-col items-center pr-3 gap-2.5">
// 		<IndusCodeLogoWhite className="size-16 mb-4" />
export const AccountWelcomeView = () => {
	const { environment } = useExtensionState()
	const { isLoginLoading, authStatusMessage, handleSignIn } = useIndusCodeSignIn()

	return (
		<div className="flex flex-col items-center gap-2.5">
			<IndusCodeLogoVariable className="size-16 mb-4" environment={environment} />

			<p>
				Sign up for an account to get access to the latest models, billing dashboard to view usage and credits, and more
				upcoming features.
			</p>

			<IndusCodePassWelcomeCallout />

			<VSCodeButton className="w-full mb-4" disabled={isLoginLoading} onClick={handleSignIn}>
				Sign up with IndusCode
				{isLoginLoading && (
					<span className="ml-1 animate-spin">
						<span className="codicon codicon-refresh" />
					</span>
				)}
			</VSCodeButton>

			<IndusCodeAuthStatus message={authStatusMessage} />

			<p className="text-(--vscode-descriptionForeground) text-xs text-center m-0">
				By continuing, you agree to the <VSCodeLink href="https://induscode.bot/tos">Terms of Service</VSCodeLink> and{" "}
				<VSCodeLink href="https://induscode.bot/privacy">Privacy Policy.</VSCodeLink>
			</p>
		</div>
	)
}
