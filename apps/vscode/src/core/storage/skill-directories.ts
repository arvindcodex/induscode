import os from "os"
import * as path from "path"

const SKILL_DIRECTORY_NAMES = {
	induscodeSkillsDir: ".induscode/skills",
	induscoderuleSkillsDir: ".induscoderules/skills",
	induscodeSkillsDir: ".induscode/skills",
	claudeSkillsDir: ".claude/skills",
	agentsSkillsDir: ".agents/skills",
} as const

export type SkillsScanDirectory = {
	path: string
	source: "project" | "global"
}

function getIndusCodeHomePath(): string {
	return process.env.INDUSCODE_DIR?.trim() || process.env.INDUSCODE_DIR?.trim() || path.join(os.homedir(), ".induscode")
}

function getIndusCodeSkillsDirectoryPath(): string {
	return path.join(getIndusCodeHomePath(), "skills")
}

function getAgentSkillsDirectoryPath(): string {
	return path.join(os.homedir(), ".agents", "skills")
}

/**
 * Returns the list of skills directories to scan without creating them.
 * Order is project directories first, then global directories.
 */
export function getSkillsDirectoriesForScan(cwd: string): SkillsScanDirectory[] {
	return [
		{ path: path.join(cwd, SKILL_DIRECTORY_NAMES.induscodeSkillsDir), source: "project" },
		{ path: path.join(cwd, SKILL_DIRECTORY_NAMES.induscoderuleSkillsDir), source: "project" },
		{ path: path.join(cwd, SKILL_DIRECTORY_NAMES.induscodeSkillsDir), source: "project" },
		{ path: path.join(cwd, SKILL_DIRECTORY_NAMES.claudeSkillsDir), source: "project" },
		{ path: path.join(cwd, SKILL_DIRECTORY_NAMES.agentsSkillsDir), source: "project" },
		{ path: getIndusCodeSkillsDirectoryPath(), source: "global" },
		{ path: path.join(os.homedir(), ".induscode", "skills"), source: "global" },
		{ path: getAgentSkillsDirectoryPath(), source: "global" },
	]
}
