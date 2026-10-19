"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, ChatSessionStatus } from "@/lib/chat-schema";

const SUPABASE_URL = "https://fmibgmxamgzvkxkvllpn.supabase.co";
const SUPABASE_ANON_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaWJnbXhhbWd6dmt4a3ZsbHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyOTU2MTMsImV4cCI6MjEwNzg3MTYxM30.hYgBmolWEQG561FB2byuP5awuTvqwLLQosHr5JYereE";

const HEADERS = {
	apikey: SUPABASE_ANON_KEY,
	Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
	"Content-Type": "application/json",
	Prefer: "return=representation",
};

/**
 * Internal AI SDK streaming errors that should NOT be shown to the mobile user.
 * These are transient protocol errors unrelated to the actual task output.
 */
const INTERNAL_ERROR_PATTERNS = [
	/text part .+ not found/i,
	/text-delta for missing text part/i,
	/text-end for missing text part/i,
	/the run failed: text part/i,
	/stream (error|closed|aborted)/i,
	/network error/i,
	/unexpected end of json input/i,
];

function isInternalStreamingError(msg: string): boolean {
	return INTERNAL_ERROR_PATTERNS.some((p) => p.test(msg));
}

function cleanErrorText(raw: string): string {
	// Remove common "The run failed: " prefix for cleaner mobile display
	return raw.replace(/^the run failed:\s*/i, "").trim();
}

interface ActiveRemotePrompt {
	id: string;
	prompt: string;
	initialMessageCount: number;
	hasStartedRunning: boolean;
	lastSyncedResponse: string;
	/** Best assistant text seen so far (before any error occurred) */
	bestAssistantText: string;
	startTime: number;
}

interface UseRemoteAgentListenerOptions {
	sendPrompt: (prompt: string) => Promise<boolean>;
	messages?: ChatMessage[];
	status?: ChatSessionStatus;
	error?: string | null;
	userEmail?: string | null;
	enabled?: boolean;
}

