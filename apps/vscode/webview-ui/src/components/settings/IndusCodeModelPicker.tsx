import { openAiModelInfoSafeDefaults } from "@shared/api"
import { INDUSCODE_RECOMMENDED_MODELS_FALLBACK } from "@shared/induscode/recommended-models"
import { EmptyRequest, StringRequest } from "@shared/proto/induscode/common"
import { type IndusCodeRecommendedModel, IndusCodeRecommendedModelsResponse } from "@shared/proto/induscode/models"
import { fromProtobufModelInfo } from "@shared/proto-conversions/models/typeConversion"
import type { Mode } from "@shared/storage/types"
import { isClaudeOpusAdaptiveThinkingModel, resolveClaudeOpusAdaptiveThinking } from "@shared/utils/reasoning-support"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import Fuse from "fuse.js"
import type React from "react"
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import styled from "styled-components"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useDynamicProviderSelection } from "@/hooks/useDynamicProviderSelection"
import { useProviderConfig } from "@/hooks/useProviderConfig"
import { useProviderModels } from "@/hooks/useProviderModels"
import { ModelsServiceClient, StateServiceClient } from "@/services/grpc-client"
import { highlight } from "../history/HistoryView"
import { ModelInfoView } from "./common/ModelInfoView"
import FeaturedModelCard from "./FeaturedModelCard"
import ReasoningEffortSelector from "./ReasoningEffortSelector"
import { filterOpenRouterModelIds, getModeSpecificFields } from "./utils/providerUtils"
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"

// Star icon for favorites
const StarIcon = ({ isFavorite, onClick }: { isFavorite: boolean; onClick: (e: React.MouseEvent) => void }) => {
	return (
		<button
			onClick={onClick}
			style={{
				background: "none",
				border: "none",
				padding: 0,
				cursor: "pointer",
				color: isFavorite ? "var(--vscode-terminal-ansiBlue)" : "var(--vscode-descriptionForeground)",
				marginLeft: "8px",
				fontSize: "16px",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				userSelect: "none",
				WebkitUserSelect: "none",
			}}
			type="button">
			{isFavorite ? "★" : "☆"}
		</button>
	)
}

interface IndusCodeModelPickerProps {
	isPopup?: boolean
	currentMode: Mode
	showProviderRouting?: boolean
	initialTab?: "recommended" | "free"
}

interface FeaturedModelCardEntry {
	id: string
	name?: string
	description: string
	label: string
}

const INDUSCODE_RECOMMENDED_MODELS_RETRY_DELAY_MS = 5000

function normalizeModelId(modelId: string): string {
	return modelId.trim().toLowerCase()
}

