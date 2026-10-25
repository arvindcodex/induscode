import { join } from "node:path";
import { resolveIndusCodeDataDir } from "@induscode/core";
import { getCliBuildInfo } from "../utils/common";

/**
 * The CLI log file: `INDUSCODE_LOG_PATH` when set, otherwise
 * `<data dir>/logs/<cli name>.log`. The CLI logger writes here by default and
 * `induscode doctor` reads here, so both resolve the path through this function.
 */
export function resolveCliLogPath(): string {
	return (
		process.env.INDUSCODE_LOG_PATH?.trim() ||
		join(resolveIndusCodeDataDir(), "logs", `${getCliBuildInfo().name}.log`)
	);
}
