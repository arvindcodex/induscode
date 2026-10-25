/**
 * List of email domains that are considered trusted testers for IndusCode.
 */
const INDUSCODE_TRUSTED_TESTER_DOMAINS = ["fibilabs.tech"]

/**
 * Checks if the given email belongs to a IndusCode bot user.
 * E.g. Emails ending with @induscode.bot
 */
function isIndusCodeBotUser(email: string): boolean {
	return email.endsWith("@induscode.bot")
}

export function isIndusCodeInternalTester(email: string): boolean {
	return isIndusCodeBotUser(email) || INDUSCODE_TRUSTED_TESTER_DOMAINS.some((d) => email.endsWith(`@${d}`))
}
