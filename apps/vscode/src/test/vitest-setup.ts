// Under vitest, `@induscode/core` is aliased to src/test/induscode-core-vitest-stub.ts
// (see vitest.config.ts), which holds models.json state in memory and exposes
// the stub-only `resetModelsFileState` — hence the cast below.
import * as IndusCodeCore from "@induscode/core"
import { resetRegistry } from "@induscode/llms"
import { beforeEach } from "vitest"

const { resetModelsFileState } = IndusCodeCore as typeof IndusCodeCore & { resetModelsFileState(): void }

beforeEach(() => {
	resetModelsFileState()
	// The stub's syncStoredProviderRegistration mutates the real shared
	// @induscode/llms registry; reset it so registrations never leak across tests.
	resetRegistry()
})
