# IndusCode Core CLI Agent

An interactive terminal chat agent powered by the `IndusCodeCore` runtime. This example is similar in spirit to [`cli-agent`](../cli-agent), but uses stateful IndusCodeCore sessions and built-in runtime tools instead of the stateless `Agent` class, to leverage IndusCode's internal agent harness.

## Getting started

Install dependencies:

```bash
bun install
bun run build:sdk
```

Set an API key:

```bash
export INDUSCODE_API_KEY="sk_..."
```

Run:

```bash
bun dev
```

Type any message at the `you:` prompt to see a streaming response. Type `exit` to quit.

## Optional model configuration

The example defaults to IndusCode's gateway provider and Claude Sonnet:

```bash
export INDUSCODE_PROVIDER_ID="induscode"
export INDUSCODE_MODEL_ID="anthropic/claude-sonnet-4.6"
```

## What it does

- Creates a local `IndusCodeCore` runtime with `IndusCodeCore.create()`
- Starts one interactive session with `induscode.start()`
- Sends each user turn with `induscode.send({ sessionId, prompt })`
- Streams `agent_event` text to stdout as the assistant responds
- Logs tool calls and tool results inline
- Uses IndusCodeCore's built-in tools instead of defining custom tools
- Calls `induscode.stop()` and `induscode.dispose()` during shutdown

## Concepts demonstrated

- Stateful sessions with `IndusCodeCore`
- Multi-turn conversation using a single `sessionId`
- `CoreSessionEvent` subscription via `induscode.subscribe()`
- Built-in runtime tools (`read_files`, `search_codebase`, `run_commands`, etc.)
- Basic tool policies: file reads/search are auto-approved, other tools request approval

## Notes

Use this example when you want the full IndusCodeCore runtime with sessions, persistence, and built-in tools. For the smallest possible SDK example, see [quickstart](../quickstart). For the lightweight stateless runtime, see [cli-agent](../cli-agent).
