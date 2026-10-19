import { cn } from "@/lib/utils";

export function ClineLogo({ className }: { className?: string }) {
	return (
		<img
			alt="IndusCode"
			className={cn("inline-block shrink-0 object-contain rounded-sm", className)}
			src="/icon.png"
		/>
	);
}
