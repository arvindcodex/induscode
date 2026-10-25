import { NodeHubClient } from "../../../../dist/hub/index.js";

const url = process.env.INDUSCODE_TEST_HUB_URL;
const authorization = process.env.INDUSCODE_TEST_HUB_AUTHORIZATION;
if (!url || !authorization) {
	throw new Error("Missing INDUSCODE_TEST_HUB_URL or INDUSCODE_TEST_HUB_AUTHORIZATION");
}

const client = new NodeHubClient({
	url,
	resolveConnectionHeaders: () => ({ Authorization: authorization }),
});

try {
	await client.connect();
	console.log(`connected under ${process.versions.bun ? "Bun" : "Node"}`);
} finally {
	client.close();
}
