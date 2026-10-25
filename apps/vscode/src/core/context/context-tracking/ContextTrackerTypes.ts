// Type definitions for FileContextTracker
export interface FileMetadataEntry {
	path: string
	record_state: "active" | "stale"
	record_source: "read_tool" | "user_edited" | "induscode_edited" | "file_mentioned"
	induscode_read_date: number | null
	induscode_edit_date: number | null
	user_edit_date?: number | null
}

interface ModelMetadataEntry {
	ts: number
	model_id: string
	model_provider_id: string
	mode: string
}

interface EnvironmentMetadataEntry {
	ts: number
	os_name: string
	os_version: string
	os_arch: string
	host_name: string
	host_version: string
	induscode_version: string
}

export interface TaskMetadata {
	files_in_context: FileMetadataEntry[]
	model_usage: ModelMetadataEntry[]
	environment_history: EnvironmentMetadataEntry[]
}
