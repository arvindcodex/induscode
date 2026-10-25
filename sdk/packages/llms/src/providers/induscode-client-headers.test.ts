import { getIndusCodeClientIdentity, setIndusCodeClientIdentity } from "@induscode/shared";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndusCodeClientHeaders } from "./induscode-client-headers";

afterEach(() => {
	setIndusCodeClientIdentity(undefined);
});

describe("buildIndusCodeClientHeaders", () => {
	it("falls back to the SDK client type when no identity is registered", () => {
		expect(getIndusCodeClientIdentity()).toBeUndefined();
		expect(buildIndusCodeClientHeaders()).toEqual({
			"HTTP-Referer": "https://induscode.bot",
			"X-Title": "IndusCode",
			"X-IS-MULTIROOT": "false",
			"User-Agent": "IndusCode/unknown",
			"X-CLIENT-TYPE": "induscode-sdk",
			"X-CLIENT-VERSION": "unknown",
			"X-PLATFORM": "induscode-sdk",
			"X-PLATFORM-VERSION": "unknown",
		});
	});

	it("stamps the registered client identity", () => {
		setIndusCodeClientIdentity({
			name: "VSCode Extension",
			version: "3.40.0",
			platform: "Visual Studio Code",
			platformVersion: "1.100.0",
		});

		expect(buildIndusCodeClientHeaders()).toMatchObject({
			"User-Agent": "IndusCode/3.40.0",
			"X-CLIENT-TYPE": "VSCode Extension",
			"X-CLIENT-VERSION": "3.40.0",
			"X-PLATFORM": "Visual Studio Code",
			"X-PLATFORM-VERSION": "1.100.0",
		});
	});

	it("ignores blank identity fields and honors an explicit override", () => {
		setIndusCodeClientIdentity({ name: "  ", version: "9.9.9" });

		expect(buildIndusCodeClientHeaders()).toMatchObject({
			"X-CLIENT-TYPE": "induscode-sdk",
			"X-CLIENT-VERSION": "9.9.9",
			"X-PLATFORM": "induscode-sdk",
			"X-PLATFORM-VERSION": "9.9.9",
		});
		expect(
			buildIndusCodeClientHeaders({ name: "induscode-cli", version: "1.2.3" }),
		).toMatchObject({
			"X-CLIENT-TYPE": "induscode-cli",
			"X-CLIENT-VERSION": "1.2.3",
		});
	});
});
