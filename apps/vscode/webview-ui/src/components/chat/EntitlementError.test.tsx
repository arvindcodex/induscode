import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import EntitlementError from "./EntitlementError"

const mockAuth: { induscodeUser: { appBaseUrl?: string } | null } = {
	induscodeUser: null,
}

vi.mock("@/context/IndusCodeAuthContext", () => ({
	useIndusCodeAuth: () => mockAuth,
}))

const getSubscribeHref = () => screen.getByRole("link", { name: /get induscodepass/i }).getAttribute("href")
const querySubscribeLink = () => screen.queryByRole("link", { name: /get induscodepass/i })

describe("EntitlementError", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockAuth.induscodeUser = null
	})

	it("shows friendly copy with the backend detail as muted support text", () => {
		render(<EntitlementError message="Error 403: the user is not subscribed to required model plan" />)
		expect(screen.getByText("This model requires a IndusCodePass subscription.")).toBeInTheDocument()
		expect(screen.getByText("Error 403: the user is not subscribed to required model plan")).toBeInTheDocument()
	})

	it("omits the subscribe link when no usable app base URL is available", () => {
		render(<EntitlementError />)
		expect(querySubscribeLink()).toBeNull()

		mockAuth.induscodeUser = {}
		render(<EntitlementError />)
		expect(querySubscribeLink()).toBeNull()

		mockAuth.induscodeUser = { appBaseUrl: "not a valid url" }
		render(<EntitlementError />)
		expect(querySubscribeLink()).toBeNull()
	})

	it("builds the subscribe link from the authenticated user's app base URL", () => {
		mockAuth.induscodeUser = { appBaseUrl: "https://staging-app.induscode.bot" }
		const { unmount } = render(<EntitlementError />)
		expect(getSubscribeHref()).toBe("https://staging-app.induscode.bot/dashboard/subscription?personal=true")
		unmount()

		mockAuth.induscodeUser = {
			appBaseUrl: "https://proxy.enterprise.com/induscode/app",
		}
		render(<EntitlementError />)
		expect(getSubscribeHref()).toBe("https://proxy.enterprise.com/induscode/app/dashboard/subscription?personal=true")
	})

	it("uses the shared recovery handler when Retry Request is clicked", () => {
		const retryFailedRequest = vi.fn().mockResolvedValue(true)
		render(<EntitlementError retryFailedRequest={retryFailedRequest} />)
		// VSCodeButton has no ARIA role in jsdom; click by label text instead.
		fireEvent.click(screen.getByText("Retry Request"))
		expect(retryFailedRequest).toHaveBeenCalledTimes(1)
	})
})
