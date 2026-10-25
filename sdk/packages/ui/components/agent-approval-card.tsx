"use client";

import { type ReactNode, useId } from "react";

export type AgentApprovalAction = "approve" | "reject";

export interface AgentApprovalCardProps {
	description?: ReactNode;
	detail?: ReactNode;
	error?: ReactNode;
	meta?: ReactNode;
	onApprove: () => void;
	onReject: () => void;
	responding?: AgentApprovalAction;
	title: ReactNode;
}

function Spinner() {
	return (
		<svg
			aria-hidden="true"
			className="induscode-ui-agent-approval-card__spinner mr-1 size-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] stroke-2"
			viewBox="0 0 24 24"
		>
			<path d="M21 12a9 9 0 1 1-6.219-8.56" />
		</svg>
	);
}

export function AgentApprovalCard({
	description,
	detail,
	error,
	meta,
	onApprove,
	onReject,
	responding,
	title,
}: AgentApprovalCardProps) {
	const titleId = useId();
	const isPending = responding !== undefined;

	return (
		<section
			aria-busy={isPending || undefined}
			aria-labelledby={titleId}
			className="induscode-ui-agent-approval-card rounded-induscode-ui-lg border border-induscode-ui-border/80 bg-induscode-ui-background/70 p-3"
		>
			<div className="induscode-ui-agent-approval-card__header flex items-center justify-between gap-2">
				<div
					className="induscode-ui-agent-approval-card__title font-induscode-ui-medium text-induscode-ui-foreground text-induscode-ui-sm"
					id={titleId}
				>
					{title}
				</div>
				{meta ? (
					<div className="induscode-ui-agent-approval-card__meta inline-flex items-center gap-1 text-[11px] text-induscode-ui-muted-foreground">
						{meta}
					</div>
				) : null}
			</div>
			{description ? (
				<div className="induscode-ui-agent-approval-card__description mt-1 text-[11px] text-induscode-ui-muted-foreground">
					{description}
				</div>
			) : null}
			{detail != null ? (
				<pre className="induscode-ui-agent-approval-card__detail max-h-44 max-w-full">
					{detail}
				</pre>
			) : null}
			{error ? (
				<div className="induscode-ui-agent-approval-card__error">{error}</div>
			) : null}
			<div className="induscode-ui-agent-approval-card__actions">
				<button
					className="induscode-ui-agent-approval-card__button induscode-ui-agent-approval-card__button--approve inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-induscode-ui-md border-0 bg-induscode-ui-primary px-3 font-induscode-ui-medium text-induscode-ui-primary-foreground transition-[color,background-color,border-color,box-shadow] duration-150 ease-[ease] [&:hover]:bg-induscode-ui-primary/90 focus-visible:outline-3 focus-visible:outline-induscode-ui-ring/50 focus-visible:outline-offset-0 disabled:pointer-events-none disabled:opacity-50"
					disabled={isPending}
					onClick={onApprove}
					type="button"
				>
					{responding === "approve" ? (
						<>
							<Spinner />
							Approving...
						</>
					) : (
						"Approve"
					)}
				</button>
				<button
					className="induscode-ui-agent-approval-card__button induscode-ui-agent-approval-card__button--reject inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-induscode-ui-md border border-induscode-ui-border bg-induscode-ui-background px-3 font-induscode-ui-medium text-induscode-ui-foreground shadow-xs transition-[color,background-color,border-color,box-shadow] duration-150 ease-[ease] [&:hover]:bg-induscode-ui-accent [&:hover]:text-induscode-ui-accent-foreground focus-visible:outline-3 focus-visible:outline-induscode-ui-ring/50 focus-visible:outline-offset-0 disabled:pointer-events-none disabled:opacity-50 induscode-ui-dark:border-induscode-ui-input induscode-ui-dark:bg-induscode-ui-input/30 induscode-ui-dark:[&:hover]:bg-induscode-ui-input/50"
					disabled={isPending}
					onClick={onReject}
					type="button"
				>
					{responding === "reject" ? (
						<>
							<Spinner />
							Rejecting...
						</>
					) : (
						"Reject"
					)}
				</button>
			</div>
		</section>
	);
}
