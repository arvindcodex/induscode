"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ClickRipple {
	id: number;
	x: number;
	y: number;
}

const GRID_MASK_URL =
	'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0wLjMgMFY0MDBNNDAuMyAwVjQwME04MC4zIDBWNDAwTTEyMC4zIDBWNDAwTTE2MC4zIDBWNDAwTTIwMC4zIDBWNDAwTTI0MC4zIDBWNDAwTTI4MC4zIDBWNDAwTTMyMC4zIDBWNDAwTTM2MC4zIDBWNDAwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjAuNiIvPgo8cGF0aCBkPSJNMCAwLjNINDAwTTAgNDAuM0g0MDBNMCA4MC4zSDQwME0wIDEyMC4zSDQwME0wIDE2MC4zSDQwME0wIDIwMC4zSDQwME0wIDI0MC4zSDQwME0wIDI4MC4zSDQwME0wIDMyMC4zSDQwME0wIDM2MC4zSDQwMCIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIwLjYiLz4KPHBhdGggZD0iTTAgMEw0MDAgNDAwTTQwMCAwTDAgNDAwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjAuNiIvPgo8L3N2Zz4K")';

export function InteractiveDashboardBackground({
	className,
}: {
	className?: string;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [ripples, setRipples] = useState<ClickRipple[]>([]);

	// Setup mouse movement tracking with smooth spring interpolation
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		let animationFrame: number | null = null;
		let currentX = 0;
		let currentY = 0;
		let targetX = 0;
		let targetY = 0;
		let dirty = false;
		let hasInitialPosition = false;

		const setInitialCenter = () => {
			if (!container) return;
			const rect = container.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0) {
				currentX = rect.width / 2;
				currentY = rect.height * 0.4;
				targetX = currentX;
				targetY = currentY;
				container.style.setProperty("--cursor-x", `${currentX.toFixed(1)}px`);
				container.style.setProperty("--cursor-y", `${currentY.toFixed(1)}px`);
				hasInitialPosition = true;
			}
		};

		setInitialCenter();

		const updateFrame = () => {
			animationFrame = null;
			if (!container) return;

			currentX += (targetX - currentX) * 0.16;
			currentY += (targetY - currentY) * 0.16;

			container.style.setProperty("--cursor-x", `${currentX.toFixed(1)}px`);
			container.style.setProperty("--cursor-y", `${currentY.toFixed(1)}px`);

			const settled =
				Math.abs(targetX - currentX) < 0.2 && Math.abs(targetY - currentY) < 0.2;

			if (!settled) {
				animationFrame = window.requestAnimationFrame(updateFrame);
			}
		};

		const handlePointerMove = (e: PointerEvent) => {
			if (!container) return;
			const rect = container.getBoundingClientRect();
			targetX = e.clientX - rect.left;
			targetY = e.clientY - rect.top;

			if (!hasInitialPosition) {
				currentX = targetX;
				currentY = targetY;
				hasInitialPosition = true;
			}

			if (animationFrame === null) {
				animationFrame = window.requestAnimationFrame(updateFrame);
			}
		};

		window.addEventListener("pointermove", handlePointerMove, { passive: true });

		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			if (animationFrame !== null) {
				window.cancelAnimationFrame(animationFrame);
			}
		};
	}, []);

	// Handle click ripples anywhere across the dashboard
	const handlePointerDown = useCallback((e: PointerEvent) => {
		const container = containerRef.current;
		if (!container) return;
		const rect = container.getBoundingClientRect();

		// Check if click occurred roughly within the dashboard boundaries
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		if (x < -100 || x > rect.width + 100 || y < -100 || y > rect.height + 100) {
			return;
		}

		const id = Date.now() + Math.random();
		setRipples((prev) => [...prev.slice(-4), { id, x, y }]);

		window.setTimeout(() => {
			setRipples((prev) => prev.filter((r) => r.id !== id));
		}, 800);
	}, []);

	useEffect(() => {
		window.addEventListener("pointerdown", handlePointerDown, { passive: true });
		return () => {
			window.removeEventListener("pointerdown", handlePointerDown);
		};
	}, [handlePointerDown]);

	return (
		<div
			ref={containerRef}
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 z-0 overflow-hidden select-none",
				className,
			)}
			style={
				{
					"--dashboard-grid-mask": GRID_MASK_URL,
					"--cursor-x": "50%",
					"--cursor-y": "40%",
				} as React.CSSProperties
			}
		>
			{/* Layer 1: Subtle permanent ambient blueprint grid */}
			<div
				className="absolute inset-0 opacity-[0.08]"
				style={{
					maskImage: "var(--dashboard-grid-mask)",
					WebkitMaskImage: "var(--dashboard-grid-mask)",
					maskSize: "400px 400px",
					WebkitMaskSize: "400px 400px",
					maskPosition: "center",
					WebkitMaskPosition: "center",
					maskRepeat: "repeat",
					WebkitMaskRepeat: "repeat",
					backgroundColor: "var(--primary, #6366f1)",
				}}
			/>

			{/* Layer 2: Soft unmasked ambient light glow following cursor */}
			<div
				className="absolute inset-0 transition-opacity duration-300 opacity-60"
				style={{
					background:
						"radial-gradient(circle 520px at var(--cursor-x) var(--cursor-y), color-mix(in srgb, var(--primary, #6366f1) 14%, transparent) 0%, color-mix(in srgb, var(--primary, #6366f1) 5%, transparent) 45%, transparent 75%)",
				}}
			/>

			{/* Layer 3: High-contrast illuminated blueprint grid following cursor */}
			<div
				className="absolute inset-0 opacity-80"
				style={{
					background:
						"radial-gradient(ellipse 650px 550px at var(--cursor-x) var(--cursor-y), color-mix(in srgb, var(--primary, #6366f1) 75%, transparent) 0%, color-mix(in srgb, var(--primary, #6366f1) 30%, transparent) 40%, transparent 70%)",
					maskImage: "var(--dashboard-grid-mask)",
					WebkitMaskImage: "var(--dashboard-grid-mask)",
					maskSize: "400px 400px",
					WebkitMaskSize: "400px 400px",
					maskPosition: "center",
					WebkitMaskPosition: "center",
					maskRepeat: "repeat",
					WebkitMaskRepeat: "repeat",
				}}
			/>

			{/* Layer 4: Interactive click ripples radiating outward from each click */}
			{ripples.map((ripple) => (
				<div
					key={ripple.id}
					className="pointer-events-none absolute"
					style={{
						left: ripple.x,
						top: ripple.y,
					}}
				>
					{/* Expanding soft radial light shockwave */}
					<div
						className="dashboard-ripple-pulse absolute size-[560px] rounded-full -translate-x-1/2 -translate-y-1/2"
						style={{
							background:
								"radial-gradient(circle, color-mix(in srgb, var(--primary, #6366f1) 50%, transparent) 0%, color-mix(in srgb, var(--primary, #6366f1) 20%, transparent) 45%, transparent 70%)",
						}}
					/>

					{/* Expanding grid illumination shockwave */}
					<div
						className="dashboard-ripple-pulse absolute size-[560px] rounded-full -translate-x-1/2 -translate-y-1/2"
						style={{
							background:
								"radial-gradient(circle, color-mix(in srgb, var(--primary, #6366f1) 85%, transparent) 0%, color-mix(in srgb, var(--primary, #6366f1) 40%, transparent) 50%, transparent 75%)",
							maskImage: "var(--dashboard-grid-mask)",
							WebkitMaskImage: "var(--dashboard-grid-mask)",
							maskSize: "400px 400px",
							WebkitMaskSize: "400px 400px",
							maskPosition: "center",
							WebkitMaskPosition: "center",
							maskRepeat: "repeat",
							WebkitMaskRepeat: "repeat",
						}}
					/>
				</div>
			))}
		</div>
	);
}
