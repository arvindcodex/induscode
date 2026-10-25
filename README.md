<div align="center">

# IndusCode

**The Autonomous AI Software Engineer & Developer Platform**

*Plan, build, debug, and ship production-grade code at the speed of thought.*

`Apache 2.0` • `Bun 1.4+` • `Node >=22` • `TypeScript 5.8+` • `macOS | Linux | Windows`

</div>

---

## 🌟 Overview

**IndusCode** is a next-generation, autonomous AI software development suite designed to act as your complete pair-programming companion and autonomous coding partner.

Whether running in your terminal, inside a dedicated desktop application, or integrated into your IDE, IndusCode understands entire codebases, plans complex multi-step refactors, executes safe terminal operations, inspects web pages, runs tests, and applies surgical diffs to your code.

Built on an enterprise-grade agentic core with zero-latency streaming, unified multi-provider routing, resilient failover mechanisms, and extensible Model Context Protocol (MCP) toolkits, IndusCode brings human-level engineering autonomy directly to your daily workflow.

---

## ⚡ Core Features

- **🧠 Autonomous Agent Loops**: Understands complex goals, breaks them down into actionable steps, reads files, writes precise diffs, executes shell commands, and verifies output until the task is complete.
- **🔄 Dual Operation Modes**:
  - **Plan Mode**: Explores files, investigates architecture, analyzes dependencies, and constructs a clear execution roadmap before changing code.
  - **Act Mode**: Executes edits, runs terminal commands, and resolves tasks with precision.
- **🛡️ Built-in Safety & Checkpoint System**: Automatically captures Git and filesystem snapshots before modifying files, allowing instant time-travel rollback with a single click.
- **⚡ Resilient Model Gateway & Auto-Failover**: Seamlessly routes across state-of-the-art reasoning models (Gemini, Claude, DeepSeek, Groq, OpenAI) with zero-cost fallback chains that prevent rate-limit interruptions.
- **🔌 Model Context Protocol (MCP) Ecosystem**: Native support for connecting external MCP servers, allowing IndusCode to query live databases, inspect browser tabs, query cloud infrastructure, and call custom APIs.
- **👥 Multi-Agent Orchestration**: Capable of spawning and orchestrating specialized subagents in parallel for distributed workflows, code reviews, and deep research.
- **🖥️ Multiple Native Surfaces**: Work from your preferred environment—interactive TUI in the terminal, native macOS/Linux/Windows desktop app, or headless automation for CI/CD pipelines.

---

## 🏗️ Architecture & Monorepo Structure

IndusCode is organized as a high-performance monorepo driven by **Bun** and **TypeScript**:

```
induscode/
├── apps/
│   ├── cli/                      # Native terminal interface (interactive TUI + headless)
│   ├── induscode-hub/            # Background daemon orchestrating sessions & MCP
│   ├── examples/
│   │   └── desktop-app/          # Native Tauri v2 + Next.js desktop application
│   └── vscode/                   # VS Code editor extension & webview integration
│
├── sdk/
│   └── packages/
│       ├── core/                 # Agent loop, task execution engine & file operations
│       ├── llms/                 # Multi-provider unified LLM gateway & model routing
│       ├── agents/               # Multi-agent coordination, subagents & team runtime
│       ├── ui/                   # Shared design system, theme tokens & UI components
│       ├── shared/               # Cross-platform types, IPC contracts & utilities
│       └── sdk/                  # Programmatic Node/Bun API for embedding IndusCode
│
├── docs/                         # Comprehensive documentation, API references & guides
├── evals/                        # Agent evaluation suites, benchmarks & test harnesses
└── assets/                       # Official logos, icons, and visual branding assets
```

---

## 🚀 Quickstart

### Prerequisites

- **Bun**: `^1.4.2` ([Install Bun](https://bun.sh))
- **Node.js**: `>= 22.0.0`
- **Git**: Installed and configured on your PATH

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/arvindcodex/induscode.git
cd induscode

# Install all workspace dependencies via Bun
bun install
```

### 2. Build the Core SDK

The core packages resolve each other through compiled distributions. Build them with:

```bash
bun run build:sdk
```

---

## 💻 IndusCode CLI

The **IndusCode CLI** provides a fluid, keyboard-driven terminal user interface powered by OpenTUI, as well as a headless mode suitable for automated scripting.

### Run in Development

```bash
# Launch interactive paired-programming session
bun run cli -i

# Run a one-shot autonomous task
bun run cli "Audit this repository, identify security vulnerabilities, and propose fixes"

# Run local environment health check
bun run cli doctor
```

### Build CLI Binaries

```bash
# Build platform binaries (macOS, Linux, Windows)
bun run -F @induscode/cli build
```

---

## 🖥️ IndusCode Desktop

The **IndusCode Desktop App** delivers a native desktop workstation experience powered by **Tauri v2**, **Next.js**, and an embedded **Bun sidecar backend**.

### Development

```bash
# Navigate to desktop app workspace
cd apps/examples/desktop-app

# Run backend sidecar and web interface in headless browser mode
bun run dev:headless

# Or run the native desktop window (requires Rust & Tauri system tools)
bun run dev
```

### Packaging Desktop Installers

```bash
# Package for macOS (.dmg / .app)
bun run package:desktop:mac

# Package for Linux (.deb / AppImage)
bun run package:desktop:linux

# Package for Windows (.exe installer)
bun run package:desktop:windows
```

---

## 📦 SDK & Extensibility

Embed IndusCode's autonomous agent engine directly into your own tools, bots, and backend services using `@induscode/sdk`.

### Programmatic Usage

```typescript
import { IndusCodeCore, AgentRuntime } from "@induscode/sdk";

// Initialize the IndusCode Core Session
const agent = new IndusCodeCore({
  workspaceRoot: process.cwd(),
  providerId: "induscode",
  modelId: "gemini-2.5-flash",
  onEvent: (event) => {
    if (event.type === "text-delta") {
      process.stdout.write(event.text);
    }
  },
});

// Run a coding task
await agent.execute("Create a REST API healthcheck endpoint with rate limiting");
```

---

## ⚙️ Customization & Rules

Tailor IndusCode's behavior for your specific organization and code style standards:

### Project Rules (`.induscoderules`)
Place markdown rules in `.induscoderules` to enforce repository-wide conventions:
```markdown
# Repository Guidelines
- All new endpoints must use Zod schemas for input validation.
- Always write accompanying unit tests in the same directory using Vitest or Bun test.
- Prefer functional components with hooks over class components.
```

### Ignore Rules (`.induscodeignore`)
Exclude sensitive files or directories from being read or indexed:
```gitignore
.env*
secrets/
dist/
build/
*.pem
```

---

## 🛠️ Monorepo Scripts Reference

| Command | Description |
| :--- | :--- |
| `bun run build:sdk` | Compiles `@induscode/core`, `@induscode/llms`, `@induscode/agents`, `@induscode/ui`, and `@induscode/shared` |
| `bun run cli` | Runs the local IndusCode CLI from source |
| `bun run dev` | Rebuilds the SDK and launches the CLI and Hub |
| `bun run types` | Performs monorepo-wide TypeScript type checking |
| `bun run test:unit` | Executes fast unit test suites across all packages |
| `bun run lint` | Runs Biome linter across the entire codebase |
| `bun run format` | Auto-formats all code according to IndusCode standards |
| `bun run clean` | Cleans build artifacts, caches, and dist directories |

---

## 📄 License

IndusCode is open-source software licensed under the [Apache License 2.0](LICENSE).

---

<div align="center">
  <sub>Built with passion for engineers building the future of software.</sub>
</div>
