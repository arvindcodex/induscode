import { Mode } from "@shared/storage/types"
import { IndusCodeAccountInfoCard } from "../IndusCodeAccountInfoCard"
import IndusCodeModelPicker from "../IndusCodeModelPicker"

/**
 * Props for the IndusCodeProvider component
 */
interface IndusCodeProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
	initialModelTab?: "recommended" | "free"
}

/**
 * The IndusCode provider configuration component
 */
export const IndusCodeProvider = ({ showModelOptions, isPopup, currentMode, initialModelTab }: IndusCodeProviderProps) => {
	return (
		<div>
			{/* IndusCode Account Info Card */}
			<div style={{ marginBottom: 14, marginTop: 4 }}>
				<IndusCodeAccountInfoCard />
			</div>

			{showModelOptions && (
				<IndusCodeModelPicker
					currentMode={currentMode}
					initialTab={initialModelTab}
					isPopup={isPopup}
					showProviderRouting={true}
				/>
			)}
		</div>
	)
}
