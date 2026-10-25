import { IndusCodeAsk as AppIndusCodeAsk, IndusCodeMessage as AppIndusCodeMessage, IndusCodeSay as AppIndusCodeSay } from "@shared/ExtensionMessage"
import { IndusCodeAsk, IndusCodeMessageType, IndusCodeSay, IndusCodeMessage as ProtoIndusCodeMessage } from "@shared/proto/induscode/ui"

// Helper function to convert IndusCodeAsk string to enum
function convertIndusCodeAskToProtoEnum(ask: AppIndusCodeAsk | undefined): IndusCodeAsk | undefined {
	if (!ask) {
		return undefined
	}

	const mapping: Record<AppIndusCodeAsk, IndusCodeAsk> = {
		followup: IndusCodeAsk.FOLLOWUP,
		plan_mode_respond: IndusCodeAsk.PLAN_MODE_RESPOND,
		act_mode_respond: IndusCodeAsk.ACT_MODE_RESPOND,
		command: IndusCodeAsk.COMMAND,
		command_output: IndusCodeAsk.COMMAND_OUTPUT,
		completion_result: IndusCodeAsk.COMPLETION_RESULT,
		tool: IndusCodeAsk.TOOL,
		api_req_failed: IndusCodeAsk.API_REQ_FAILED,
		resume_task: IndusCodeAsk.RESUME_TASK,
		resume_completed_task: IndusCodeAsk.RESUME_COMPLETED_TASK,
		mistake_limit_reached: IndusCodeAsk.MISTAKE_LIMIT_REACHED,
		browser_action_launch: IndusCodeAsk.BROWSER_ACTION_LAUNCH,
		use_mcp_server: IndusCodeAsk.USE_MCP_SERVER,
		new_task: IndusCodeAsk.NEW_TASK,
		condense: IndusCodeAsk.CONDENSE,
		summarize_task: IndusCodeAsk.SUMMARIZE_TASK,
		report_bug: IndusCodeAsk.REPORT_BUG,
		use_subagents: IndusCodeAsk.USE_SUBAGENTS,
	}

	const result = mapping[ask]
	if (result === undefined) {
	}
	return result
}

// Helper function to convert IndusCodeAsk enum to string
function convertProtoEnumToIndusCodeAsk(ask: IndusCodeAsk): AppIndusCodeAsk | undefined {
	if (ask === IndusCodeAsk.UNRECOGNIZED) {
		return undefined
	}

	const mapping: Record<Exclude<IndusCodeAsk, IndusCodeAsk.UNRECOGNIZED>, AppIndusCodeAsk> = {
		[IndusCodeAsk.FOLLOWUP]: "followup",
		[IndusCodeAsk.PLAN_MODE_RESPOND]: "plan_mode_respond",
		[IndusCodeAsk.ACT_MODE_RESPOND]: "act_mode_respond",
		[IndusCodeAsk.COMMAND]: "command",
		[IndusCodeAsk.COMMAND_OUTPUT]: "command_output",
		[IndusCodeAsk.COMPLETION_RESULT]: "completion_result",
		[IndusCodeAsk.TOOL]: "tool",
		[IndusCodeAsk.API_REQ_FAILED]: "api_req_failed",
		[IndusCodeAsk.RESUME_TASK]: "resume_task",
		[IndusCodeAsk.RESUME_COMPLETED_TASK]: "resume_completed_task",
		[IndusCodeAsk.MISTAKE_LIMIT_REACHED]: "mistake_limit_reached",
		[IndusCodeAsk.BROWSER_ACTION_LAUNCH]: "browser_action_launch",
		[IndusCodeAsk.USE_MCP_SERVER]: "use_mcp_server",
		[IndusCodeAsk.NEW_TASK]: "new_task",
		[IndusCodeAsk.CONDENSE]: "condense",
		[IndusCodeAsk.SUMMARIZE_TASK]: "summarize_task",
		[IndusCodeAsk.REPORT_BUG]: "report_bug",
		[IndusCodeAsk.USE_SUBAGENTS]: "use_subagents",
	}

	return mapping[ask]
}

