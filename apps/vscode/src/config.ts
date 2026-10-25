import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { Environment, type EnvironmentConfig } from "./shared/config-types"
import { Logger } from "./shared/services/Logger"

export { Environment } /**
 * Schema for the endpoints.json configuration file used in on-premise deployments.
 * All fields are required and must be valid URLs.
 */

interface EndpointsFileSchema {
	appBaseUrl: string
	apiBaseUrl: string
	mcpBaseUrl: string
}

/**
 * Error thrown when the IndusCode configuration file exists but is invalid.
 * This error prevents IndusCode from starting to avoid misconfiguration in enterprise environments.
 */
export class IndusCodeConfigurationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "IndusCodeConfigurationError"
	}
}

class IndusCodeEndpoint {
	private static _instance: IndusCodeEndpoint | null = null
	private static _initialized = false
	private static _extensionFsPath: string

	// On-premise config loaded from file (null if not on-premise)
	private onPremiseConfig: EndpointsFileSchema | null = null
	private environment: Environment = Environment.production
	// Track if config came from bundled file (enterprise distribution)
	private isBundled = false

	private constructor() {
		// Set environment at module load. Use override if provided.
		const _env = process?.env?.INDUSCODE_ENVIRONMENT_OVERRIDE || process?.env?.INDUSCODE_ENVIRONMENT
		if (_env && Object.values(Environment).includes(_env as Environment)) {
			this.environment = _env as Environment
		}
	}

	/**
	 * Initializes the IndusCodeEndpoint singleton.
	 * Must be called before any other methods.
	 * Reads the endpoints.json file if it exists and validates its schema.
	 *
	 * @param extensionFsPath Path to the extension installation directory (for checking bundled endpoints.json)
	 * @throws IndusCodeConfigurationError if the endpoints.json file exists but is invalid
	 */
	public static async initialize(extensionFsPath: string): Promise<void> {
		if (IndusCodeEndpoint._initialized) {
			return
		}

		IndusCodeEndpoint._extensionFsPath = extensionFsPath
		IndusCodeEndpoint._instance = new IndusCodeEndpoint()

		// Try to load on-premise config from file
		const endpointsConfig = await IndusCodeEndpoint.loadEndpointsFile()
		if (endpointsConfig) {
			IndusCodeEndpoint._instance.onPremiseConfig = endpointsConfig
			Logger.log("IndusCode running in self-hosted mode with custom endpoints")
		}

		IndusCodeEndpoint._initialized = true
	}

	/**
	 * Returns true if the IndusCodeEndpoint has been initialized.
	 */
	public static isInitialized(): boolean {
		return IndusCodeEndpoint._initialized
	}

	/**
	 * Checks if IndusCode is running in self-hosted/on-premise mode.
	 * @returns true if in selfHosted mode, or true if not initialized (safety fallback to prevent accidental external calls)
	 */
	public static isSelfHosted(): boolean {
		// Safety fallback: if not initialized, treat as selfHosted
		// to prevent accidental external service calls before configuration is loaded
		if (!IndusCodeEndpoint._initialized) {
			return true
		}
		return IndusCodeEndpoint.config.environment === Environment.selfHosted
	}

	/**
	 * Returns true if the current configuration was loaded from a bundled endpoints.json file.
	 * This indicates an enterprise distribution that should not auto-update.
	 * @throws Error if not initialized
	 */
	public static isBundledConfig(): boolean {
		if (!IndusCodeEndpoint._initialized || !IndusCodeEndpoint._instance) {
			throw new Error("IndusCodeEndpoint not initialized. Call IndusCodeEndpoint.initialize() first.")
		}
		return IndusCodeEndpoint._instance.isBundled
	}

	/**
	 * Returns the singleton instance.
	 * @throws Error if not initialized
	 */
	public static get instance(): IndusCodeEndpoint {
		if (!IndusCodeEndpoint._initialized || !IndusCodeEndpoint._instance) {
			throw new Error("IndusCodeEndpoint not initialized. Call IndusCodeEndpoint.initialize() first.")
		}
		return IndusCodeEndpoint._instance
	}

	/**
	 * Static getter for convenient access to the current configuration.
	 * @throws Error if not initialized
	 */
	public static get config(): EnvironmentConfig {
		return IndusCodeEndpoint.instance.config()
	}

