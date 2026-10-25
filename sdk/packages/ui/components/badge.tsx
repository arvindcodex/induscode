"use client";

import { clsx } from "clsx";
import { forwardRef, type HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
	({ className, ...props }, ref) => (
		<span
			{...props}
			className={clsx(
				"inline-flex shrink-0 items-center rounded-induscode-ui-sm border border-induscode-ui-border bg-induscode-ui-surface-hover-lighter px-1.5 pt-[0.3rem] pb-[0.2rem] text-induscode-ui-muted-foreground text-induscode-ui-xs",
				className,
			)}
			data-slot="badge"
			ref={ref}
		/>
	),
);
Badge.displayName = "Badge";
