import type { ExtensionContext } from "@induscode/shared";
import type { RuntimeCapabilities } from "../runtime/capabilities";
import { normalizeRuntimeCapabilities } from "../runtime/capabilities";
import type {
	LocalRuntimeStartOptions,
	StartSessionInput,
} from "../runtime/host/runtime-host";
import { splitCoreSessionConfig } from "../runtime/host/runtime-host";
import {
	resolveClientSessionSource,
	withSessionHistoryOriginMetadata,
} from "../session/history-origin";
import { SessionSource } from "../types/common";
import type { IndusCodeCoreStartConfig } from "../types/config";
import type { IndusCodeCoreStartInput } from "./types";

export function toIndusCodeCoreStartInput(
	input: StartSessionInput | IndusCodeCoreStartInput,
): IndusCodeCoreStartInput {
	const config = input.config as IndusCodeCoreStartConfig;
	return "providerId" in config
		? {
				...input,
				config: {
					...config,
					...coreConfigFromLocalRuntime(input.localRuntime),
				},
				localRuntime: input.localRuntime,
			}
		: (input as IndusCodeCoreStartInput);
}

export interface NormalizeIndusCodeCoreStartInputOptions {
	defaultCapabilities?: RuntimeCapabilities;
	withExtensionContext?: (
		context?: ExtensionContext,
	) => ExtensionContext | undefined;
}

export function normalizeIndusCodeCoreStartInput(
	input: IndusCodeCoreStartInput,
	options: NormalizeIndusCodeCoreStartInputOptions = {},
): StartSessionInput {
	const split = splitCoreSessionConfig(input.config);
	const capabilities = normalizeRuntimeCapabilities(
		options.defaultCapabilities,
		input.capabilities,
	);
	let localRuntime = mergeLocalRuntimeStartOptions(
		split.localRuntime,
		input.localRuntime,
	);
	const extensionContext = options.withExtensionContext
		? options.withExtensionContext(localRuntime?.extensionContext)
		: localRuntime?.extensionContext;
	if (extensionContext) {
		localRuntime = {
			...(localRuntime ?? {}),
			extensionContext,
		};
	}
	return {
		...input,
		...split,
		source:
			input.source ??
			resolveClientSessionSource(extensionContext?.client) ??
			SessionSource.CORE,
		sessionMetadata: withSessionHistoryOriginMetadata(input.sessionMetadata, {
			mode: input.mode,
			version: extensionContext?.client?.version,
		}),
		...(localRuntime ? { localRuntime } : {}),
		...(capabilities ? { capabilities } : {}),
	};
}

function coreConfigFromLocalRuntime(
	localRuntime: LocalRuntimeStartOptions | undefined,
): Partial<IndusCodeCoreStartConfig> {
	if (!localRuntime) {
		return {};
	}
	const {
		modelCatalogDefaults: _modelCatalogDefaults,
		userInstructionService: _userInstructionService,
		configExtensions: _configExtensions,
		onTeamRestored: _onTeamRestored,
		...localConfig
	} = localRuntime;
	return localConfig;
}

function mergeLocalRuntimeStartOptions(
	...sources: Array<LocalRuntimeStartOptions | undefined>
): LocalRuntimeStartOptions | undefined {
	const merged: LocalRuntimeStartOptions = {};
	for (const source of sources) {
		if (source) {
			Object.assign(merged, source);
		}
	}
	return Object.keys(merged).length > 0 ? merged : undefined;
}
