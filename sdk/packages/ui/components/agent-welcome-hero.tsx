"use client";

import { useRef } from "react";
import { useAgentWelcomeHeroPointer } from "./agent-welcome-hero-pointer.js";

export type AgentWelcomeHeroLayout = "default" | "full-bleed" | "wide-grid";

export interface AgentWelcomeHeroProps {
	interactive?: boolean;
	layout?: AgentWelcomeHeroLayout;
	variant?: "full" | "grid-only" | "bot-only";
}

/** IndusCode bot illustration and grid backdrop used on agent welcome surfaces. */
export function AgentWelcomeHero({
	interactive,
	layout = "default",
	variant = "full",
}: AgentWelcomeHeroProps) {
	const heroRef = useRef<HTMLDivElement>(null);
	const showsGrid = variant !== "bot-only";
	const showsBot = variant !== "grid-only";
	const tracksPointer = interactive ?? showsBot;
	useAgentWelcomeHeroPointer(heroRef, tracksPointer);

	return (
		<div
			aria-hidden="true"
			className="induscode-ui-agent-welcome-hero"
			data-welcome-hero
			data-welcome-hero-interactive={tracksPointer}
			data-welcome-hero-layout={layout}
			data-welcome-hero-variant={variant}
			ref={heroRef}
		>
			{showsGrid ? (
				<div
					className="induscode-ui-agent-welcome-hero__grid"
					data-welcome-hero-layer="grid"
				/>
			) : null}
			{showsBot ? (
				<>
					<span
						className="induscode-ui-agent-welcome-hero__inner"
						data-welcome-hero-layer="inner"
					/>
					<span
						className="induscode-ui-agent-welcome-hero__bot-fill"
						data-welcome-hero-layer="bot-fill"
					/>
					<span
						className="induscode-ui-agent-welcome-hero__bot-outline"
						data-welcome-hero-layer="bot-outline"
					/>
					<span
						className="induscode-ui-agent-welcome-hero__eye induscode-ui-agent-welcome-hero__eye--left"
						data-welcome-hero-eye="left"
					/>
					<span
						className="induscode-ui-agent-welcome-hero__eye induscode-ui-agent-welcome-hero__eye--right"
						data-welcome-hero-eye="right"
					/>
				</>
			) : null}
		</div>
	);
}
