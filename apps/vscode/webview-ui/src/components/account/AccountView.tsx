import type { UsageTransaction as IndusCodeAccountUsageTransaction, PaymentTransaction } from "@shared/IndusCodeAccount"
import { isIndusCodeInternalTester } from "@shared/internal/account"
import type { UserOrganization } from "@shared/proto/induscode/account"
import { EmptyRequest } from "@shared/proto/induscode/common"
import { VSCodeButton, VSCodeDivider, VSCodeDropdown, VSCodeOption, VSCodeTag } from "@vscode/webview-ui-toolkit/react"
import { LoaderCircleIcon } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useInterval } from "react-use"
import { CloudGitHubCard } from "@/components/cloud/CloudGitHubCard"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { type IndusCodeUser, handleSignOut, useIndusCodeAuth } from "@/context/IndusCodeAuthContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { AccountServiceClient } from "@/services/grpc-client"
import ViewHeader from "../common/ViewHeader"
import VSCodeButtonLink from "../common/VSCodeButtonLink"
import { updateSetting } from "../settings/utils/settingsHandlers"
import { AccountWelcomeView } from "./AccountWelcomeView"
import { IndusCodePassCard } from "./IndusCodePassCard"
import { CreditBalance } from "./CreditBalance"
import CreditsHistoryTable from "./CreditsHistoryTable"
import { convertProtoUsageTransactions, getIndusCodeUris, getMainRole } from "./helpers"
import { RemoteConfigToggle } from "./RemoteConfigToggle"

type AccountViewProps = {
	induscodeUser: IndusCodeUser | null
	organizations: UserOrganization[] | null
	activeOrganization: UserOrganization | null
	onDone: () => void
}

type IndusCodeAccountViewProps = {
	induscodeUser: IndusCodeUser
	userOrganizations: UserOrganization[] | null
	activeOrganization: UserOrganization | null
	induscodeEnv: "Production" | "Staging" | "Local"
}

type CachedData = {
	balance: number | null
	usageData: IndusCodeAccountUsageTransaction[]
	paymentsData: PaymentTransaction[]
	lastFetchTime: number
}

const IndusCodeEnvOptions = ["Production", "Staging", "Local"] as const

const AccountView = ({ onDone, induscodeUser, organizations, activeOrganization }: AccountViewProps) => {
	const { environment } = useExtensionState()

	return (
		<div className="fixed inset-0 flex flex-col overflow-hidden">
			<ViewHeader environment={environment} onDone={onDone} showEnvironmentSuffix title="Account" />
			<div className="grow flex flex-col px-5 overflow-y-auto">
				{induscodeUser?.uid ? (
					<IndusCodeAccountView
						activeOrganization={activeOrganization}
						induscodeEnv={environment === "local" ? "Local" : environment === "staging" ? "Staging" : "Production"}
						induscodeUser={induscodeUser}
						key={induscodeUser.uid}
						userOrganizations={organizations}
					/>
				) : (
					<AccountWelcomeView />
				)}
			</div>
		</div>
	)
}