function toFeaturedModelCardEntry(
	model: Pick<IndusCodeRecommendedModel, "id" | "name" | "description" | "tags">,
	fallbackLabel: string,
): FeaturedModelCardEntry | null {
	if (!model.id) {
		return null
	}

	const firstTag = model.tags?.[0]
	let normalizedLabel = typeof firstTag === "string" && firstTag.length > 0 ? firstTag.toUpperCase() : undefined
	if (
		normalizedLabel &&
		(normalizedLabel.includes("GROQ") ||
			normalizedLabel.includes("GEMINI") ||
			normalizedLabel.includes("CLOUDFLARE") ||
			normalizedLabel.includes("COHERE") ||
			normalizedLabel.includes("NVIDIA") ||
			normalizedLabel.includes("OPENROUTER") ||
			normalizedLabel.includes("FREE") ||
			normalizedLabel.includes("TIER") ||
			normalizedLabel.includes("APINEX"))
	) {
		normalizedLabel = undefined
	}

	const effectiveFallback = fallbackLabel === "FREE" ? "STANDARD" : fallbackLabel

	return {
		id: model.id,
		name: (model.name || model.id)
			.replace(/\s*\((?:free|FREE|Free Tier|free tier|Groq|GROQ|Groq LPU|Groq Fast|Groq 32k|Apinex|Cloudflare|NVIDIA NIM|OpenRouter Free)\)/gi, "")
			.replace(/^free\//i, "")
			.trim(),
		description: model.description || (effectiveFallback === "STANDARD" ? "High-performance inference model" : "Recommended model"),
		label: normalizedLabel || effectiveFallback,
	}
}

const RECOMMENDED_MODELS_FALLBACK: FeaturedModelCardEntry[] = INDUSCODE_RECOMMENDED_MODELS_FALLBACK.recommended
	.map((model) => toFeaturedModelCardEntry(model, "RECOMMENDED"))
	.filter((model): model is FeaturedModelCardEntry => model !== null)

const FREE_MODELS_FALLBACK: FeaturedModelCardEntry[] = INDUSCODE_RECOMMENDED_MODELS_FALLBACK.free
	.map((model) => toFeaturedModelCardEntry(model, "STANDARD"))
	.filter((model): model is FeaturedModelCardEntry => model !== null)

const IndusCodeModelPicker: React.FC<IndusCodeModelPickerProps> = ({ isPopup, currentMode, showProviderRouting, initialTab }) => {
	const { handleModeFieldsChange, handleFieldChange } = useApiConfigurationHandlers()
	const { apiConfiguration, favoritedModelIds } = useExtensionState()
	const { models: catalogIndusCodeModels, defaultModelId: induscodeDefaultModelId } = useProviderModels("induscode")
	const { config, write: writeProviderConfig, commitSelection } = useProviderConfig("induscode")
	const modeFields = getModeSpecificFields(apiConfiguration, currentMode)
	const effectiveIndusCodeModels = catalogIndusCodeModels
	const committedSelection = currentMode === "plan" ? config?.planSelection : config?.actSelection
	const committedModelInfo = committedSelection?.modelInfo ? fromProtobufModelInfo(committedSelection.modelInfo) : undefined
	const currentIndusCodeModelId =
		committedSelection?.modelId ||
		modeFields.induscodeModelId ||
		induscodeDefaultModelId ||
		Object.keys(effectiveIndusCodeModels ?? {})[0] ||
		""
	const [searchTerm, setSearchTerm] = useState(currentIndusCodeModelId)
	const searchTermEditedByUserRef = useRef(false)
	const [isDropdownVisible, setIsDropdownVisible] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const [induscodeRecommendedModels, setIndusCodeRecommendedModels] = useState<FeaturedModelCardEntry[]>([])
	const [induscodeFreeModels, setIndusCodeFreeModels] = useState<FeaturedModelCardEntry[]>([])
	const freeIndusCodeModelIds = useMemo(() => {
		const freeModelIds =
			induscodeFreeModels.length > 0 ? induscodeFreeModels.map((model) => model.id) : FREE_MODELS_FALLBACK.map((model) => model.id)
		return [...new Set(freeModelIds)]
	}, [induscodeFreeModels])
	const freeIndusCodeModelIdSet = useMemo(
		() => new Set(freeIndusCodeModelIds.map((modelId) => normalizeModelId(modelId))),
		[freeIndusCodeModelIds],
	)
	const [activeTab, setActiveTab] = useState<"recommended" | "free">(initialTab ?? "recommended")
	const recommendedModels = useMemo(
		() => (induscodeRecommendedModels.length > 0 ? induscodeRecommendedModels : RECOMMENDED_MODELS_FALLBACK),
		[induscodeRecommendedModels],
	)
	const freeModels = useMemo(() => (induscodeFreeModels.length > 0 ? induscodeFreeModels : FREE_MODELS_FALLBACK), [induscodeFreeModels])
	const hasSuccessfulIndusCodeRecommendedModelsFetchRef = useRef(false)
	const isFetchingIndusCodeRecommendedModelsRef = useRef(false)
	const induscodeRecommendedModelsRetryTimeoutRef = useRef<number | null>(null)

	const refreshIndusCodeRecommendedModels = useCallback(async (): Promise<boolean> => {
		try {
			const response = await ModelsServiceClient.makeUnaryRequest(
				"refreshIndusCodeRecommendedModelsRpc",
				EmptyRequest.create({}),
				EmptyRequest.toJSON,
				IndusCodeRecommendedModelsResponse.fromJSON,
			)
			const recommended = (response.recommended ?? [])
				.map((model) => toFeaturedModelCardEntry(model, "RECOMMENDED"))
				.filter((model): model is FeaturedModelCardEntry => model !== null)
			const free = (response.free ?? [])
				.map((model) => toFeaturedModelCardEntry(model, "STANDARD"))
				.filter((model): model is FeaturedModelCardEntry => model !== null)
			setIndusCodeRecommendedModels(recommended)
			setIndusCodeFreeModels(free)
			return true
		} catch (error) {
			console.error("Failed to refresh IndusCode recommended models:", error)
			return false
		}
	}, [])

	const clearIndusCodeRecommendedModelsRetryTimeout = useCallback(() => {
		if (induscodeRecommendedModelsRetryTimeoutRef.current !== null) {
			window.clearTimeout(induscodeRecommendedModelsRetryTimeoutRef.current)
			induscodeRecommendedModelsRetryTimeoutRef.current = null
		}
	}, [])

	const fetchIndusCodeRecommendedModels = useCallback(async () => {
		if (hasSuccessfulIndusCodeRecommendedModelsFetchRef.current || isFetchingIndusCodeRecommendedModelsRef.current) {
			return
		}
		isFetchingIndusCodeRecommendedModelsRef.current = true
		const succeeded = await refreshIndusCodeRecommendedModels()
		isFetchingIndusCodeRecommendedModelsRef.current = false

		if (succeeded) {
			hasSuccessfulIndusCodeRecommendedModelsFetchRef.current = true
			clearIndusCodeRecommendedModelsRetryTimeout()
			return
		}

		if (induscodeRecommendedModelsRetryTimeoutRef.current === null) {
			induscodeRecommendedModelsRetryTimeoutRef.current = window.setTimeout(() => {
				induscodeRecommendedModelsRetryTimeoutRef.current = null
				void fetchIndusCodeRecommendedModels()
			}, INDUSCODE_RECOMMENDED_MODELS_RETRY_DELAY_MS)
		}
	}, [clearIndusCodeRecommendedModelsRetryTimeout, refreshIndusCodeRecommendedModels])

	useEffect(() => {
		return () => {
			clearIndusCodeRecommendedModelsRetryTimeout()
		}
	}, [clearIndusCodeRecommendedModelsRetryTimeout])

	useEffect(() => {
		if (initialTab) {
			setActiveTab(initialTab)
		}
	}, [initialTab])

	useEffect(() => {
		if (initialTab) {
			return
		}
		setActiveTab(freeIndusCodeModelIdSet.has(normalizeModelId(currentIndusCodeModelId)) ? "free" : "recommended")
	}, [currentIndusCodeModelId, freeIndusCodeModelIdSet, initialTab])
	const dropdownRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLDivElement | null)[]>([])
	const dropdownListRef = useRef<HTMLDivElement>(null)

	const handleModelChange = (newModelId: string) => {
		searchTermEditedByUserRef.current = false
		setSearchTerm(newModelId)

		const modelInfo = effectiveIndusCodeModels?.[newModelId] ?? {
			...openAiModelInfoSafeDefaults,
			name: newModelId,
		}

		void commitSelection(currentMode, {
			providerId: "induscode",
			modelId: newModelId,
		}).catch((err) => console.error("Failed to commit IndusCode model selection:", err))

		void handleModeFieldsChange(
			{
				induscodeModelId: {
					plan: "planModeIndusCodeModelId",
					act: "actModeIndusCodeModelId",
				},
				induscodeModelInfo: {
					plan: "planModeIndusCodeModelInfo",
					act: "actModeIndusCodeModelInfo",
				},
			},
			{
				induscodeModelId: newModelId,
				induscodeModelInfo: modelInfo,
			},
			currentMode,
		)
	}

	const baseSelection = useDynamicProviderSelection("induscode", apiConfiguration, currentMode)
	const { selectedModelId, selectedModelInfo } = useMemo(() => {
		const selected = {
			selectedProvider: "induscode" as const,
			selectedModelId: baseSelection.selectedModelId,
			selectedModelInfo: baseSelection.selectedModelInfo,
		}
		const selectedWithCatalogDefault = currentIndusCodeModelId
			? {
					...selected,
					selectedModelId: currentIndusCodeModelId,
					selectedModelInfo: (() => {
						const persistedModelInfo = committedModelInfo || modeFields.induscodeModelInfo || selected.selectedModelInfo
						const liveModelInfo = effectiveIndusCodeModels?.[currentIndusCodeModelId]
						// Persisted IndusCode model info is a snapshot from selection time. When the
						// model is still in the catalog, refresh metadata/capability flags from
						// the live catalog so UI controls reflect current model support.
						return liveModelInfo ? { ...persistedModelInfo, ...liveModelInfo } : persistedModelInfo
					})(),
				}
			: selected
		if (freeIndusCodeModelIdSet.has(normalizeModelId(selectedWithCatalogDefault.selectedModelId))) {
			return {
				...selectedWithCatalogDefault,
				selectedModelInfo: {
					...selectedWithCatalogDefault.selectedModelInfo,
					inputPrice: 0,
					outputPrice: 0,
					cacheReadsPrice: 0,
					cacheWritesPrice: 0,
				},
			}
		}
		return selectedWithCatalogDefault
	}, [
		baseSelection.selectedModelId,
		baseSelection.selectedModelInfo,
		committedModelInfo,
		currentIndusCodeModelId,
		effectiveIndusCodeModels,
		freeIndusCodeModelIdSet,
		modeFields.induscodeModelInfo,
	])

	useEffect(() => {
		void fetchIndusCodeRecommendedModels()
	}, [fetchIndusCodeRecommendedModels])

	// Sync external changes when the modelId changes
	useEffect(() => {
		searchTermEditedByUserRef.current = false
		setSearchTerm(currentIndusCodeModelId)
	}, [currentIndusCodeModelId])

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownVisible(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [])

	const modelIds = useMemo(() => {
		const unfilteredModelIds = Object.keys(effectiveIndusCodeModels ?? {}).sort((a, b) => a.localeCompare(b))
		return filterOpenRouterModelIds(unfilteredModelIds, "induscode", freeIndusCodeModelIds)
	}, [effectiveIndusCodeModels, freeIndusCodeModelIds])

	const searchableItems = useMemo(() => {
		return modelIds.map((id) => ({
			id,
			html: id,
		}))
	}, [modelIds])

	const fuse = useMemo(() => {
		return new Fuse(searchableItems, {
			keys: ["html"], // highlight function will update this
			threshold: 0.6,
			shouldSort: true,
			isCaseSensitive: false,
			ignoreLocation: false,
			includeMatches: true,
			minMatchCharLength: 1,
		})
	}, [searchableItems])

	const modelSearchResults = useMemo(() => {
		// First, get all favorited models
		const favoritedModels = searchableItems.filter((item) => favoritedModelIds.includes(item.id))

		// Then get search results for non-favorited models
		const searchResults = searchTerm
			? highlight(fuse.search(searchTerm), "model-item-highlight").filter((item) => !favoritedModelIds.includes(item.id))
			: searchableItems.filter((item) => !favoritedModelIds.includes(item.id))

		// Combine favorited models with search results
		return [...favoritedModels, ...searchResults]
	}, [searchableItems, searchTerm, fuse, favoritedModelIds])

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!isDropdownVisible) {
			return
		}

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault()
				setSelectedIndex((prev) => (prev < modelSearchResults.length - 1 ? prev + 1 : prev))
				break
			case "ArrowUp":
				event.preventDefault()
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
				break
			case "Enter":
				event.preventDefault()
				if (selectedIndex >= 0 && selectedIndex < modelSearchResults.length) {
					handleModelChange(modelSearchResults[selectedIndex].id)
					setIsDropdownVisible(false)
				} else {
					handleModelChange(searchTerm)
					setIsDropdownVisible(false)
				}
				break
			case "Escape":
				setIsDropdownVisible(false)
				setSelectedIndex(-1)
				break
		}
	}

	const hasInfo = useMemo(() => {
		try {
			return modelIds.some((id) => id.toLowerCase() === searchTerm.toLowerCase())
		} catch {
			return false
		}
	}, [modelIds, searchTerm])

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset dropdown navigation whenever the search text changes
	useEffect(() => {
		setSelectedIndex(-1)
		if (dropdownListRef.current) {
			dropdownListRef.current.scrollTop = 0
		}
	}, [searchTerm])

	useEffect(() => {
		if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
			itemRefs.current[selectedIndex]?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			})
		}
	}, [selectedIndex])

	const showAdaptiveThinkingEffort = useMemo(() => isClaudeOpusAdaptiveThinkingModel(selectedModelId), [selectedModelId])
	const adaptiveThinkingDefaultEffort = useMemo(
		() => resolveClaudeOpusAdaptiveThinking(modeFields.reasoningEffort, modeFields.thinkingBudgetTokens).effort ?? "none",
		[modeFields.reasoningEffort, modeFields.thinkingBudgetTokens],
	)
	// Show reasoning effort selector for all models that support reasoning,
	// using the SDK catalog's supportsReasoning capability flag.
	const showReasoningEffort = useMemo(
		() => showAdaptiveThinkingEffort || selectedModelInfo?.supportsReasoning === true,
		[showAdaptiveThinkingEffort, selectedModelInfo?.supportsReasoning],
	)

	return (
		<div style={{ width: "100%", paddingBottom: 2 }}>
			<style>
				{`
				.model-item-highlight {
					background-color: var(--vscode-editor-findMatchHighlightBackground);
					color: inherit;
				}
				`}
			</style>
			<div style={{ display: "flex", flexDirection: "column" }}>
				<label htmlFor="model-search">
					<span style={{ fontWeight: 500 }}>Model</span>
				</label>

				{/* Tabs */}
				<TabsContainer style={{ marginTop: 4 }}>
					<Tab active={activeTab === "recommended"} onClick={() => setActiveTab("recommended")}>
						Recommended
					</Tab>
					<Tab active={activeTab === "free"} onClick={() => setActiveTab("free")}>
						Standard
					</Tab>
				</TabsContainer>

				{/* Model Cards */}
				<div style={{ marginBottom: "6px" }}>
					{activeTab === "recommended" &&
						recommendedModels.map((model) => (
							<FeaturedModelCard
								description={model.description}
								displayName={model.name || model.id}
								isSelected={selectedModelId === model.id}
								key={model.id}
								label={model.label}
								onClick={() => {
									handleModelChange(model.id)
									setIsDropdownVisible(false)
								}}
							/>
						))}
					{activeTab === "free" &&
						freeModels.map((model) => (
							<FeaturedModelCard
								description={model.description}
								displayName={model.name || model.id}
								isSelected={selectedModelId === model.id}
								key={model.id}
								label={model.label}
								onClick={() => {
									handleModelChange(model.id)
									setIsDropdownVisible(false)
								}}
							/>
						))}
				</div>

				<DropdownWrapper ref={dropdownRef}>
					<VSCodeTextField
						id="model-search"
						key={currentIndusCodeModelId}
						onBlur={() => {
							if (searchTermEditedByUserRef.current && searchTerm !== selectedModelId) {
								handleModelChange(searchTerm)
							}
						}}
						onFocus={() => setIsDropdownVisible(true)}
						onInput={(e) => {
							searchTermEditedByUserRef.current = true
							setSearchTerm((e.target as HTMLInputElement)?.value.toLowerCase() || "")
							setIsDropdownVisible(true)
						}}
						onKeyDown={handleKeyDown}
						placeholder="Search and select a model..."
						role="combobox"
						style={{
							width: "100%",
							zIndex: INDUSCODE_MODEL_PICKER_Z_INDEX,
							position: "relative",
						}}
						value={searchTerm}>
						{searchTerm && (
							<button
								aria-label="Clear search"
								className="input-icon-button codicon codicon-close"
								onClick={() => {
									setSearchTerm("")
									setIsDropdownVisible(true)
								}}
								slot="end"
								style={{
									background: "none",
									border: "none",
									padding: 0,
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
									height: "100%",
								}}
								type="button"
							/>
						)}
					</VSCodeTextField>
					{isDropdownVisible && (
						<DropdownList ref={dropdownListRef} role="listbox">
							{modelSearchResults.map((item, index) => {
								const isFavorite = (favoritedModelIds || []).includes(item.id)
								return (
									<DropdownItem
										isSelected={index === selectedIndex}
										key={item.id}
										onClick={() => {
											handleModelChange(item.id)
											setIsDropdownVisible(false)
										}}
										onMouseEnter={() => setSelectedIndex(index)}
										ref={(el) => (itemRefs.current[index] = el)}
										role="option">
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
											}}>
											{/* biome-ignore lint/security/noDangerouslySetInnerHtml: highlight() returns sanitized model-id markup for matched search text */}
											<span dangerouslySetInnerHTML={{ __html: item.html }} />
											<StarIcon
												isFavorite={isFavorite}
												onClick={(e) => {
													e.stopPropagation()
													StateServiceClient.toggleFavoriteModel(
														StringRequest.create({ value: item.id }),
													).catch((error) => console.error("Failed to toggle favorite model:", error))
												}}
											/>
										</div>
									</DropdownItem>
								)
							})}
						</DropdownList>
					)}
				</DropdownWrapper>
			</div>

			{hasInfo ? (
				<>
					{showReasoningEffort && (
						<ReasoningEffortSelector
							allowedEfforts={
								showAdaptiveThinkingEffort ? (["none", "low", "medium", "high", "xhigh"] as const) : undefined
							}
							currentMode={currentMode}
							defaultEffort={showAdaptiveThinkingEffort ? adaptiveThinkingDefaultEffort : "medium"}
							description={
								showAdaptiveThinkingEffort
									? "Use None to disable adaptive thinking. Higher effort increases response detail and token usage."
									: undefined
							}
							label={showAdaptiveThinkingEffort ? "Adaptive Thinking" : undefined}
							onEffortChange={(effort) => {
								writeProviderConfig({
									reasoning: {
										enabled: effort !== "none",
										effort: effort !== "none" ? effort : undefined,
									},
								})
							}}
						/>
					)}

					<ModelInfoView
						isPopup={isPopup}
						modelInfo={selectedModelInfo}
						onProviderSortingChange={(value) => handleFieldChange("openRouterProviderSorting", value)}
						providerSorting={apiConfiguration?.openRouterProviderSorting}
						selectedModelId={selectedModelId}
						showProviderRouting={showProviderRouting}
					/>
				</>
			) : (
				<p
					style={{
						fontSize: "12px",
						marginTop: 0,
						color: "var(--vscode-descriptionForeground)",
					}}>
					The extension automatically fetches the latest IndusCode model list.
				</p>
			)}
		</div>
	)
}

