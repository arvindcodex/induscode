"use client";

import { clsx } from "clsx";
import {
	type ComponentPropsWithoutRef,
	createContext,
	forwardRef,
	useContext,
} from "react";

/** Presentation only. Hosts retain drafts, input events, menus, and runtime actions. */
export type AgentComposerVariant = "welcome" | "conversation";
type VariantProps = { variant?: AgentComposerVariant };

const AgentComposerVariantContext =
	createContext<AgentComposerVariant>("conversation");

function useAgentComposerVariant(variant?: AgentComposerVariant) {
	const inheritedVariant = useContext(AgentComposerVariantContext);
	return variant ?? inheritedVariant;
}

export type AgentComposerProps = ComponentPropsWithoutRef<"div"> & VariantProps;

export const AgentComposer = forwardRef<HTMLDivElement, AgentComposerProps>(
	function AgentComposer(
		{ variant = "conversation", className, ...props },
		ref,
	) {
		return (
			<AgentComposerVariantContext.Provider value={variant}>
				<div
					{...props}
					ref={ref}
					className={clsx(
						variant === "welcome"
							? "overflow-visible rounded-induscode-ui-xl border border-induscode-ui-border/90 bg-induscode-ui-surface-1/40 shadow-[0_24px_80px_-56px_color-mix(in_oklab,var(--primary)_72%,transparent)] backdrop-blur-md"
							: "overflow-visible rounded-induscode-ui-xl border border-induscode-ui-border bg-induscode-ui-surface-2 backdrop-blur-sm focus-within:border-induscode-ui-primary/50 focus-within:ring-1 focus-within:ring-induscode-ui-primary/20",
						className,
					)}
				/>
			</AgentComposerVariantContext.Provider>
		);
	},
);

export type AgentComposerBodyProps = ComponentPropsWithoutRef<"div"> &
	VariantProps & { hasQueue?: boolean };

export const AgentComposerBody = forwardRef<
	HTMLDivElement,
	AgentComposerBodyProps
>(function AgentComposerBody(
	{ variant: variantProp, hasQueue = false, className, ...props },
	ref,
) {
	const variant = useAgentComposerVariant(variantProp);
	return (
		<div
			{...props}
			ref={ref}
			className={clsx(
				variant === "welcome"
					? "px-4 py-3 pb-2 pt-4"
					: hasQueue
						? "px-4 py-3 pb-4 pt-0"
						: "px-4 py-4",
				className,
			)}
		/>
	);
});

export type AgentComposerFieldProps = ComponentPropsWithoutRef<"div"> &
	VariantProps;

export const AgentComposerField = forwardRef<
	HTMLDivElement,
	AgentComposerFieldProps
>(function AgentComposerField(
	{ variant: variantProp, className, ...props },
	ref,
) {
	const variant = useAgentComposerVariant(variantProp);
	return (
		<div
			{...props}
			ref={ref}
			className={clsx(
				variant === "welcome"
					? "flex items-end gap-2 border-induscode-ui-border focus-within:border-induscode-ui-primary/50 focus-within:ring-induscode-ui-primary/20 min-h-16 rounded-none border-0 bg-transparent px-0 py-0 focus-within:ring-0"
					: "flex gap-2 border-induscode-ui-border focus-within:ring-induscode-ui-primary/20 min-h-24 items-start rounded-none border-0 bg-transparent px-0 py-0 focus-within:border-transparent focus-within:ring-0",
				className,
			)}
		/>
	);
});

export type AgentComposerTextareaProps = ComponentPropsWithoutRef<"textarea"> &
	VariantProps;

export const AgentComposerTextarea = forwardRef<
	HTMLTextAreaElement,
	AgentComposerTextareaProps
>(function AgentComposerTextarea(
	{ variant: variantProp, className, ...props },
	ref,
) {
	const variant = useAgentComposerVariant(variantProp);
	return (
		<textarea
			{...props}
			ref={ref}
			className={clsx(
				variant === "welcome"
					? "field-sizing-content flex-1 resize-none overflow-y-auto bg-transparent text-induscode-ui-sm leading-5 text-induscode-ui-foreground placeholder:text-induscode-ui-muted-foreground outline-none self-start"
					: "field-sizing-content flex-1 resize-none overflow-y-auto bg-transparent text-induscode-ui-sm leading-5 text-induscode-ui-foreground placeholder:text-induscode-ui-muted-foreground outline-none",
				className,
			)}
		/>
	);
});

export type AgentComposerActionsProps = ComponentPropsWithoutRef<"div"> &
	VariantProps;

export const AgentComposerActions = forwardRef<
	HTMLDivElement,
	AgentComposerActionsProps
