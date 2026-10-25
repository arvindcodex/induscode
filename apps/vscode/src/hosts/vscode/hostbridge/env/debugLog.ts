import { Empty, StringRequest } from "@shared/proto/induscode/common"
import * as vscode from "vscode"

const INDUSCODE_OUTPUT_CHANNEL = vscode.window.createOutputChannel("IndusCode")

// Appends a log message to all IndusCode output channels.
export async function debugLog(request: StringRequest): Promise<Empty> {
	INDUSCODE_OUTPUT_CHANNEL.appendLine(request.value)
	return Empty.create({})
}

// Register the IndusCode output channel within the VSCode extension context.
export function registerIndusCodeOutputChannel(context: vscode.ExtensionContext): vscode.OutputChannel {
	context.subscriptions.push(INDUSCODE_OUTPUT_CHANNEL)
	return INDUSCODE_OUTPUT_CHANNEL
}