	/**
	 * Returns candidates for the endpoints.json configuration file.
	 * Prioritizes ~/.induscode/endpoints.json before legacy ~/.induscode/endpoints.json.
	 */
	private static getEndpointsFileCandidates(): string[] {
		return [
			path.join(os.homedir(), ".induscode", "endpoints.json"),
			path.join(os.homedir(), ".induscode", "endpoints.json"),
		]
	}

	/**
	 * Returns the path to the bundled endpoints.json configuration file.
	 * Located in the extension installation directory.
	 */
	private static getBundledEndpointsFilePath(): string {
		return path.join(IndusCodeEndpoint._extensionFsPath, "endpoints.json")
	}

	/**
	 * Loads and validates the endpoints.json file.
	 * Checks bundled location first, then falls back to user directory.
	 * Priority: bundled endpoints.json → ~/.induscode/endpoints.json → ~/.induscode/endpoints.json → null (standard mode)
	 * @returns The validated endpoints config, or null if no file exists
	 * @throws IndusCodeConfigurationError if a file exists but is invalid
	 */
	private static async loadEndpointsFile(): Promise<EndpointsFileSchema | null> {
		// 1. Try bundled file
		const bundledPath = IndusCodeEndpoint.getBundledEndpointsFilePath()
		try {
			await fs.access(bundledPath)
			// File exists, load and validate it
			const fileContent = await fs.readFile(bundledPath, "utf8")
			let data: unknown

			try {
				data = JSON.parse(fileContent)
			} catch (parseError) {
				throw new IndusCodeConfigurationError(
					`Invalid JSON in bundled endpoints configuration file (${bundledPath}): ${parseError instanceof Error ? parseError.message : String(parseError)}`,
				)
			}

			const config = IndusCodeEndpoint.validateEndpointsSchema(data, bundledPath)
			// Mark as bundled enterprise distribution
			IndusCodeEndpoint._instance!.isBundled = true
			return config
		} catch (error) {
			if (error instanceof IndusCodeConfigurationError) {
				throw error
			}
			// Bundled file doesn't exist or is not accessible, try user file
		}

		// 2. Try ~/.induscode/endpoints.json or ~/.induscode/endpoints.json
		let userPath: string | null = null
		for (const candidate of IndusCodeEndpoint.getEndpointsFileCandidates()) {
			try {
				await fs.access(candidate)
				userPath = candidate
				break
			} catch {
				// Continue to next candidate
			}
		}

		if (!userPath) {
			// File doesn't exist - not on-premise mode
			return null
		}

		// File exists, must be valid or we fail
		try {
			const fileContent = await fs.readFile(userPath, "utf8")
			let data: unknown

			try {
				data = JSON.parse(fileContent)
			} catch (parseError) {
				throw new IndusCodeConfigurationError(
					`Invalid JSON in user endpoints configuration file (${userPath}): ${parseError instanceof Error ? parseError.message : String(parseError)}`,
				)
			}

			return IndusCodeEndpoint.validateEndpointsSchema(data, userPath)
		} catch (error) {
			if (error instanceof IndusCodeConfigurationError) {
				throw error
			}
			throw new IndusCodeConfigurationError(
				`Failed to read user endpoints configuration file (${userPath}): ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Validates that the provided data matches the EndpointsFileSchema.
	 * All fields must be present and be valid URLs.
	 *
	 * @param data The parsed JSON data to validate
	 * @param filePath The path to the file (for error messages)
	 * @returns The validated EndpointsFileSchema
	 * @throws IndusCodeConfigurationError if validation fails
	 */
	private static validateEndpointsSchema(data: unknown, filePath: string): EndpointsFileSchema {
		if (typeof data !== "object" || data === null) {
			throw new IndusCodeConfigurationError(`Endpoints configuration file (${filePath}) must contain a JSON object`)
		}

		const obj = data as Record<string, unknown>
		const requiredFields = ["appBaseUrl", "apiBaseUrl", "mcpBaseUrl"] as const
		const result: Partial<EndpointsFileSchema> = {}

		for (const field of requiredFields) {
			const value = obj[field]

			if (value === undefined || value === null) {
				throw new IndusCodeConfigurationError(
					`Missing required field "${field}" in endpoints configuration file (${filePath})`,
				)
			}

			if (typeof value !== "string") {
				throw new IndusCodeConfigurationError(
					`Field "${field}" in endpoints configuration file (${filePath}) must be a string`,
				)
			}

			if (!value.trim()) {
				throw new IndusCodeConfigurationError(
					`Field "${field}" in endpoints configuration file (${filePath}) cannot be empty`,
				)
			}

			// Validate URL format
			try {
				new URL(value)
			} catch {
				throw new IndusCodeConfigurationError(
					`Field "${field}" in endpoints configuration file (${filePath}) must be a valid URL. Got: "${value}"`,
				)
			}

			result[field] = value
		}

		return result as EndpointsFileSchema
	}

	/**
	 * Returns the current environment configuration.
	 */
	public config(): EnvironmentConfig {
		return this.getEnvironment()
	}

	/**
	 * Sets the current environment.
	 * @throws Error if in on-premise mode (environment switching is disabled)
	 */
	public setEnvironment(env: string) {
		if (this.onPremiseConfig) {
			throw new Error("Cannot change environment in on-premise mode. Endpoints are configured via ~/.induscode/endpoints.json")
		}

		switch (env.toLowerCase()) {
			case "staging":
				this.environment = Environment.staging
				break
			case "local":
				this.environment = Environment.local
				break
			default:
				this.environment = Environment.production
				break
		}
	}

	/**
	 * Returns the current environment configuration.
	 * If running in on-premise mode, returns the custom endpoints.
	 */
	public getEnvironment(): EnvironmentConfig {
		// On-premise mode: use custom endpoints from file
		if (this.onPremiseConfig) {
			return {
				environment: Environment.selfHosted,
				appBaseUrl: this.onPremiseConfig.appBaseUrl,
				apiBaseUrl: this.onPremiseConfig.apiBaseUrl,
				mcpBaseUrl: this.onPremiseConfig.mcpBaseUrl,
			}
		}

		// Standard mode: use built-in environment URLs
		switch (this.environment) {
			case Environment.staging:
				return {
					environment: Environment.staging,
					appBaseUrl: "https://staging-app.induscode.bot",
					apiBaseUrl: "https://core-api.staging.int.induscode.bot",
					mcpBaseUrl: "https://core-api.staging.int.induscode.bot/v1/mcp",
				}
			case Environment.local:
				// The local fixture's app and API share one listener. Resolve them together.
				if (process.env.INDUSCODE_LOCAL_CLOUD_URL) {
					const url = new URL(process.env.INDUSCODE_LOCAL_CLOUD_URL)
					if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password) {
						throw new IndusCodeConfigurationError("INDUSCODE_LOCAL_CLOUD_URL must be an HTTP loopback URL on 127.0.0.1")
					}
					return {
						environment: Environment.local,
						appBaseUrl: url.origin,
						apiBaseUrl: url.origin,
						mcpBaseUrl: `${url.origin}/v1/mcp`,
					}
				}
				return {
					environment: Environment.local,
					appBaseUrl: "http://localhost:3000",
					apiBaseUrl: "http://localhost:7777",
					mcpBaseUrl: "https://api.induscode.bot/v1/mcp",
				}
			default:
				return {
					environment: Environment.production,
					appBaseUrl: "https://app.induscode.bot",
					apiBaseUrl: "https://api.induscode.bot",
					mcpBaseUrl: "https://api.induscode.bot/v1/mcp",
				}
		}
	}
}

/**
 * Singleton instance to access the current environment configuration.
 * Usage:
 * - IndusCodeEnv.config() to get the current config.
 * - IndusCodeEnv.setEnvironment(Environment.local) to change the environment.
 *
 * IMPORTANT: IndusCodeEndpoint.initialize() must be called before using IndusCodeEnv.
 */
export const IndusCodeEnv = {
	config: () => IndusCodeEndpoint.config,
	setEnvironment: (env: string) => IndusCodeEndpoint.instance.setEnvironment(env),
	getEnvironment: () => IndusCodeEndpoint.instance.getEnvironment(),
}

// Export the class for initialization
export { IndusCodeEndpoint }
