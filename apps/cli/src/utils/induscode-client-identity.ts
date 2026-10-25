import { setIndusCodeClientIdentity } from "@induscode/shared";
import { getCliBuildInfo } from "./common";

export function registerIndusCodeClientIdentity(name: string): void {
	const { version } = getCliBuildInfo();
	setIndusCodeClientIdentity({
		name,
		version,
		platform: "cli",
		platformVersion: version,
	});
}