export function useRemoteAgentListener({
	sendPrompt,
	messages = [],
	status = "idle",
	error = null,
	userEmail,
	enabled = true,
}: UseRemoteAgentListenerOptions) {
	const processingIdsRef = useRef<Set<string>>(new Set());
	const activePromptRef = useRef<ActiveRemotePrompt | null>(null);
	const messagesRef = useRef<ChatMessage[]>(messages);
	messagesRef.current = messages;

	// 1. Poll for incoming pending prompts from mobile
	useEffect(() => {
		if (!enabled) return;

		let isMounted = true;
		const pollInterval = setInterval(async () => {
			if (!isMounted) return;

			// If already processing a remote prompt, wait until current finishes
			if (activePromptRef.current !== null) {
				return;
			}

			try {
				const res = await fetch(
					`${SUPABASE_URL}/rest/v1/remote_messages?status=eq.pending&order=created_at.asc&limit=1`,
					{ headers: HEADERS },
				);
				if (!res.ok) return;

				const pendingMessages = (await res.json()) as Array<{
					id: string;
					content: string;
					pairing_code: string;
					user_email: string;
				}>;

				if (!pendingMessages || pendingMessages.length === 0) return;

				const msg = pendingMessages[0];
				if (processingIdsRef.current.has(msg.id)) return;
				processingIdsRef.current.add(msg.id);

				// Mark as processing in Supabase
				await fetch(
					`${SUPABASE_URL}/rest/v1/remote_messages?id=eq.${msg.id}`,
					{
						method: "PATCH",
						headers: HEADERS,
						body: JSON.stringify({ status: "processing" }),
					},
				);

				// Track before dispatching
				activePromptRef.current = {
					id: msg.id,
					prompt: msg.content,
					initialMessageCount: messagesRef.current.length,
					hasStartedRunning: false,
					lastSyncedResponse: "",
					bestAssistantText: "",
					startTime: Date.now(),
				};

				// Trigger prompt in desktop active chat session
				const sent = await sendPrompt(msg.content);
				if (!sent) {
					await fetch(
						`${SUPABASE_URL}/rest/v1/remote_messages?id=eq.${msg.id}`,
						{
							method: "PATCH",
							headers: HEADERS,
							body: JSON.stringify({
								status: "completed",
								response: "Prompt could not be delivered to desktop agent.",
							}),
						},
					);
					activePromptRef.current = null;
				}
			} catch {
				// Silently handle transient network glitches
			}
		}, 1500);

		return () => {
			isMounted = false;
			clearInterval(pollInterval);
		};
	}, [sendPrompt, enabled]);

	// 2. Real-time assistant response sync to Supabase
	useEffect(() => {
		if (!enabled) return;
		const active = activePromptRef.current;
		if (!active) return;

		if (status === "starting" || status === "running") {
			active.hasStartedRunning = true;
		}

		// Collect messages added since this remote turn started
		const recent = messages.slice(active.initialMessageCount);

		// Separate clean assistant content from error messages
		const assistantParts: string[] = [];
		let encounteredFatalError = false;
		let fatalErrorText = "";

		for (const m of recent) {
			if (m.role === "assistant" && m.content && m.content.trim().length > 0) {
				assistantParts.push(m.content.trim());
			} else if (m.role === "error" && m.content && m.content.trim().length > 0) {
				const errText = m.content.trim();
				// Skip internal AI SDK streaming protocol errors entirely
				if (isInternalStreamingError(errText)) {
					continue;
				}
				// For real errors (tool failures, network issues, etc.) surface them
				encounteredFatalError = true;
				fatalErrorText = cleanErrorText(errText);
			}
		}

		const assistantText = assistantParts.join("\n\n");

		// Always track the best (longest) clean assistant text we've seen
		if (assistantText.length > active.bestAssistantText.length) {
			active.bestAssistantText = assistantText;
		}

		// Build what to show on mobile:
		// - If we have assistant text, show that (ignore streaming errors)
		// - If we only have a real error and no assistant text, show the error
		let currentResponseText = active.bestAssistantText;
		if (!currentResponseText && encounteredFatalError && fatalErrorText) {
			currentResponseText = `⚠️ ${fatalErrorText}`;
		}

		// Stream live updates if text changed
		if (
			currentResponseText &&
			currentResponseText !== active.lastSyncedResponse
		) {
			active.lastSyncedResponse = currentResponseText;
			fetch(`${SUPABASE_URL}/rest/v1/remote_messages?id=eq.${active.id}`, {
				method: "PATCH",
				headers: HEADERS,
				body: JSON.stringify({
					response: currentResponseText,
					status: "processing",
				}),
			}).catch(() => {});
		}

		// Check if execution has finished
		const elapsed = Date.now() - active.startTime;
		const isTerminalStatus =
			status === "idle" ||
			status === "completed" ||
			status === "failed" ||
			status === "error";

		const isFinished =
			(active.hasStartedRunning && isTerminalStatus) ||
			(elapsed > 4000 && status === "idle" && currentResponseText.length > 0) ||
			(elapsed > 60000 && status === "idle");

		if (isFinished) {
			// Build final response — prefer accumulated assistant text over error messages
			let finalResponse = active.bestAssistantText;

			if (!finalResponse) {
				// No assistant text at all — check outer error prop or session error
				if (error && !isInternalStreamingError(error)) {
					finalResponse = `⚠️ ${cleanErrorText(error)}`;
				} else if (encounteredFatalError && fatalErrorText) {
					finalResponse = `⚠️ ${fatalErrorText}`;
				} else if (status === "failed") {
					finalResponse = "Task execution failed on desktop agent.";
				} else {
					finalResponse = "Task completed.";
				}
			}

			fetch(`${SUPABASE_URL}/rest/v1/remote_messages?id=eq.${active.id}`, {
				method: "PATCH",
				headers: HEADERS,
				body: JSON.stringify({
					response: finalResponse,
					status: "completed",
				}),
			}).catch(() => {});

			activePromptRef.current = null;
		}
	}, [messages, status, error, enabled]);
}
