import { CheckpointRestoreRequest } from "@shared/proto/induscode/checkpoints"
import { Empty } from "@shared/proto/induscode/common"
import { IndusCodeCheckpointRestore } from "../../../shared/WebviewMessage"
import { Controller } from ".."

export async function checkpointRestore(controller: Controller, request: CheckpointRestoreRequest): Promise<Empty> {
	const sdkRestoreCheckpoint = (
		controller as Controller & {
			restoreCheckpoint?: (input: { checkpointRunCount: number; restoreType: IndusCodeCheckpointRestore }) => Promise<void>
		}
	).restoreCheckpoint
	if (sdkRestoreCheckpoint) {
		if (request.number) {
			await sdkRestoreCheckpoint.call(controller, {
				checkpointRunCount: Number(request.number),
				restoreType: request.restoreType as IndusCodeCheckpointRestore,
			})
		}
		return Empty.create({})
	}

	return Empty.create({})
}
