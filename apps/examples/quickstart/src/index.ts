import { Agent } from "@induscode/sdk";

const agent = new Agent({
	providerId: "induscode",
	modelId: "anthropic/claude-sonnet-4.6",
	apiKey: process.env.INDUSCODE_API_KEY,
	maxIterations: 1,
});

agent.subscribe((event) => {
	if (event.type === "assistant-text-delta") {
		process.stdout.write(event.text);
	}
});

const result = await agent.run("Explain what an SDK is in two sentences.");
console.log(
	`\n\nDone (${result.iterations} iteration, ${result.usage.outputTokens} output tokens)`,
);
