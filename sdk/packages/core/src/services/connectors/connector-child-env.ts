import {
	INDUSCODE_CONNECTOR_STARTING_INSTANCE_ENV,
	INDUSCODE_RUN_AS_HUB_DAEMON_ENV,
} from "@induscode/shared";

/**
 * Env markers a connector sets on its own detached child: the shared
 * `INDUSCODE_CONNECTOR_DETACHED_CHILD` plus one per adapter
 * (`INDUSCODE_SLACK_CONNECT_CHILD`, `INDUSCODE_TELEGRAM_CONNECT_CHILD`, ...). They are
 * owned by the CLI, so match them by shape rather than importing upward.
 */
const CONNECTOR_CHILD_MARKER_PATTERN =
	/^INDUSCODE_(?:CONNECTOR_DETACHED_CHILD|[A-Z0-9]+_CONNECT_CHILD)$/;

/**
 * Environment for a CLI process the hub daemon launches.
 *
 * The daemon inherits the environment of whichever connector spawned it, and
 * those inherited markers are actively harmful downstream: the daemon sentinel
 * would make the child try to become a hub, and a child marker tells a connector
 * "you are already the detached child", which makes it skip its own
 * already-running check and start alongside a live instance holding the same
 * credentials.
 */
export function buildConnectorChildEnv(
	env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const childEnv = { ...env };
	delete childEnv[INDUSCODE_RUN_AS_HUB_DAEMON_ENV];
	delete childEnv[INDUSCODE_CONNECTOR_STARTING_INSTANCE_ENV];
	for (const key of Object.keys(childEnv)) {
		if (CONNECTOR_CHILD_MARKER_PATTERN.test(key)) {
			delete childEnv[key];
		}
	}
	return childEnv;
}

export const __test__ = { CONNECTOR_CHILD_MARKER_PATTERN };
