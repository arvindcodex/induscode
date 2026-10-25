import type { CloudTaskTargetChoice } from "@shared/proto/induscode/cloud"
import { Empty } from "@shared/proto/induscode/common"
import type { Controller } from "../index"

/** Records the one choice the user just made about where new tasks run. */
export async function chooseCloudTaskTarget(controller: Controller, request: CloudTaskTargetChoice): Promise<Empty> {
	if (request.target !== undefined) {
		await controller.cloudTaskTarget.choose({ target: request.target === "cloud" ? "cloud" : "local" })
	} else if (request.repositoryId !== undefined) {
		await controller.cloudTaskTarget.choose({ repositoryId: Number(request.repositoryId) })
	} else if (request.branch !== undefined) {
		await controller.cloudTaskTarget.choose({ branch: request.branch })
	}
	return Empty.create()
}
