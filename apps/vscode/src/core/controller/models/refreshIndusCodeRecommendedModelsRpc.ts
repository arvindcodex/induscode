import { EmptyRequest } from "@shared/proto/induscode/common"
import { IndusCodeRecommendedModel, IndusCodeRecommendedModelsResponse } from "@shared/proto/induscode/models"
import type { Controller } from "../index"
import { refreshIndusCodeRecommendedModels } from "./refreshIndusCodeRecommendedModels"

export async function refreshIndusCodeRecommendedModelsRpc(
	_controller: Controller,
	_request: EmptyRequest,
): Promise<IndusCodeRecommendedModelsResponse> {
	const models = await refreshIndusCodeRecommendedModels()
	return IndusCodeRecommendedModelsResponse.create({
		recommended: models.recommended.map((model) =>
			IndusCodeRecommendedModel.create({
				id: model.id,
				name: model.name,
				description: model.description,
				tags: model.tags,
			}),
		),
		free: models.free.map((model) =>
			IndusCodeRecommendedModel.create({
				id: model.id,
				name: model.name,
				description: model.description,
				tags: model.tags,
			}),
		),
		induscodePass: (models.induscodePass ?? []).map((model) =>
			IndusCodeRecommendedModel.create({
				id: model.id,
				name: model.name,
				description: model.description,
				tags: model.tags,
			}),
		),
	})
}
