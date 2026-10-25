import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useIndusCodePassPromo } from "@/hooks/useIndusCodePassPromo"
import { IndusCodePassCard, IndusCodePassWelcomeCallout } from "../IndusCodePassCard"

vi.mock("@/hooks/useIndusCodePassPromo", async (importOriginal) => {
	const actual = await importOriginal()
	return {
		...(actual as Record<string, unknown>),
		useIndusCodePassPromo: vi.fn(),
	}
})

const mockPromo = (overrides: Partial<ReturnType<typeof useIndusCodePassPromo>> = {}) => {
	vi.mocked(useIndusCodePassPromo).mockReturnValue({
		isIndusCodePassEnabled: true,
		isUsingIndusCodePass: false,
		subscribeUrl: "https://app.induscode.bot/onboarding/individual-plan",
		manageSubscriptionUrl: "https://app.induscode.bot/dashboard/subscription",
		openSubscribePage: vi.fn(),
		openManageSubscriptionPage: vi.fn(),
		selectIndusCodePassProvider: vi.fn(),
		switchToIndusCodePassProvider: vi.fn(),
		...overrides,
	})
}

describe("IndusCodePassCard", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders nothing when IndusCodePass promotions are disabled", () => {
		mockPromo({ isIndusCodePassEnabled: false })
		render(<IndusCodePassCard />)
		expect(screen.queryByTestId("induscode-pass-card")).not.toBeInTheDocument()
	})

	it("promotes IndusCodePass when the user is not on the IndusCodePass provider", () => {
		mockPromo()
		render(<IndusCodePassCard />)
		expect(screen.getByText("Get IndusCodePass")).toBeInTheDocument()
		expect(screen.getByText("Use IndusCodePass Provider")).toBeInTheDocument()
		expect(screen.queryByText("Manage Subscription")).not.toBeInTheDocument()
	})

	it("switches to the IndusCodePass provider on click", () => {
		const switchToIndusCodePassProvider = vi.fn().mockResolvedValue(undefined)
		mockPromo({ switchToIndusCodePassProvider })
		render(<IndusCodePassCard />)
		fireEvent.click(screen.getByText("Use IndusCodePass Provider"))
		expect(switchToIndusCodePassProvider).toHaveBeenCalledTimes(1)
	})

	it("links to subscription management when already using IndusCodePass", () => {
		mockPromo({ isUsingIndusCodePass: true })
		render(<IndusCodePassCard />)
		expect(screen.getByText("Manage Subscription")).toBeInTheDocument()
		expect(screen.queryByText("Get IndusCodePass")).not.toBeInTheDocument()
	})
})

describe("IndusCodePassWelcomeCallout", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders nothing when IndusCodePass promotions are disabled", () => {
		mockPromo({ isIndusCodePassEnabled: false })
		render(<IndusCodePassWelcomeCallout />)
		expect(screen.queryByTestId("induscode-pass-welcome-callout")).not.toBeInTheDocument()
	})

	it("mentions IndusCodePass when promotions are enabled", () => {
		mockPromo()
		render(<IndusCodePassWelcomeCallout />)
		expect(screen.getByTestId("induscode-pass-welcome-callout")).toHaveTextContent("IndusCodePass")
	})
})