// Helper function to convert IndusCodeSay string to enum
function convertIndusCodeSayToProtoEnum(say: AppIndusCodeSay | undefined): IndusCodeSay | undefined {
	if (!say) {
		return undefined
	}

	const mapping: Record<AppIndusCodeSay, IndusCodeSay> = {
		task: IndusCodeSay.TASK,
		error: IndusCodeSay.ERROR,
		api_req_started: IndusCodeSay.API_REQ_STARTED,
		api_req_finished: IndusCodeSay.API_REQ_FINISHED,
		text: IndusCodeSay.TEXT,
		reasoning: IndusCodeSay.REASONING,
		completion_result: IndusCodeSay.COMPLETION_RESULT_SAY,
		plan_completion_result: IndusCodeSay.PLAN_COMPLETION_RESULT,
		user_feedback: IndusCodeSay.USER_FEEDBACK,
		user_feedback_diff: IndusCodeSay.USER_FEEDBACK_DIFF,
		command: IndusCodeSay.COMMAND_SAY,
		command_output: IndusCodeSay.COMMAND_OUTPUT_SAY,
		tool: IndusCodeSay.TOOL_SAY,
		shell_integration_warning: IndusCodeSay.SHELL_INTEGRATION_WARNING,
		shell_integration_warning_with_suggestion: IndusCodeSay.SHELL_INTEGRATION_WARNING,
		browser_action_launch: IndusCodeSay.BROWSER_ACTION_LAUNCH_SAY,
		browser_action: IndusCodeSay.BROWSER_ACTION,
		browser_action_result: IndusCodeSay.BROWSER_ACTION_RESULT,
		mcp_server_request_started: IndusCodeSay.MCP_SERVER_REQUEST_STARTED,
		mcp_server_response: IndusCodeSay.MCP_SERVER_RESPONSE,
		mcp_notification: IndusCodeSay.MCP_NOTIFICATION,
		use_mcp_server: IndusCodeSay.USE_MCP_SERVER_SAY,
		diff_error: IndusCodeSay.DIFF_ERROR,
		deleted_api_reqs: IndusCodeSay.DELETED_API_REQS,
		induscodeignore_error: IndusCodeSay.INDUSCODEIGNORE_ERROR,
		command_permission_denied: IndusCodeSay.COMMAND_PERMISSION_DENIED,
		checkpoint_created: IndusCodeSay.CHECKPOINT_CREATED,
		load_mcp_documentation: IndusCodeSay.LOAD_MCP_DOCUMENTATION,
		info: IndusCodeSay.INFO,
		hook_status: IndusCodeSay.HOOK_STATUS,
		hook_output_stream: IndusCodeSay.HOOK_OUTPUT_STREAM,
		conditional_rules_applied: IndusCodeSay.CONDITIONAL_RULES_APPLIED,
		subagent: IndusCodeSay.SUBAGENT_STATUS,
		use_subagents: IndusCodeSay.USE_SUBAGENTS_SAY,
		subagent_usage: IndusCodeSay.SUBAGENT_USAGE,
		compaction: IndusCodeSay.COMPACTION,
	}

	const result = mapping[say]

	return result
}

