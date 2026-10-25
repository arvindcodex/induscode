import type { IndusCodeCore } from "@induscode/core";
import type { MessageWithMetadata } from "@induscode/shared";

export async function loadInteractiveResumeMessages(
	sessionManager: IndusCodeCore,
	resumeSessionId?: string,
): Promise<MessageWithMetadata[] | undefined> {
	const target = resumeSessionId?.trim();
	if (!target) {
		return undefined;
	}
	return await sessionManager.readMessages(target);
}