export default IndusCodeModelPicker

const DropdownWrapper = styled.div`
	position: relative;
	width: 100%;
`

const INDUSCODE_MODEL_PICKER_Z_INDEX = 1_000

const DropdownList = styled.div`
	position: absolute;
	top: calc(100% - 3px);
	left: 0;
	width: calc(100% - 2px);
	max-height: 200px;
	overflow-y: auto;
	background-color: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-list-activeSelectionBackground);
	z-index: ${INDUSCODE_MODEL_PICKER_Z_INDEX - 1};
	border-bottom-left-radius: 3px;
	border-bottom-right-radius: 3px;
`

const DropdownItem = styled.div<{ isSelected: boolean }>`
	padding: 5px 10px;
	cursor: pointer;
	word-break: break-all;
	white-space: normal;

	background-color: ${({ isSelected }) => (isSelected ? "var(--vscode-list-activeSelectionBackground)" : "inherit")};
	color: ${({ isSelected }) => (isSelected ? "var(--vscode-list-activeSelectionForeground, inherit)" : "inherit")};

	&:hover {
		background-color: var(--vscode-list-activeSelectionBackground);
		color: var(--vscode-list-activeSelectionForeground, inherit);
	}
`

const TabsContainer = styled.div`
	display: flex;
	gap: 0;
	margin-bottom: 12px;
	border-bottom: 1px solid #333;
`

const Tab = styled.div<{ active: boolean }>`
	padding: 8px 16px;
	cursor: pointer;
	font-size: 12px;
	font-weight: 500;
	color: ${({ active }) => (active ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)")};
	border-bottom: 2px solid ${({ active }) => (active ? "var(--vscode-textLink-foreground)" : "transparent")};
	transition: all 0.15s ease;

	&:hover {
		color: var(--vscode-foreground);
	}
`