>(function AgentComposerActions(
	{ variant: variantProp, className, ...props },
	ref,
) {
	const variant = useAgentComposerVariant(variantProp);
	return (
		<div
			{...props}
			ref={ref}
			className={clsx(
				variant === "welcome"
					? "flex shrink-0 items-center gap-2"
					: "flex shrink-0 items-center gap-2 self-end",
				className,
			)}
		/>
	);
});

export type AgentComposerStopButtonProps = ComponentPropsWithoutRef<"button"> &
	VariantProps;

export const AgentComposerStopButton = forwardRef<
	HTMLButtonElement,
	AgentComposerStopButtonProps
>(function AgentComposerStopButton(
	{ variant: variantProp, className, ...props },
	ref,
) {
	const variant = useAgentComposerVariant(variantProp);
	return (
		<button
			{...props}
			ref={ref}
			className={clsx(
				"inline-flex size-7 shrink-0 items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-induscode-ui-focus-ring",
				variant === "welcome"
					? "bg-induscode-ui-foreground p-1 text-induscode-ui-background hover:bg-induscode-ui-destructive hover:text-induscode-ui-destructive-foreground rounded-induscode-ui-md active:scale-95"
					: "bg-induscode-ui-foreground p-1 text-induscode-ui-background hover:bg-induscode-ui-destructive hover:text-induscode-ui-destructive-foreground rounded-full active:scale-95",
				className,
			)}
		/>
	);
});

export type AgentComposerSendButtonProps = ComponentPropsWithoutRef<"button"> &
	VariantProps;

export const AgentComposerSendButton = forwardRef<
	HTMLButtonElement,
	AgentComposerSendButtonProps
>(function AgentComposerSendButton(
	{ variant: variantProp, className, ...props },
	ref,
) {
	const variant = useAgentComposerVariant(variantProp);
	return (
		<button
			{...props}
			ref={ref}
			className={clsx(
				"inline-flex size-7 shrink-0 items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-induscode-ui-focus-ring disabled:cursor-not-allowed",
				variant === "welcome"
					? "rounded-induscode-ui-md bg-induscode-ui-primary text-induscode-ui-primary-foreground shadow-sm hover:opacity-90 active:scale-95 disabled:bg-induscode-ui-muted/60 disabled:text-induscode-ui-muted-foreground/40 disabled:shadow-none disabled:active:scale-100"
					: "rounded-full bg-induscode-ui-primary text-induscode-ui-primary-foreground shadow-sm hover:opacity-90 active:scale-95 disabled:bg-induscode-ui-muted/60 disabled:text-induscode-ui-muted-foreground/40 disabled:shadow-none disabled:active:scale-100",
				className,
			)}
		/>
	);
});

export type AgentComposerAttachmentsProps = ComponentPropsWithoutRef<"div">;

export const AgentComposerAttachments = forwardRef<
	HTMLDivElement,
	AgentComposerAttachmentsProps
>(function AgentComposerAttachments({ className, ...props }, ref) {
	return (
		<div
			{...props}
			ref={ref}
			className={clsx("mt-2 flex flex-wrap gap-1.5", className)}
		/>
	);
});

export type AgentComposerSettingsProps = ComponentPropsWithoutRef<"div">;

export const AgentComposerSettings = forwardRef<
	HTMLDivElement,
	AgentComposerSettingsProps
>(function AgentComposerSettings({ className, ...props }, ref) {
	return (
		<div
			{...props}
			ref={ref}
			className={clsx(
				"flex min-w-0 items-center justify-between gap-x-3 gap-y-2 rounded-b-induscode-ui-xl border-t border-induscode-ui-border bg-induscode-ui-muted/20 px-2 py-2 text-induscode-ui-sm text-induscode-ui-muted-foreground",
				className,
			)}
		/>
	);
});

export type AgentComposerSettingsGroupProps = ComponentPropsWithoutRef<"div">;

export const AgentComposerSettingsGroup = forwardRef<
	HTMLDivElement,
	AgentComposerSettingsGroupProps
>(function AgentComposerSettingsGroup({ className, ...props }, ref) {
	return (
		<div
			{...props}
			ref={ref}
			className={clsx("flex min-w-0 flex-auto items-center gap-2", className)}
		/>
	);
});

export type AgentComposerSettingsEndProps = ComponentPropsWithoutRef<"div">;

export const AgentComposerSettingsEnd = forwardRef<
	HTMLDivElement,
	AgentComposerSettingsEndProps
>(function AgentComposerSettingsEnd({ className, ...props }, ref) {
	return (
		<div
			{...props}
			ref={ref}
			className={clsx(
				"ml-auto flex min-w-0 items-center gap-2 max-[560px]:shrink-0",
				className,
			)}
		/>
	);
});
