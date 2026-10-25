import { AccountServiceClient } from "@induscode-grpc/account"
import { BrowserServiceClient } from "@induscode-grpc/browser"
import { CheckpointsServiceClient } from "@induscode-grpc/checkpoints"
import { CommandsServiceClient } from "@induscode-grpc/commands"
import { FileServiceClient } from "@induscode-grpc/file"
import { McpServiceClient } from "@induscode-grpc/mcp"
import { ModelsServiceClient } from "@induscode-grpc/models"
import { SlashServiceClient } from "@induscode-grpc/slash"
import { StateServiceClient } from "@induscode-grpc/state"
import { TaskServiceClient } from "@induscode-grpc/task"
import { UiServiceClient } from "@induscode-grpc/ui"
import { WebServiceClient } from "@induscode-grpc/web"
import { credentials } from "@grpc/grpc-js"
import { promisify } from "util"

const serviceRegistry = {
	"induscode.AccountService": AccountServiceClient,
	"induscode.BrowserService": BrowserServiceClient,
	"induscode.CheckpointsService": CheckpointsServiceClient,
	"induscode.CommandsService": CommandsServiceClient,
	"induscode.FileService": FileServiceClient,
	"induscode.McpService": McpServiceClient,
	"induscode.ModelsService": ModelsServiceClient,
	"induscode.SlashService": SlashServiceClient,
	"induscode.StateService": StateServiceClient,
	"induscode.TaskService": TaskServiceClient,
	"induscode.UiService": UiServiceClient,
	"induscode.WebService": WebServiceClient,
} as const

export type ServiceClients = {
	-readonly [K in keyof typeof serviceRegistry]: InstanceType<(typeof serviceRegistry)[K]>
}

export class GrpcAdapter {
	private clients: Partial<ServiceClients> = {}

	constructor(address: string) {
		for (const [name, Client] of Object.entries(serviceRegistry)) {
			this.clients[name as keyof ServiceClients] = new (Client as any)(address, credentials.createInsecure())
		}
	}

	async call(service: keyof ServiceClients, method: string, request: any): Promise<any> {
		const client = this.clients[service]
		if (!client) {
			throw new Error(`No gRPC client registered for service: ${String(service)}`)
		}

		const fn = (client as any)[method]
		if (typeof fn !== "function") {
			throw new Error(`Method ${method} not found on service ${String(service)}`)
		}

		try {
			const fnAsync = promisify(fn).bind(client)
			const response = await fnAsync(request.message)
			return response?.toObject ? response.toObject() : response
		} catch (error) {
			console.error(`[GrpcAdapter] ${service}.${method} failed:`, error)
			throw error
		}
	}

	close(): void {
		for (const client of Object.values(this.clients)) {
			if (client && typeof (client as any).close === "function") {
				;(client as any).close()
			}
		}
	}
}
