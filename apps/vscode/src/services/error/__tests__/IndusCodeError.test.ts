import { describe, it } from "bun:test"
import "should"
import { IndusCodeError, IndusCodeErrorType } from "../IndusCodeError"

describe("IndusCodeError", () => {
	describe("getErrorType", () => {
		it("should return QuotaExceeded when code is INFERENCE_CAP_ERROR", () => {
			const err = new IndusCodeError({ message: "Inference cap reached", code: "INFERENCE_CAP_ERROR" })
			IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.QuotaExceeded)
		})

		it("should return Entitlement for the SDK IndusCodePass subscription message", () => {
			const err = new IndusCodeError(
				"No access to IndusCodePass subscription models yet. Subscribe to IndusCodePass, the low cost open weights model coding plan:",
			)

			IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.Entitlement)
		})

		it("should return Entitlement for the SDK IndusCodePass subscription message with a different app URL", () => {
			const err = new IndusCodeError(
				"No access to IndusCodePass subscription models yet. Subscribe to IndusCodePass, the low cost open weights model coding plan:",
			)

			IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.Entitlement)
		})

		it("should return Entitlement for the raw required-plan message", () => {
			const err = new IndusCodeError("403 Error 403: the user is not subscribed to required model plan")

			IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.Entitlement)
		})

		it("should classify the SDK org individual subscription message separately", () => {
			const err = new IndusCodeError(
				"Organization accounts cannot use IndusCodePass subscriptions. Go to /account -> change account to switch to your personal account for IndusCodePass",
			)

			IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.OrgIndusCodePassRestriction)
		})

		it("should classify the raw organization individual subscription message separately", () => {
			const err = new IndusCodeError("403 Error 403: organization accounts cannot use individual model inference subscriptions")

			IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.OrgIndusCodePassRestriction)
		})

		it("should classify IndusCodePass period limit messages separately", () => {
			const err = new IndusCodeError(
				"You have reached your weekly IndusCodepass limit. The limit resets in 7d, please try again later.",
			)

			IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.IndusCodePassLimit)
		})

		it("should classify nested IndusCodePass period limit messages separately", () => {
			const err = new IndusCodeError({
				message: "403 Error 403",
				error: {
					message: "You have reached your monthly IndusCodePass limit. The limit resets in 12h, please try again later.",
				},
			})

			IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.IndusCodePassLimit)
		})

		it("should classify daily IndusCode free model limits separately", () => {
			const err = new IndusCodeError(
				"Error: Error 429: Daily free limit reached on model deepseek/deepseek-v4-flash. Try again in 23h 59m",
			)

			IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.IndusCodeFreeModelLimit)
		})

		it("should classify the host-stamped promotion-ended code as IndusCodeFreePromotionEnded", () => {
			// reshapeErrorForWebview stamps this code when the active model is a
			// retired induscode-free/ id (see message-translator).
			const err = new IndusCodeError({
				message: "Model not found",
				code: "induscode_free_promotion_ended",
			})

			IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.IndusCodeFreePromotionEnded)
		})

		it("should classify model-not-found for a induscode-free model as IndusCodeFreePromotionEnded", () => {
			const err = new IndusCodeError({ message: "Error 404: Model not found" }, "induscode-free/glm-5")

			IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.IndusCodeFreePromotionEnded)
		})

		it("should prefer IndusCodeFreePromotionEnded over Auth for a 404 with a induscode-free model", () => {
			// A 404 falls inside the generic 401-428 auth-status range; the
			// promotion-ended classification must win.
			const err = new IndusCodeError({ message: "Error 404: Model not found", status: 404 }, "induscode-free/glm-5")

			const result = IndusCodeError.getErrorType(err)
			result!.should.equal(IndusCodeErrorType.IndusCodeFreePromotionEnded)
		})

		it("should keep model-not-found for a non-free model on the generic path", () => {
			const err = new IndusCodeError({ message: "Error 404: Model not found", status: 404 }, "deepseek/deepseek-v4-flash")

			const result = IndusCodeError.getErrorType(err)
			;(result !== IndusCodeErrorType.IndusCodeFreePromotionEnded).should.be.true()
		})

		it("should not classify unrelated induscode-free errors as IndusCodeFreePromotionEnded", () => {
			const err = new IndusCodeError({ message: "Network error: socket hang up" }, "induscode-free/glm-5")

			const result = IndusCodeError.getErrorType(err)
			;(result !== IndusCodeErrorType.IndusCodeFreePromotionEnded).should.be.true()
		})

		describe("HTTP status", () => {
			// A BYOK provider answering with a bare status: the message carries
			// no auth / rate-limit wording, so the status alone decides.
			const withStatus = (status: number, message = `Request failed with status code ${status}`) =>
				new IndusCodeError({ message, status }, "qwen3-coder", "openai-compatible")

			it("classifies 401 and 403 as Auth", () => {
				for (const status of [401, 403]) {
					IndusCodeError.getErrorType(withStatus(status))!.should.equal(IndusCodeErrorType.Auth)
				}
			})

			it("leaves 407 on the generic row: the proxy rejected credentials, not the provider", () => {
				;(IndusCodeError.getErrorType(withStatus(407)) === undefined).should.be.true()
			})

			it("classifies 402 as Balance, not Auth", () => {
				IndusCodeError.getErrorType(withStatus(402))!.should.equal(IndusCodeErrorType.Balance)
			})

			it("classifies 404, 405 and 410 as NotFound, not Auth", () => {
				for (const status of [404, 405, 410]) {
					IndusCodeError.getErrorType(withStatus(status))!.should.equal(IndusCodeErrorType.NotFound)
				}
			})

			it("leaves 400, 413 and 422 unclassified so the generic row shows the real status", () => {
				for (const status of [400, 413, 422]) {
					;(IndusCodeError.getErrorType(withStatus(status)) === undefined).should.be.true()
				}
			})

			it("still classifies 429 by its rate-limit wording", () => {
				IndusCodeError.getErrorType(withStatus(429, "Error 429: Too many requests"))!.should.equal(IndusCodeErrorType.RateLimit)
			})

			it("lets the HTTP status override axios' ERR_BAD_REQUEST code", () => {
				// axios stamps ERR_BAD_REQUEST on every 4xx; a 404 carrying it is
				// still a not-found answer.
				const err = new IndusCodeError({
					message: "Request failed with status code 404",
					status: 404,
					code: "ERR_BAD_REQUEST",
				})

				IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.NotFound)
			})

			it("keeps ERR_BAD_REQUEST without a status as Auth", () => {
				const err = new IndusCodeError({ message: "Request failed", code: "ERR_BAD_REQUEST" })

				IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.Auth)
			})

			it("keeps message-based auth detection for status-less errors", () => {
				IndusCodeError.getErrorType(new IndusCodeError("Invalid API key"))!.should.equal(IndusCodeErrorType.Auth)
			})

			it("keeps message-based auth detection for statuses outside the dedicated sets", () => {
				// Gemini answers an invalid key with HTTP 400, not 401; only the
				// wording identifies it as a credential problem.
				const err = new IndusCodeError(
					{ message: "API key not valid. Please pass a valid API key.", status: 400 },
					"gemini-2.5-pro",
					"gemini",
				)

				IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.Auth)
			})

			it("classifies a serialized 404 payload parsed by the webview as NotFound", () => {
				// llama-swap answers 404 for a model id it no longer serves.
				const payload = JSON.stringify({
					message: 'model "qwen3-coder" not found',
					status: 404,
					providerId: "openai-compatible",
				})

				const err = IndusCodeError.parse(payload)!
				IndusCodeError.getErrorType(err)!.should.equal(IndusCodeErrorType.NotFound)
				err.isErrorType(IndusCodeErrorType.Auth).should.be.false()
			})
		})
	})
})
