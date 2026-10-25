import { describe, it } from "bun:test"
import { strict as assert } from "node:assert"
import { combineApiRequests } from "./combineApiRequests"
import type { IndusCodeMessage } from "./ExtensionMessage"

function started(ts: number, text: string) {
	return { ts, type: "say", say: "api_req_started", text } as IndusCodeMessage
}

function finished(ts: number, text: string) {
	return { ts, type: "say", say: "api_req_finished", text } as IndusCodeMessage
}

describe("combineApiRequests", () => {
	it("merges a started request with its following finished payload", () => {
		const messages: IndusCodeMessage[] = [
			started(1, JSON.stringify({ request: "GET /api/data" })),
			finished(2, JSON.stringify({ cost: 0.005, tokensIn: 10, tokensOut: 5 })),
		]

		const combined = combineApiRequests(messages)

		assert.equal(combined.length, 1)
		assert.equal(combined[0]?.say, "api_req_started")
		assert.deepEqual(JSON.parse(combined[0]?.text ?? "{}"), {
			request: "GET /api/data",
			cost: 0.005,
			tokensIn: 10,
			tokensOut: 5,
		})
	})

	it("keeps an api_req_started without a matching finished payload", () => {
		const messages: IndusCodeMessage[] = [started(1, JSON.stringify({ request: "A" }))]

		const combined = combineApiRequests(messages)

		assert.equal(combined.length, 1)
		assert.deepEqual(JSON.parse(combined[0]?.text ?? "{}"), { request: "A" })
	})

	it("does not throw on a malformed api_req_started payload and keeps the row", () => {
		const messages: IndusCodeMessage[] = [
			started(1, "{not-json"),
			{ ts: 2, type: "say", say: "text", text: "hello" } as IndusCodeMessage,
		]

		const combined = combineApiRequests(messages)

		assert.equal(combined[0]?.text, "{not-json")
		assert.equal(combined[1]?.text, "hello")
	})

	it("does not throw on a malformed api_req_finished payload", () => {
		const messages: IndusCodeMessage[] = [started(1, JSON.stringify({ request: "A", cost: 0.1 })), finished(2, "{not-json")]

		const combined = combineApiRequests(messages)

		// Pair is still consumed; the started row survives with its own payload.
		assert.equal(combined.length, 1)
		assert.deepEqual(JSON.parse(combined[0]?.text ?? "{}"), { request: "A", cost: 0.1 })
	})
})
