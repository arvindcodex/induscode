# IndusCodeCore API Reference

## Creating IndusCodeCore

```typescript
import { IndusCodeCore } from "@induscode/sdk"

const induscode = await IndusCodeCore.create(options: IndusCodeCoreOptions)
```

### IndusCodeCoreOptions

```typescript
interface IndusCodeCoreOptions {
  clientName: string                     // identifies your app
  distinctId?: string                    // user/instance identifier
  backendMode?: "auto" | "local" | "hub" | "remote"
  hub?: HubOptions
  remote?: RemoteOptions
  capabilities?: RuntimeCapabilities
  toolPolicies?: Record<string, ToolPolicy>
  automation?: boolean | IndusCodeCoreAutomationOptions
  fetch?: typeof fetch
}
```

### RuntimeCapabilities

```typescript
interface RuntimeCapabilities {
  requestToolApproval?: (request: ToolApprovalRequest) => Promise<ToolApprovalResult>
  // ... other capability callbacks
}
```

## Starting Sessions

### start(input)

```typescript
const session = await induscode.start(input: IndusCodeCoreStartInput)
```

Returns a `StartSessionResult`:

```typescript
interface StartSessionResult {
  sessionId: string
  manifest: SessionManifest
  manifestPath: string
  messagesPath: string
  result?: AgentResult
}
```

### IndusCodeCoreStartInput

```typescript
interface IndusCodeCoreStartInput {
  prompt: string
  config: CoreSessionConfig
  source?: string
  interactive?: boolean
  sessionMetadata?: Record<string, unknown>
  initialMessages?: AgentMessage[]
  toolPolicies?: Record<string, ToolPolicy>
  capabilities?: RuntimeCapabilities
}
```

### CoreSessionConfig

```typescript
interface CoreSessionConfig {
  cwd?: string                          // working directory
  providerId: string                    // LLM provider
  modelId: string                       // model identifier
  apiKey?: string                       // provider API key
  systemPrompt?: string                 // custom system prompt
  tools?: readonly AgentTool[]          // additional custom tools
  enableTools?: boolean                 // enable built-in tools
  hooks?: Partial<AgentRuntimeHooks>    // runtime hooks
  extensions?: AgentPlugin[]            // plugins loaded inline
  pluginPaths?: string[]                // paths to plugin packages
  extensionLoading?: "isolated" | "direct"
  extensionContext?: {                  // context passed to plugin setup()
    workspace?: { rootPath: string; cwd: string }
  }
  checkpointConfig?: CoreCheckpointConfig
  compactionConfig?: CoreCompactionConfig
  telemetry?: ITelemetryService
  logger?: BasicLogger
  enableSpawnAgent?: boolean            // enable sub-agent spawning
  enableAgentTeams?: boolean            // enable team coordination
  teamName?: string                     // team identifier
}
```

`extensions` passes plugin objects directly. `pluginPaths` points to directories with `package.json` containing a `induscode.plugins` field. Set `extensionContext.workspace` so plugins receive `ctx.workspaceInfo` in their `setup()` call -- without it, `ctx.workspaceInfo` is undefined.

## Follow-Up Messages

### send({ sessionId, prompt })

Send a follow-up message to an existing session:

```typescript
const result = await induscode.send({
  sessionId: session.sessionId,
  prompt: "Now add authentication",
})
```

Returns `AgentResult | undefined`.

## Event Subscription

### subscribe(listener, options?)

```typescript
const unsubscribe = induscode.subscribe(
  (event: CoreSessionEvent) => {
    // handle events
  },
  { sessionId: "optional-filter" }
)
```

### CoreSessionEvent

```typescript
type CoreSessionEvent =
  | { type: "chunk"; payload: SessionChunkEvent }
  | { type: "agent_event"; payload: { sessionId: string, event: AgentEvent } }
  | { type: "ended"; payload: SessionEndedEvent }
  | { type: "team_progress"; payload: SessionTeamProgressEvent }
  | { type: "status"; payload: { sessionId: string, status: string } }
  | { type: "hook"; payload: SessionToolEvent }
```

## Session Management

### list(limit?, options?)

```typescript
const sessions: SessionRecord[] = await induscode.list(50)
```

### get(sessionId)

```typescript
const session: SessionRecord = await induscode.get(sessionId)
```

### readMessages(sessionId)

```typescript
const messages: AgentMessage[] = await induscode.readMessages(sessionId)
```

### getAccumulatedUsage(sessionId)

```typescript
const usage = await induscode.getAccumulatedUsage(sessionId)
// usage.usage - root agent only
// usage.aggregateUsage - root + subagents/teammates
```

### update(sessionId, updates)

```typescript
await induscode.update(sessionId, { title: "New title" })
```

### abort(sessionId, reason?)

```typescript
await induscode.abort(sessionId, "User cancelled")
```

### stop(sessionId)

```typescript
await induscode.stop(sessionId)
```

### delete(sessionId)

```typescript
await induscode.delete(sessionId)
```

### restore(input)

Restore a session from a checkpoint:

```typescript
await induscode.restore({ sessionId, checkpointId })
```

### dispose(reason?)

Clean up all resources. Always call this when done:

```typescript
await induscode.dispose("Shutting down")
```

## AgentResult

Returned by session operations:

```typescript
interface AgentResult {
  text: string
  usage: LegacyAgentUsage
  messages: MessageWithMetadata[]
  toolCalls: ToolCallRecord[]
  iterations: number
  finishReason: "completed" | "max_iterations" | "aborted" | "mistake_limit" | "error"
  model: { id: string; provider: string; info?: ModelInfo }
  startedAt: Date
  endedAt: Date
  durationMs: number
}
```

## Tool Policies

Control tool access at the session level:

```typescript
const session = await induscode.start({
  prompt: "Review the code",
  config: { ... },
  toolPolicies: {
    read_files: { autoApprove: true },
    bash: { autoApprove: false },
    editor: { enabled: false },
  },
})
```

### ToolPolicy

```typescript
interface ToolPolicy {
  enabled?: boolean       // false = tool is hidden from the model
  autoApprove?: boolean   // false = requires approval callback
}
```

## Interactive Approval

```typescript
const induscode = await IndusCodeCore.create({
  clientName: "my-app",
  capabilities: {
    requestToolApproval: async (request) => {
      console.log(`Tool: ${request.toolName}, Input: ${JSON.stringify(request.input)}`)
      const approved = await askUser(`Allow ${request.toolName}?`)
      return { approved }
    },
  },
})
```

## Automation API

When `automation` is enabled in `IndusCodeCore.create()`:

```typescript
const induscode = await IndusCodeCore.create({
  clientName: "my-app",
  automation: true,
})

// Access automation methods
induscode.automation.start()
induscode.automation.stop()
induscode.automation.reconcile(specs)
induscode.automation.ingestEvent(event)
induscode.automation.listEvents()
induscode.automation.listSpecs()
induscode.automation.listRuns()
```

## Settings API

```typescript
// Read settings
const settings = await induscode.settings.list()

// Toggle tools, plugins, MCP servers
await induscode.settings.toggle({ type: "tool", name: "bash", enabled: true })
```

## See Also

- `REFERENCE.md` - Overview and quick start
- `patterns.md` - Common patterns
- `gotchas.md` - Pitfalls
- `../tools/REFERENCE.md` - Tool creation
- `../plugins/REFERENCE.md` - Plugin system
