import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import sinon from "sinon"
import { Logger } from "@/shared/services/Logger"
import type { Controller } from "../../index"
import { clearOrganizationForIndusCodePassProviderSelection } from "../handleIndusCodePassProviderSelection"

/** Let the fire-and-forget switchAccount promise chain settle. */
function flushMicrotasks(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve))
}

describe("clearOrganizationForIndusCodePassProviderSelection", () => {
	let sandbox: sinon.SinonSandbox
	let switchAccount: sinon.SinonStub

	beforeEach(() => {
		sandbox = sinon.createSandbox()
		switchAccount = sandbox.stub().resolves()
		sandbox.stub(Logger, "debug")
	})

	afterEach(() => {
		sandbox.restore()
	})

	function createController(): Controller {
		return {
			accountService: { switchAccount },
		} as unknown as Controller
	}

	it("does nothing when IndusCodePass is not selected", () => {
		clearOrganizationForIndusCodePassProviderSelection(createController(), {
			planModeApiProvider: "induscode",
			actModeApiProvider: "openrouter",
		})

		expect(switchAccount.callCount).toBe(0)
	})

	it("switches to the personal account when IndusCodePass is selected without blocking the caller", () => {
		clearOrganizationForIndusCodePassProviderSelection(createController(), {
			planModeApiProvider: "induscode-pass",
			actModeApiProvider: "openrouter",
		})

		expect(switchAccount.callCount).toBe(1)
		expect(switchAccount.firstCall.args[0]).toBeUndefined()
	})

	it("logs and swallows account switch failures", async () => {
		const error = new Error("not signed in")
		switchAccount.rejects(error)

		clearOrganizationForIndusCodePassProviderSelection(createController(), {
			planModeApiProvider: "induscode",
			actModeApiProvider: "induscode-pass",
		})
		await flushMicrotasks()

		expect(switchAccount.callCount).toBe(1)
		expect(switchAccount.firstCall.args[0]).toBeUndefined()
		expect((Logger.debug as sinon.SinonStub).calledOnce).toBe(true)
	})
})
