# Packages Overview

This directory is the single documentation source for package-level responsibilities.

- High-level package roles: this file (`packages/README.md`)
- Package interaction and runtime flows: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## Package Responsibilities

| Package | Primary responsibility | Typical consumers | Internal deps |
| --- | --- | --- | --- |
| `@induscode/shared` | Cross-package shared primitives (path resolution, session common types, indexing helpers) | `@induscode/agents`, `@induscode/core`, apps | None |
| `@induscode/llms` | Model catalog + provider settings schema + handler creation SDK | `@induscode/agents`, `@induscode/core`, apps | None |
| `@induscode/agents` | Stateless agent runtime loop (tools, hooks, extensions, teams, streaming) | `@induscode/core`, apps | `@induscode/llms`, `@induscode/shared` |
| `@induscode/core` | Stateful runtime orchestration (runtime composition, session lifecycle/storage, local and hub runtime services, hub discovery and client helpers) | CLI/Desktop apps | `@induscode/agents`, `@induscode/llms`, `@induscode/shared` |
| `@induscode/ui` | Internal framework-neutral web theme, Tailwind adapter, and optional base styles | IndusCode web apps | None |

## How Packages Work Together

1. `@induscode/llms` defines model/provider capabilities and builds concrete handlers.
2. `@induscode/agents` runs the agent loop on top of those handlers and tool execution primitives.
3. `@induscode/core` composes runtime behavior with persistent sessions/storage and local or hub-backed runtime services.
4. `@induscode/core` hub services orchestrate scheduled runtime execution, execution history, and schedule command handling.
5. `@induscode/core/hub` exposes discovery, the detached hub daemon, and session-oriented client APIs (`HubSessionClient`, `HubUIClient`) when hosts need a shared daemon.
6. `@induscode/shared` provides the shared contracts and path/session primitives used across the stack.

## Practical Boundary Rules

- Put provider/model schema, cataloging, and handler wiring in `@induscode/llms`.
- Put loop/tool/hook/team execution behavior in `@induscode/agents`.
- Put persistence, session lifecycle, and runtime assembly in `@induscode/core`.
- Put scheduled execution and schedule persistence in `@induscode/core` hub services.
- Put hub discovery, attach flows, and session-oriented client adapters in `@induscode/core/hub`.
- Put cross-package utility types and path/session constants in `@induscode/shared`.
- Put remote-config schemas, materialization, telemetry normalization, and blob upload primitives in `@induscode/shared/remote-config`.
- Put shared web tokens and visual foundations in `@induscode/ui`; keep fonts,
  shell layout, and product-specific animation with each consuming app.

## Runtime Entry Points

- Node-oriented imports exist where packages expose a distinct Node alias.
- `@induscode/core` itself is now the Node/runtime-oriented entry point for host/session services.
- Browser entry points still exist in packages that intentionally publish a browser surface, but `@induscode/core` no longer does.

## Notes for Doc Consolidation

Nested package `README.md` and `ARCHITECTURE.md` files can be reduced or removed after references are updated to point here.