const IndusCodeAccountView = ({ induscodeUser, userOrganizations, activeOrganization, induscodeEnv }: IndusCodeAccountViewProps) => {
	const { email, displayName, appBaseUrl, uid } = induscodeUser
	const { remoteConfigSettings, environment, cloudSessionsEnabled } = useExtensionState()

	// Determine if dropdown should be locked by remote config
	const isLockedByRemoteConfig = Object.keys(remoteConfigSettings || {}).length > 0

	const { accountSwitch, accountSwitchError, switchOrganization } = useIndusCodeAuth()
	const dropdownValue = activeOrganization?.organizationId || uid
	const [isLoading, setIsLoading] = useState(false)

	const [creditData, setCreditData] = useState<CachedData & { accountId: string }>()
	const creditRequest = useRef<object | null>(null)
	const activeAccount = useRef(dropdownValue)
	activeAccount.current = dropdownValue
	const isIndusCodeTester = useMemo(() => (email ? isIndusCodeInternalTester(email) : false), [email])
	const induscodeUrl = appBaseUrl || "https://app.induscode.bot"

	const fetchCreditBalance = useCallback(
		async (accountId: string) => {
			const request = {}
			creditRequest.current = request
			setIsLoading(true)
			try {
				const response =
					accountId === uid
						? await AccountServiceClient.getUserCredits(EmptyRequest.create())
						: await AccountServiceClient.getOrganizationCredits({ organizationId: accountId })
				if (creditRequest.current !== request || activeAccount.current !== accountId) return
				setCreditData({
					accountId,
					balance: response.balance?.currentBalance ?? null,
					usageData: convertProtoUsageTransactions(response.usageTransactions),
					paymentsData: "paymentTransactions" in response ? response.paymentTransactions : [],
					lastFetchTime: Date.now(),
				})
			} catch (error) {
				console.error("Failed to fetch credit balance:", error)
			} finally {
				if (creditRequest.current === request) setIsLoading(false)
			}
		},
		[uid],
	)

	useEffect(() => {
		if (!accountSwitch) void fetchCreditBalance(dropdownValue)
		return () => {
			creditRequest.current = null
		}
	}, [dropdownValue, accountSwitch, fetchCreditBalance])
	useInterval(() => {
		if (!accountSwitch) void fetchCreditBalance(dropdownValue)
	}, 60_000)

	const displayedCredit = !accountSwitch && creditData?.accountId === dropdownValue ? creditData : undefined
	const balance = displayedCredit?.balance ?? null
	const usageData = displayedCredit?.usageData ?? []
	const paymentsData = displayedCredit?.paymentsData ?? []
	const lastFetchTime = displayedCredit?.lastFetchTime ?? 0

	const handleOrganizationChange = (event: { target: EventTarget | null }) => {
		const newValue = (event.target as HTMLSelectElement | null)?.value
		if (newValue && newValue !== dropdownValue && !accountSwitch) {
			void switchOrganization(newValue === uid ? undefined : newValue)
		}
	}

	return (
		<div className="h-full flex flex-col">
			<div className="flex flex-col h-full">
				<div className="flex flex-col w-full gap-1 mb-6">
					<div className="flex items-center flex-wrap gap-y-4">
						{/* {user.photoUrl ? (
								<img src={user.photoUrl} alt="Profile" className="size-16 rounded-full mr-4" />
							) : ( */}
						<div className="size-16 rounded-full bg-button-background flex items-center justify-center text-2xl text-button-foreground mr-4">
							{displayName?.[0] || email?.[0] || "?"}
						</div>
						{/* )} */}

						<div className="flex flex-col">
							{displayName && <h2 className="text-foreground m-0 text-lg font-medium">{displayName}</h2>}

							{email && <div className="text-sm text-description">{email}</div>}

							<div className="flex gap-2 items-center mt-1">
								<Tooltip>
									<TooltipTrigger>
										<VSCodeDropdown
											className="w-full"
											currentValue={accountSwitch ? accountSwitch.organizationId || uid : dropdownValue}
											disabled={!!accountSwitch || isLockedByRemoteConfig}
											onChange={handleOrganizationChange}>
											<VSCodeOption key="personal" value={uid}>
												Personal
											</VSCodeOption>
											{userOrganizations?.map((org: UserOrganization) => (
												<VSCodeOption key={org.organizationId} value={org.organizationId}>
													{org.name}
												</VSCodeOption>
											))}
										</VSCodeDropdown>
									</TooltipTrigger>
									<TooltipContent hidden={!isLockedByRemoteConfig}>
										This cannot be changed while your organization has remote configuration enabled.
									</TooltipContent>
								</Tooltip>
								{accountSwitch ? (
									<LoaderCircleIcon
										aria-label="Switching account"
										className="size-4 shrink-0 animate-spin text-description"
									/>
								) : (
									activeOrganization && (
										<VSCodeTag className="text-xs p-2" title="Role">
											{getMainRole(activeOrganization.roles)}
										</VSCodeTag>
									)
								)}
							</div>
							{accountSwitchError && (
								<div className="mt-1 text-xs text-error" role="alert">
									Could not confirm account switch: {accountSwitchError}
								</div>
							)}
							{accountSwitch?.slow && (
								<div className="mt-1 text-xs text-description" role="status">
									Account switch is still pending. You can navigate while it finishes.
								</div>
							)}
						</div>
					</div>
					<div className="w-full flex gap-2 flex-col min-[225px]:flex-row">
						<RemoteConfigToggle activeOrganization={activeOrganization} />
					</div>
				</div>

				<div className="w-full flex gap-2 flex-col min-[225px]:flex-row">
					<div className="w-full min-[225px]:w-1/2">
						<VSCodeButtonLink appearance="primary" className="w-full" href={getIndusCodeUris(induscodeUrl, "dashboard").href}>
							Dashboard
						</VSCodeButtonLink>
					</div>
					<VSCodeButton appearance="secondary" className="w-full min-[225px]:w-1/2" onClick={() => handleSignOut()}>
						Log out
					</VSCodeButton>
				</div>

				<VSCodeDivider className="w-full my-6" />

				{cloudSessionsEnabled && (
					<div className="mb-6">
						<CloudGitHubCard />
					</div>
				)}

				<CreditBalance
					balance={balance}
					creditUrl={getIndusCodeUris(induscodeUrl, "credits", dropdownValue === uid ? "account" : "organization")}
					fetchCreditBalance={() => fetchCreditBalance(dropdownValue)}
					isLoading={isLoading || !!accountSwitch}
					lastFetchTime={lastFetchTime}
				/>

				<IndusCodePassCard />

				<VSCodeDivider className="mt-6 mb-3 w-full" />

				<div className="flex flex-col pb-[0px]">
					<CreditsHistoryTable
						isLoading={isLoading || !!accountSwitch}
						paymentsData={paymentsData}
						showPayments={dropdownValue === uid}
						usageData={usageData}
					/>
				</div>

				{/* Hide environment switching UI when in self-hosted mode */}
				{isIndusCodeTester && environment !== "selfHosted" && (
					<div className="w-full gap-1 items-end">
						<VSCodeDivider className="w-full my-3" />
						<div className="text-sm font-semibold">IndusCode Environment</div>
						<VSCodeDropdown
							className="w-full mt-1"
							currentValue={induscodeEnv}
							onChange={async (e) => {
								const target = e.target as HTMLSelectElement
								if (target?.value) {
									const value = target.value as "Local" | "Staging" | "Production"
									updateSetting("induscodeEnv", value.toLowerCase())
								}
							}}>
							{IndusCodeEnvOptions.map((env) => (
								<VSCodeOption key={env} value={env}>
									{env}
								</VSCodeOption>
							))}
						</VSCodeDropdown>
					</div>
				)}
			</div>
		</div>
	)
}

export default memo(AccountView)