// Helper function to convert IndusCodeSay enum to string
function convertProtoEnumToIndusCodeSay(say: IndusCodeSay): AppIndusCodeSay | undefined {
	if (say === IndusCodeSay.UNRECOGNIZED) {
		return undefined
	}

	const mapping: Record<Exclude<IndusCodeSay, IndusCodeSay.UNRECOGNIZED>, AppIndusCodeSay> = {
		[IndusCodeSay.TASK]: "task",
		[IndusCodeSay.ERROR]: "error",
		[IndusCodeSay.API_REQ_STARTED]: "api_req_started",
		[IndusCodeSay.API_REQ_FINISHED]: "api_req_finished",
		[IndusCodeSay.TEXT]: "text",
		[IndusCodeSay.REASONING]: "reasoning",
		[IndusCodeSay.COMPLETION_RESULT_SAY]: "completion_result",
		[IndusCodeSay.PLAN_COMPLETION_RESULT]: "plan_completion_result",
		[IndusCodeSay.USER_FEEDBACK]: "user_feedback",
		[IndusCodeSay.USER_FEEDBACK_DIFF]: "user_feedback_diff",
		[IndusCodeSay.COMMAND_SAY]: "command",
		[IndusCodeSay.COMMAND_OUTPUT_SAY]: "command_output",
		[IndusCodeSay.TOOL_SAY]: "tool",
		[IndusCodeSay.SHELL_INTEGRATION_WARNING]: "shell_integration_warning",
		[IndusCodeSay.BROWSER_ACTION_LAUNCH_SAY]: "browser_action_launch",
		[IndusCodeSay.BROWSER_ACTION]: "browser_action",
		[IndusCodeSay.BROWSER_ACTION_RESULT]: "browser_action_result",
		[IndusCodeSay.MCP_SERVER_REQUEST_STARTED]: "mcp_server_request_started",
		[IndusCodeSay.MCP_SERVER_RESPONSE]: "mcp_server_response",
		[IndusCodeSay.MCP_NOTIFICATION]: "mcp_notification",
		[IndusCodeSay.USE_MCP_SERVER_SAY]: "use_mcp_server",
		[IndusCodeSay.DIFF_ERROR]: "diff_error",
		[IndusCodeSay.DELETED_API_REQS]: "deleted_api_reqs",
		[IndusCodeSay.INDUSCODEIGNORE_ERROR]: "induscodeignore_error",
		[IndusCodeSay.COMMAND_PERMISSION_DENIED]: "command_permission_denied",
		[IndusCodeSay.CHECKPOINT_CREATED]: "checkpoint_created",
		[IndusCodeSay.LOAD_MCP_DOCUMENTATION]: "load_mcp_documentation",
		[IndusCodeSay.INFO]: "info",
		[IndusCodeSay.HOOK_STATUS]: "hook_status",
		[IndusCodeSay.HOOK_OUTPUT_STREAM]: "hook_output_stream",
		[IndusCodeSay.CONDITIONAL_RULES_APPLIED]: "conditional_rules_applied",
		[IndusCodeSay.SUBAGENT_STATUS]: "subagent",
		[IndusCodeSay.USE_SUBAGENTS_SAY]: "use_subagents",
		[IndusCodeSay.SUBAGENT_USAGE]: "subagent_usage",
		[IndusCodeSay.COMPACTION]: "compaction",
	}

	return mapping[say]
}

/**
 * Convert application IndusCodeMessage to proto IndusCodeMessage
 */
export function convertIndusCodeMessageToProto(message: AppIndusCodeMessage): ProtoIndusCodeMessage {
	// For sending messages, we need to provide values for required proto fields
	const askEnum = message.ask ? convertIndusCodeAskToProtoEnum(message.ask) : undefined
	const sayEnum = message.say ? convertIndusCodeSayToProtoEnum(message.say) : undefined

	// Determine appropriate enum values based on message type
	let finalAskEnum: IndusCodeAsk = IndusCodeAsk.FOLLOWUP // Proto default
	let finalSayEnum: IndusCodeSay = IndusCodeSay.TEXT // Proto default

	if (message.type === "ask") {
		finalAskEnum = askEnum ?? IndusCodeAsk.FOLLOWUP // Use FOLLOWUP as default for ask messages
	} else if (message.type === "say") {
		finalSayEnum = sayEnum ?? IndusCodeSay.TEXT // Use TEXT as default for say messages
	}

	const protoMessage: ProtoIndusCodeMessage = {
		ts: message.ts,
		type: message.type === "ask" ? IndusCodeMessageType.ASK : IndusCodeMessageType.SAY,
		ask: finalAskEnum,
		say: finalSayEnum,
		text: message.text ?? "",
		reasoning: message.reasoning ?? "",
		images: message.images ?? [],
		files: message.files ?? [],
		partial: message.partial ?? false,
		// Convergent-replica fields (default 0 = unstamped, e.g. classic/legacy path).
		seq: message.seq ?? 0,
		epoch: message.epoch ?? 0,
		lastCheckpointHash: message.lastCheckpointHash ?? "",
		isCheckpointCheckedOut: message.isCheckpointCheckedOut ?? false,
		isOperationOutsideWorkspace: message.isOperationOutsideWorkspace ?? false,
		conversationHistoryIndex: message.conversationHistoryIndex ?? 0,
		conversationHistoryDeletedRange: message.conversationHistoryDeletedRange
			? {
					startIndex: message.conversationHistoryDeletedRange[0],
					endIndex: message.conversationHistoryDeletedRange[1],
				}
			: undefined,
		// Additional optional fields for specific ask/say types
		sayTool: undefined,
		sayBrowserAction: undefined,
		browserActionResult: undefined,
		askUseMcpServer: undefined,
		planModeResponse: undefined,
		askQuestion: undefined,
		askNewTask: undefined,
		apiReqInfo: undefined,
		modelInfo: message.modelInfo ?? undefined,
	}

	return protoMessage
}

