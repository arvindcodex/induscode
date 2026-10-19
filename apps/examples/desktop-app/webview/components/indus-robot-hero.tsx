"use client";

import { useEffect, useState } from "react";
import { RobotHead, type RobotHeadState, type RobotHeadShape } from "robot-heads";
import { cn } from "@/lib/utils";

interface IndusRobotHeroProps {
	className?: string;
	shape?: RobotHeadShape;
	initialState?: RobotHeadState;
}

export function IndusRobotHero({
	className,
	shape = "rectangle",
	initialState = "idle",
}: IndusRobotHeroProps) {
	const [mounted, setMounted] = useState(false);
	const [currentState, setCurrentState] = useState<RobotHeadState>(initialState);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Cycle state on click for fun interactivity
	const handleRobotClick = () => {
		const states: RobotHeadState[] = ["happy", "thinking", "working", "searching", "idle"];
		const nextIndex = (states.indexOf(currentState) + 1) % states.length;
		setCurrentState(states[nextIndex]);
	};

	return (
		<div
			className={cn(
				"relative flex flex-col items-center justify-center select-none",
				className,
			)}
		>

			{/* 3D Interactive Robot Head */}
			<div
				className="relative z-10 flex cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95"
				onClick={handleRobotClick}
				title="Click to interact with IndusCode bot!"
			>
				{mounted ? (
					<RobotHead
						antenna={true}
						color="#1a1b26"
						floorShadow={true}
						interactive={true}
						screenColor="#38bdf8"
						shape={shape}
						size={160}
						speed={1}
						state={currentState}
						trimColor="#7c3aed"
					/>
				) : (
					<div className="h-[160px] w-[160px]" />
				)}
			</div>
		</div>
	);
}