/**
 * Convert proto IndusCodeMessage to application IndusCodeMessage
 */
export function convertProtoToIndusCodeMessage(protoMessage: ProtoIndusCodeMessage): AppIndusCodeMessage {
	const message: AppIndusCodeMessage = {
		ts: protoMessage.ts,
		type: protoMessage.type === IndusCodeMessageType.ASK ? "ask" : "say",
	}

	// Convert ask enum to string
	if (protoMessage.type === IndusCodeMessageType.ASK) {
		const ask = convertProtoEnumToIndusCodeAsk(protoMessage.ask)
		if (ask !== undefined) {
			message.ask = ask
		}
	}

	// Convert say enum to string
	if (protoMessage.type === IndusCodeMessageType.SAY) {
		const say = convertProtoEnumToIndusCodeSay(protoMessage.say)
		if (say !== undefined) {
			message.say = say
		}
	}

	// Convert other fields - preserve empty strings as they may be intentional
	if (protoMessage.text !== "") {
		message.text = protoMessage.text
	}
	if (protoMessage.reasoning !== "") {
		message.reasoning = protoMessage.reasoning
	}
	if (protoMessage.images.length > 0) {
		message.images = protoMessage.images
	}
	if (protoMessage.files.length > 0) {
		message.files = protoMessage.files
	}
	if (protoMessage.partial) {
		message.partial = protoMessage.partial
	}
	if (protoMessage.lastCheckpointHash !== "") {
		message.lastCheckpointHash = protoMessage.lastCheckpointHash
	}
	if (protoMessage.isCheckpointCheckedOut) {
		message.isCheckpointCheckedOut = protoMessage.isCheckpointCheckedOut
	}
	if (protoMessage.isOperationOutsideWorkspace) {
		message.isOperationOutsideWorkspace = protoMessage.isOperationOutsideWorkspace
	}
	if (protoMessage.conversationHistoryIndex !== 0) {
		message.conversationHistoryIndex = protoMessage.conversationHistoryIndex
	}

	// Convert conversationHistoryDeletedRange from object to tuple
	if (protoMessage.conversationHistoryDeletedRange) {
		message.conversationHistoryDeletedRange = [
			protoMessage.conversationHistoryDeletedRange.startIndex,
			protoMessage.conversationHistoryDeletedRange.endIndex,
		]
	}

	// Convergent-replica fields. 0 means unstamped (classic/legacy path) — leave undefined so
	// the webview reducer treats such messages as always-applicable rather than epoch 0.
	if (protoMessage.seq && protoMessage.seq !== 0) {
		message.seq = protoMessage.seq
	}
	if (protoMessage.epoch && protoMessage.epoch !== 0) {
		message.epoch = protoMessage.epoch
	}

	return message
}
