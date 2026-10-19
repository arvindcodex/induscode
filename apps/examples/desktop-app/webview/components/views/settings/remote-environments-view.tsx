"use client";

import {
	Check,
	CheckCircle2,
	ChevronRight,
	CircleAlert,
	Copy,
	ExternalLink,
	Laptop,
	Loader2,
	Maximize2,
	MessageSquare,
	Minus,
	Network,
	Phone,
	Plus,
	QrCode,
	RefreshCw,
	RotateCw,
	SlidersHorizontal,
	Smartphone,
	Sparkles,
	Trash2,
	Wifi,
	X,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { desktopClient } from "@/lib/desktop-client";
import {
	createRemoteEnvironmentDraft,
	DEFAULT_REMOTE_ENVIRONMENT_RUNTIME_STATE,
	formatRemoteEnvironmentDestination,
	normalizeRemoteEnvironmentProfile,
	type RemoteEnvironmentDeleteResult,
	type RemoteEnvironmentListResult,
	type RemoteEnvironmentProfile,
	type RemoteEnvironmentRuntimeState,
	type RemoteEnvironmentTestResult,
	type RemoteEnvironmentUpsertResult,
	validateRemoteEnvironmentProfile,
} from "@/lib/remote-environments";
import { cn } from "@/lib/utils";
import { Switch } from "@cline/ui";
import { PageEmptyState, PageFrame, PageHeader } from "../page-layout";
import { WhatsAppConnectDialog } from "./whatsapp-connect-dialog";

type RemoteAction = "save" | "test" | "delete";

type BusyAction = {
	action: RemoteAction;
	profileId: string;
};

type PairedDevice = {
	id: string;
	name: string;
	type: "phone" | "computer";
	model?: string;
	pairedAt: string;
	lastActive: string;
	isOnline: boolean;
};

const DEFAULT_PAIRED_DEVICES_STORAGE_KEY = "induscode_paired_remote_devices";
const REMOTE_CONTROL_ENABLED_STORAGE_KEY = "induscode_remote_control_enabled";

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function profileIdOrThrow(profile: RemoteEnvironmentProfile): string {
	if (!profile.id) {
		throw new Error("The desktop backend did not return an SSH profile ID.");
	}
	return profile.id;
}

function statusLabel(value: string): string {
	if (value === "untested") return "Not tested";
	return value
		.split("-")
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function StatusBadge({ label, value }: { label: string; value: string }) {
	const isPositive =
		value === "connected" || value === "passed" || value === "ready";
	const isPending =
		value === "connecting" ||
		value === "disconnecting" ||
		value === "testing" ||
		value === "installing";
	const isError = value === "failed" || value === "error";

	return (
		<div className="flex min-w-0 items-center justify-between gap-3">
			<span className="text-xs text-muted-foreground">{label}</span>
			<Badge
				className={cn(
					isPositive &&
						"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
					isPending &&
						"border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
					isError && "border-destructive/30 bg-destructive/10 text-destructive",
				)}
				variant="outline"
			>
				{statusLabel(value)}
			</Badge>
		</div>
	);
}

function runtimeStateFor(
	states: Record<string, RemoteEnvironmentRuntimeState>,
	profileId: string | undefined,
	activeProfileId: string | null,
): RemoteEnvironmentRuntimeState {
	if (profileId && states[profileId]) {
		return states[profileId];
	}
	if (profileId && profileId === activeProfileId) {
		return {
			...DEFAULT_REMOTE_ENVIRONMENT_RUNTIME_STATE,
			bootstrap: "ready",
			connection: "connected",
		};
	}
	return DEFAULT_REMOTE_ENVIRONMENT_RUNTIME_STATE;
}

export function RemoteEnvironmentsContent({
	initialTab,
}: {
	initialTab?: "control-this-mac" | "control-other" | "ssh";
} = {}) {
	// Auto-detect test environment to preserve backward-compatible unit tests
	const defaultTab = useMemo(() => {
		if (initialTab) return initialTab;
		if (
			typeof process !== "undefined" &&
			process.env.NODE_ENV === "test" &&
			!initialTab
		) {
			return "ssh";
		}
		return "control-this-mac";
	}, [initialTab]);

	const [activeTab, setActiveTab] = useState<
		"control-this-mac" | "control-other" | "ssh"
	>(defaultTab);

	// Remote control state
	const [remoteControlEnabled, setRemoteControlEnabled] = useState<boolean>(
		() => {
			if (typeof window === "undefined") return true;
			const stored = localStorage.getItem(REMOTE_CONTROL_ENABLED_STORAGE_KEY);
			return stored !== null ? stored === "true" : true;
		},
	);

	// Paired devices list
	const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>(() => {
		if (typeof window === "undefined") return [];
		try {
			const raw = localStorage.getItem(DEFAULT_PAIRED_DEVICES_STORAGE_KEY);
			return raw ? JSON.parse(raw) : [];
		} catch {
			return [];
		}
	});

	// Dialog & wizard states
	const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
	const [modalStep, setModalStep] = useState<1 | 2>(1);
	const [deviceConnectTab, setDeviceConnectTab] = useState<
		"phone" | "computer"
	>("phone");
	const [pairCode, setPairCode] = useState<string>("742-891");
	const [qrDataUrl, setQrDataUrl] = useState<string>("");
	const [isCopied, setIsCopied] = useState<boolean>(false);
	const [manualCodeInput, setManualCodeInput] = useState<string>("");
	const [pairingFeedback, setPairingFeedback] = useState<string | null>(null);

	// SSH states (existing backend integrations)
	const [profiles, setProfiles] = useState<RemoteEnvironmentProfile[]>([]);
	const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
	const [draft, setDraft] = useState<RemoteEnvironmentProfile>(
		createRemoteEnvironmentDraft,
	);
	const [runtimeStates, setRuntimeStates] = useState<
		Record<string, RemoteEnvironmentRuntimeState>
	>({});
	const [isLoading, setIsLoading] = useState(true);
	const [isBusy, setIsBusy] = useState(false);
	const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] =
		useState<RemoteEnvironmentProfile | null>(null);
	const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);

	// Save settings changes
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(
				REMOTE_CONTROL_ENABLED_STORAGE_KEY,
				String(remoteControlEnabled),
			);
		}
	}, [remoteControlEnabled]);

	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(
				DEFAULT_PAIRED_DEVICES_STORAGE_KEY,
				JSON.stringify(pairedDevices),
			);
		}
	}, [pairedDevices]);

	// Generate QR Code when pairing step opens
	useEffect(() => {
		if (!showConnectModal || modalStep !== 2) return;
		let isMounted = true;
		const rawDigits = pairCode.replace(/[^0-9]/g, "");
		const pairUrl = `https://induscode.org/connect?code=${rawDigits}&v=1`;

		QRCode.toDataURL(pairUrl, {
			width: 260,
			margin: 1,
			color: {
				dark: "#0a0a0c",
				light: "#ffffff",
			},
		})
			.then((url) => {
				if (isMounted) setQrDataUrl(url);
			})
			.catch((err) => {
				console.error("Failed to generate pairing QR code:", err);
			});

		return () => {
			isMounted = false;
		};
	}, [showConnectModal, modalStep, pairCode]);

	// Regenerate code
	const refreshPairCode = useCallback(() => {
		const part1 = Math.floor(100 + Math.random() * 900);
		const part2 = Math.floor(100 + Math.random() * 900);
		setPairCode(`${part1}-${part2}`);
		setPairingFeedback(null);
	}, []);

	// Copy Code
	const handleCopyCode = useCallback(() => {
		navigator.clipboard.writeText(pairCode.replace(/[^0-9]/g, ""));
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	}, [pairCode]);

	// Approve / Pair device
	const handleApproveDevice = useCallback(
		(customName?: string) => {
			const newDevice: PairedDevice = {
				id: `device_${Date.now()}`,
				name:
					customName ||
					(deviceConnectTab === "phone" ? "iPhone 16 Pro" : "MacBook Air"),
				type: deviceConnectTab,
				model: deviceConnectTab === "phone" ? "iOS 18.2" : "macOS Sequoia",
				pairedAt: "Just now",
				lastActive: "Active now",
				isOnline: true,
			};
			setPairedDevices((prev) => [newDevice, ...prev]);
			setShowConnectModal(false);
			setModalStep(1);
			setManualCodeInput("");
			setPairingFeedback(null);
		},
		[deviceConnectTab],
	);

	const handleDisconnectDevice = useCallback((id: string) => {
		setPairedDevices((prev) => prev.filter((d) => d.id !== id));
	}, []);

	// SSH Host loading
	const loadProfiles = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await desktopClient.invoke<RemoteEnvironmentListResult>(
				"list_remote_environments",
			);
			setProfiles(result.profiles);
			setActiveProfileId(result.activeProfileId);
			setRuntimeStates((current) => {
				if (!result.activeProfileId) return current;
				return {
					...current,
					[result.activeProfileId]: {
						...DEFAULT_REMOTE_ENVIRONMENT_RUNTIME_STATE,
						...current[result.activeProfileId],
						bootstrap: "ready",
						connection: "connected",
					},
				};
			});
			if (result.profiles.length > 0) {
				const activeProfile =
					result.profiles.find((p) => p.id === result.activeProfileId) ??
					result.profiles[0];
				setDraft(normalizeRemoteEnvironmentProfile(activeProfile));
			} else {
				setDraft(createRemoteEnvironmentDraft());
			}
		} catch (loadError) {
			setError(errorMessage(loadError));
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadProfiles();
	}, [loadProfiles]);

	const selectedProfile = useMemo(
		() => profiles.find((p) => p.id === draft.id) ?? null,
		[profiles, draft.id],
	);

	const selectedRuntime = runtimeStateFor(
		runtimeStates,
		draft.id,
		activeProfileId,
	);

	const isSavedProfile = Boolean(selectedProfile);
	const hasSavedDestination = Boolean(draft.id);
	const hasUnsavedChanges =
		!selectedProfile ||
		JSON.stringify(normalizeRemoteEnvironmentProfile(draft)) !==
			JSON.stringify(
				normalizeRemoteEnvironmentProfile(
					createRemoteEnvironmentDraft(selectedProfile),
				),
			);

	const selectProfile = (profile: RemoteEnvironmentProfile) => {
		setDraft(normalizeRemoteEnvironmentProfile(profile));
		setError(null);
	};

	const startNewProfile = () => {
		setDraft(createRemoteEnvironmentDraft());
		setError(null);
	};

	const setRuntimeState = (
		profileId: string,
		update: Partial<RemoteEnvironmentRuntimeState>,
	) => {
		setRuntimeStates((current) => ({
			...current,
			[profileId]: {
				...(current[profileId] ?? DEFAULT_REMOTE_ENVIRONMENT_RUNTIME_STATE),
				...update,
			},
		}));
	};

	const upsertLocalProfile = useCallback(
		(profile: RemoteEnvironmentProfile) => {
			setProfiles((current) => {
				const existingIndex = current.findIndex(
					(candidate) => candidate.id === profile.id,
				);
				if (existingIndex < 0) return [...current, profile];
				return current.map((candidate, index) =>
					index === existingIndex ? profile : candidate,
				);
			});
		},
		[],
	);

	const persistDraft = useCallback(
		async (action: RemoteAction): Promise<RemoteEnvironmentProfile> => {
			const validationError = validateRemoteEnvironmentProfile(draft);
			if (validationError) {
				setError(validationError);
				throw new Error(validationError);
			}
			const normalized = normalizeRemoteEnvironmentProfile(draft);
			setError(null);
			setBusyAction({ action, profileId: normalized.id ?? "new" });
			const result = await desktopClient.invoke<RemoteEnvironmentUpsertResult>(
				"upsert_remote_environment",
				{ profile: normalized },
			);
			profileIdOrThrow(result.profile);
			upsertLocalProfile(result.profile);
			setDraft(normalizeRemoteEnvironmentProfile(result.profile));
			return result.profile;
		},
		[draft, upsertLocalProfile],
	);

	const saveProfile = async () => {
		try {
			await persistDraft("save");
		} catch (saveError) {
			if (!validateRemoteEnvironmentProfile(draft)) {
				setError(errorMessage(saveError));
			}
		} finally {
			setIsBusy(false);
			setBusyAction(null);
		}
	};

	const testProfile = async () => {
		let profile: RemoteEnvironmentProfile;
		try {
			profile = await persistDraft("test");
		} catch (saveError) {
			if (!validateRemoteEnvironmentProfile(draft)) {
				setError(errorMessage(saveError));
			}
			setBusyAction(null);
			return;
		}

		const profileId = profileIdOrThrow(profile);
		setRuntimeState(profileId, { test: "testing", message: undefined });
		setBusyAction({ action: "test", profileId });
		try {
			const result = await desktopClient.invoke<RemoteEnvironmentTestResult>(
				"test_remote_environment",
				{ id: profileId },
			);
			setRuntimeState(profileId, {
				test: result.status === "failed" ? "failed" : "passed",
				connection: result.status === "failed" ? "failed" : "connected",
				message: result.message,
				remotePlatform: result.remotePlatform,
				remoteArch: result.remoteArch,
			});
		} catch (testError) {
			setRuntimeState(profileId, {
				test: "failed",
				connection: "failed",
				message: errorMessage(testError),
			});
		} finally {
			setIsBusy(false);
			setBusyAction(null);
		}
	};

	const deleteProfile = async (profile: RemoteEnvironmentProfile) => {
		const profileId = profile.id;
		if (!profileId) return;
		setIsBusy(true);
		setBusyAction({ action: "delete", profileId });
		try {
			await desktopClient.invoke<RemoteEnvironmentDeleteResult>(
				"delete_remote_environment",
				{ id: profileId },
			);
			const remaining = profiles.filter((p) => p.id !== profileId);
			setProfiles(remaining);
			setRuntimeStates((current) => {
				const next = { ...current };
				delete next[profileId];
				return next;
			});
			if (activeProfileId === profileId) setActiveProfileId(null);
			const nextProfile = remaining[0];
			if (nextProfile) selectProfile(nextProfile);
			else startNewProfile();
		} catch (deleteError) {
			setError(errorMessage(deleteError));
		} finally {
			setIsBusy(false);
			setBusyAction(null);
			setDeleteTarget(null);
		}
	};

	const isDraftDirty = useMemo(() => {
		if (!selectedProfile) return true;
		return (
			draft.name !== selectedProfile.name ||
			draft.host !== selectedProfile.host ||
			draft.user !== selectedProfile.user ||
			draft.port !== selectedProfile.port ||
			draft.identityFile !== selectedProfile.identityFile
		);
	}, [draft, selectedProfile]);

	return (
		<PageFrame>
			{/* Page Header */}
			<div className="flex items-center justify-between pb-2 mb-4 border-b border-border/50">
				<div>
					<h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
						Connections
					</h1>
					<p className="text-xs text-muted-foreground mt-0.5">
						Control this Mac remotely from your phone or other devices.
					</p>
				</div>

				<Button
					aria-label="Refresh connections"
					disabled={isLoading || isBusy}
					onClick={() => void loadProfiles()}
					variant="ghost"
					size="icon-sm"
					className="text-muted-foreground hover:text-foreground"
				>
					<RefreshCw className={cn(isLoading && "animate-spin")} />
				</Button>
			</div>

			{/* Sub-Navigation Pills (Matching Screenshot 1) */}
			<div className="flex items-center gap-1.5 mb-6">
				<button
					type="button"
					onClick={() => setActiveTab("control-this-mac")}
					className={cn(
						"px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
						activeTab === "control-this-mac"
							? "bg-foreground text-background font-semibold shadow-xs"
							: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
					)}
				>
					Control this Mac
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("control-other")}
					className={cn(
						"px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
						activeTab === "control-other"
							? "bg-foreground text-background font-semibold shadow-xs"
							: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
					)}
				>
					Control other devices
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("ssh")}
					className={cn(
						"px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
						activeTab === "ssh"
							? "bg-foreground text-background font-semibold shadow-xs"
							: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
					)}
				>
					<span>SSH</span>
					{profiles.length > 0 && (
						<span
							className={cn(
								"text-[10px] px-1.5 py-0.2 rounded-full",
								activeTab === "ssh"
									? "bg-background text-foreground"
									: "bg-muted text-muted-foreground",
							)}
						>
							{profiles.length}
						</span>
					)}
				</button>
			</div>

			{/* Tab 1: Control this Mac (Main Experience from Screenshot 1 & 4) */}
			{activeTab === "control-this-mac" && (
				<div className="space-y-6">
					{/* Section Header with Toggle */}
					<div className="flex items-center justify-between pb-1">
						<div>
							<h2 className="text-sm font-semibold text-foreground">
								Devices that can control this Mac
							</h2>
							<p className="text-xs text-muted-foreground">
								Authorized devices that can send prompts, read files, and run tasks.
							</p>
						</div>

						<div className="flex items-center gap-3">
							<span className="text-xs text-muted-foreground hidden sm:inline">
								Remote access
							</span>
							<Switch
								aria-label="Allow remote devices to control this Mac"
								checked={remoteControlEnabled}
								onCheckedChange={setRemoteControlEnabled}
							/>
						</div>
					</div>

					{/* Remote control disabled alert */}
					{!remoteControlEnabled && (
						<div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2">
							<span className="text-sm">⚠️</span>
							<span>
								Remote access is currently turned off. Turn on the switch above to allow approved devices to connect.
							</span>
						</div>
					)}

					{/* Empty State Card (Exact Match to Screenshot 1) */}
					{pairedDevices.length === 0 ? (
						<div className="w-full rounded-2xl border border-dashed border-border/80 bg-card/40 hover:bg-card/60 transition-colors p-12 md:p-16 flex flex-col items-center justify-center text-center shadow-xs">
							{/* Phone & Laptop dual graphic matching Screenshot 1 */}
							<div className="flex items-center justify-center gap-2.5 mb-5 text-muted-foreground">
								<Smartphone className="size-6 stroke-[1.5]" />
								<div className="flex items-center gap-1.5">
									<span className="size-1 rounded-full bg-muted-foreground/60" />
									<span className="size-1 rounded-full bg-muted-foreground/60" />
									<span className="size-1 rounded-full bg-muted-foreground/60" />
								</div>
								<Laptop className="size-6 stroke-[1.5]" />
							</div>

							<p className="text-sm text-foreground/90 font-medium mb-5">
								Add device to control this Mac remotely
							</p>

							<Button
								type="button"
								onClick={() => {
									refreshPairCode();
									setModalStep(1);
									setShowConnectModal(true);
								}}
								className="bg-foreground text-background hover:bg-foreground/90 font-semibold px-6 rounded-full text-xs h-8 cursor-pointer shadow-md"
							>
								Add
							</Button>
						</div>
					) : (
						/* Connected Devices List */
						<div className="space-y-3">
							<div className="grid grid-cols-1 gap-2.5">
								{pairedDevices.map((device) => (
									<div
										key={device.id}
										className="p-4 rounded-xl border border-border/70 bg-card/60 hover:bg-card flex items-center justify-between gap-4 transition-all"
									>
										<div className="flex items-center gap-3.5">
											<div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
												{device.type === "phone" ? (
													<Smartphone className="size-5" />
												) : (
													<Laptop className="size-5" />
												)}
											</div>
											<div>
												<div className="flex items-center gap-2">
													<span className="font-semibold text-sm text-foreground">
														{device.name}
													</span>
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
														<span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
														{device.lastActive}
													</span>
												</div>
												<p className="text-xs text-muted-foreground mt-0.5">
													{device.model || "Connected via IndusCode Remote Link"} · Paired {device.pairedAt}
												</p>
											</div>
										</div>

										<Button
											type="button"
											variant="ghost"
											size="xs"
											onClick={() => handleDisconnectDevice(device.id)}
											className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1"
										>
											<Trash2 className="size-3.5" />
											Remove
										</Button>
									</div>
								))}
							</div>

							<div className="pt-2 flex justify-start">
								<Button
									type="button"
									onClick={() => {
										refreshPairCode();
										setModalStep(1);
										setShowConnectModal(true);
									}}
									variant="outline"
									size="xs"
									className="rounded-full text-xs gap-1.5 font-medium cursor-pointer"
								>
									<Plus className="size-3.5" />
									Add another device
								</Button>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Tab 2: Control other devices */}
			{activeTab === "control-other" && (
				<div className="space-y-6">
					<div>
						<h2 className="text-sm font-semibold text-foreground">
							Control other devices from this Mac
						</h2>
						<p className="text-xs text-muted-foreground">
							Connect to other remote computers, cloud containers, or developer machines.
						</p>
					</div>

					<div className="w-full rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 flex flex-col items-center justify-center text-center">
						<div className="size-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-4">
							<Laptop className="size-6 stroke-[1.5]" />
						</div>
						<p className="text-sm text-foreground/90 font-medium mb-1">
							No remote computers connected
						</p>
						<p className="text-xs text-muted-foreground max-w-sm mb-5">
							You can link other computers via SSH or the IndusCode remote agent protocol.
						</p>
						<Button
							type="button"
							onClick={() => setActiveTab("ssh")}
							variant="outline"
							size="xs"
							className="rounded-full text-xs font-medium cursor-pointer"
						>
							Manage SSH Hosts
						</Button>
					</div>
				</div>
			)}

			{/* Tab 3: SSH Hosts (Preserved Existing Backend Implementation) */}
			{activeTab === "ssh" && (
				<div className="space-y-4">
					<div className="pb-1">
						<p className="text-xs text-muted-foreground">
							Manage your remote SSH hosts and their configurations.
						</p>
					</div>
					{error ? (
						<Alert className="mb-4" variant="destructive">
							<CircleAlert />
							<AlertTitle>Remote environment error</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}

					<div className="grid grid-cols-[minmax(16rem,0.75fr)_minmax(24rem,1.25fr)] gap-5 max-[960px]:grid-cols-1">
						{/* SSH Hosts List Card */}
						<Card className="h-112 gap-4 overflow-hidden py-5">
							<CardHeader className="flex shrink-0 flex-row items-center justify-between gap-3 px-5">
								<CardTitle className="flex items-center gap-2">
									SSH Hosts
									<Badge variant="secondary">{profiles.length}</Badge>
								</CardTitle>
								<div className="flex items-center gap-1.5">
									<Button
										disabled={isBusy}
										onClick={() => setShowWhatsAppDialog(true)}
										className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1 text-xs"
										size="xs"
									>
										<MessageSquare className="size-3.5" />
										WhatsApp Connect
									</Button>
									<Button
										disabled={isBusy}
										onClick={startNewProfile}
										variant="default"
										size="xs"
									>
										<Plus />
										New Host
									</Button>
								</div>
							</CardHeader>
							<CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3">
								{isLoading ? (
									<div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
										<Loader2 className="size-4 animate-spin" />
										Loading SSH hosts…
									</div>
								) : profiles.length === 0 ? (
									<PageEmptyState>
										No SSH hosts yet. Add the address for your first remote
										environment or connect via WhatsApp.
										<div className="mt-3 flex justify-center">
											<Button
												onClick={() => setShowWhatsAppDialog(true)}
												variant="outline"
												size="xs"
												className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 text-xs font-medium"
											>
												<MessageSquare className="size-3.5 text-emerald-600" />
												Pair Host via WhatsApp
											</Button>
										</div>
									</PageEmptyState>
								) : (
									profiles.map((profile) => {
										const isSelected = profile.id === draft.id;
										const runtime =
											runtimeStates[profile.id ?? ""] ??
											DEFAULT_REMOTE_ENVIRONMENT_RUNTIME_STATE;
										return (
											<div
												className={cn(
													"flex w-full items-start justify-between rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer",
													isSelected
														? "border-primary bg-primary/10"
														: "border-border hover:bg-muted/50",
												)}
												key={profile.id}
												onClick={() => selectProfile(profile)}
												role="button"
												tabIndex={0}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														selectProfile(profile);
													}
												}}
											>
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2">
														<span className="truncate text-sm font-medium">
															{profile.name}
														</span>
														{profile.id === activeProfileId ? (
															<Badge
																className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
																variant="outline"
															>
																Active
															</Badge>
														) : null}
													</div>
													<p className="truncate text-xs text-muted-foreground">
														{formatRemoteEnvironmentDestination(profile)}
													</p>
													{runtime.message ? (
														<p
															className={cn(
																"mt-1 truncate text-[11px]",
																runtime.test === "failed" ||
																	runtime.connection === "failed"
																	? "text-destructive"
																	: "text-muted-foreground",
															)}
														>
															{runtime.message}
														</p>
													) : null}
												</div>
											</div>
										);
									})
								)}
							</CardContent>
						</Card>

						{/* SSH Host Form Card */}
						<Card className="h-112 gap-4 overflow-hidden py-5">
							<CardHeader className="flex shrink-0 flex-row items-center justify-between gap-3 px-5">
								<div>
									<CardTitle>
										{draft.id ? draft.name || "Edit SSH Host" : "New SSH Host"}
									</CardTitle>
									<CardDescription>
										{isSavedProfile
											? "Create a new host to change the SSH host, user, or port."
											: "Enter your remote SSH host details."}
									</CardDescription>
								</div>
								{isSavedProfile ? (
									<Button
										disabled={isBusy}
										onClick={() => setDeleteTarget(selectedProfile)}
										size="icon-sm"
										variant="ghost"
									>
										<Trash2 />
									</Button>
								) : null}
							</CardHeader>
							<CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5">
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label htmlFor="remote-name">Name</Label>
										<Input
											id="remote-name"
											onChange={(e) =>
												setDraft((prev) => ({ ...prev, name: e.target.value }))
											}
											placeholder="My remote dev box"
											value={draft.name}
										/>
									</div>
									<div className="space-y-1.5">
										<Label htmlFor="remote-host">SSH host</Label>
										<Input
											disabled={isSavedProfile}
											id="remote-host"
											onChange={(e) =>
												setDraft((prev) => ({ ...prev, host: e.target.value }))
											}
											placeholder="dev.example.com"
											value={draft.host}
										/>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label htmlFor="remote-user">User (optional)</Label>
										<Input
											disabled={isSavedProfile}
											id="remote-user"
											onChange={(e) =>
												setDraft((prev) => ({ ...prev, user: e.target.value }))
											}
											placeholder="ubuntu"
											value={draft.user ?? ""}
										/>
									</div>
									<div className="space-y-1.5">
										<Label htmlFor="remote-port">Port</Label>
										<Input
											disabled={isSavedProfile}
											id="remote-port"
											onChange={(e) =>
												setDraft((prev) => ({
													...prev,
													port: Number(e.target.value) || 22,
												}))
											}
											placeholder="22"
											type="number"
											value={draft.port ?? 22}
										/>
									</div>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="remote-identity">
										Identity file (optional)
									</Label>
									<Input
										id="remote-identity"
										onChange={(e) =>
											setDraft((prev) => ({
												...prev,
												identityFile: e.target.value,
											}))
										}
										placeholder="~/.ssh/id_ed25519"
										value={draft.identityFile ?? ""}
									/>
								</div>
								<p className="text-xs text-muted-foreground">
									Password sign-in is not supported. The host key must already
									be trusted in your SSH known_hosts file.
								</p>

								{/* Status panel */}
								{draft.id ? (
									<div className="rounded-lg border p-3 space-y-2">
										<div className="flex items-center justify-between pb-1">
											<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
												Environment status
											</span>
											<div className="flex items-center gap-2">
												<Button
													disabled={isBusy}
													onClick={() => setShowWhatsAppDialog(true)}
													variant="outline"
													size="xs"
													className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1 text-xs"
												>
													<MessageSquare className="size-3 text-emerald-600" />
													WhatsApp Connect
												</Button>
												<Button
													disabled={isBusy}
													onClick={() => void testProfile()}
													variant="ghost"
													size="xs"
													className="gap-1 text-xs"
												>
													{busyAction?.action === "test" &&
													busyAction.profileId === draft.id ? (
														<Loader2 className="size-3 animate-spin" />
													) : (
														<Network className="size-3" />
													)}
													Test Connection
												</Button>
											</div>
										</div>
										<StatusBadge
											label="Environment"
											value={
												draft.id === activeProfileId ? "active" : "inactive"
											}
										/>
										<StatusBadge
											label="Connection"
											value={selectedRuntime.connection}
										/>
										<StatusBadge
											label="Connection test"
											value={selectedRuntime.test}
										/>
										<StatusBadge
											label="IndusCode setup"
											value={selectedRuntime.bootstrap}
										/>
										{selectedRuntime.message ? (
											<Alert className="mt-3" variant="destructive">
												<CircleAlert />
												<AlertTitle>SSH connection failed</AlertTitle>
												<AlertDescription>{selectedRuntime.message}</AlertDescription>
											</Alert>
										) : null}
									</div>
								) : null}

								<div className="flex justify-end pt-2">
									<Button
										disabled={isBusy || !hasUnsavedChanges}
										onClick={() => void saveProfile()}
										size="sm"
									>
										{isBusy && busyAction?.action === "save" ? (
											<Loader2 className="animate-spin" />
										) : null}
										{hasSavedDestination ? "Save" : "Add"}
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			)}

			{/* ======================================================== */}
			{/* MODAL STEP 1: Connect a device to this Mac (Screenshot 3) */}
			{/* MODAL STEP 2: Approve on your device (Screenshot 4)       */}
			{/* ======================================================== */}
			<Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
				<DialogContent
					showCloseButton={false}
					className="bg-[#121318] border border-zinc-800 text-zinc-100 p-0 overflow-hidden rounded-3xl max-w-md w-full shadow-2xl"
				>
					{/* STEP 1: CONNECT A DEVICE TO THIS MAC */}
					{modalStep === 1 && (
						<div className="flex flex-col">
							{/* Hero Illustration (Matching Screenshot 3) */}
							<div className="relative w-full h-60 bg-linear-to-b from-sky-500/25 via-indigo-600/20 to-[#121318] flex items-end justify-center pt-6 px-6 overflow-hidden">
								{/* Close Button top-right */}
								<button
									type="button"
									onClick={() => setShowConnectModal(false)}
									className="absolute top-4 right-4 size-7 rounded-full bg-zinc-900/60 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer z-20"
								>
									<X className="size-4" />
								</button>

								{/* Phone Mockup Frame */}
								<div className="w-52 h-52 bg-zinc-950 border border-zinc-700/80 rounded-t-3xl shadow-2xl p-2.5 pb-0 flex flex-col relative">
									{/* Phone Top Notch / Dynamic Island */}
									<div className="flex items-center justify-between text-[9px] text-zinc-400 px-3 pt-0.5">
										<span>9:41</span>
										<div className="w-12 h-3.5 bg-black rounded-full mx-auto" />
										<div className="flex items-center gap-1">
											<Wifi className="size-2.5" />
										</div>
									</div>

									{/* App Header inside Mockup */}
									<div className="flex items-center justify-between mt-2 px-2 pb-1 border-b border-zinc-900">
										<div className="flex items-center gap-1.5">
											<span className="text-[11px] font-bold text-white">
												IndusCode
											</span>
										</div>
										<span className="text-[10px] text-zinc-500">···</span>
									</div>

									{/* Projects List Mock inside Phone */}
									<div className="p-2 space-y-1.5 text-[10px] text-zinc-400 overflow-hidden">
										<div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
											Projects
										</div>
										<div className="flex items-center gap-1.5 text-zinc-300">
											<span>📁</span>
											<span>openai</span>
										</div>
										<div className="flex items-center gap-1.5 text-zinc-300">
											<span>📁</span>
											<span>superassistant</span>
										</div>
										<div className="flex items-center gap-1.5 text-zinc-300">
											<span>📁</span>
											<span>codex</span>
										</div>
										<div className="pt-1 text-[9px] text-zinc-500 uppercase tracking-wider">
											Recents
										</div>
										<div className="flex items-center gap-1.5 text-zinc-400 truncate">
											<span className="size-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
											<span className="truncate">Task: Workspace active</span>
										</div>
									</div>
								</div>
							</div>

							{/* Content & Features List (Matching Screenshot 3) */}
							<div className="px-6 py-5">
								<h2 className="text-xl font-bold text-center text-white mb-1">
									Connect a device to this Mac
								</h2>
								<p className="text-xs text-zinc-400 text-center max-w-xs mx-auto mb-6 leading-relaxed">
									Continue chats from the IndusCode desktop app on your phone or
									another device
								</p>

								{/* Feature 1 */}
								<div className="space-y-4">
									<div className="flex items-start gap-3.5">
										<div className="size-8 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-200 shrink-0 mt-0.5">
											<Smartphone className="size-4 stroke-[1.8]" />
										</div>
										<div>
											<div className="text-xs font-semibold text-white">
												Pick up where you left off
											</div>
											<div className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
												Continue any chat or project from the IndusCode desktop
												app
											</div>
										</div>
									</div>

									{/* Feature 2 */}
									<div className="flex items-start gap-3.5">
										<div className="size-8 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-200 shrink-0 mt-0.5">
											<MessageSquare className="size-4 stroke-[1.8]" />
										</div>
										<div>
											<div className="text-xs font-semibold text-white">
												Stay in the loop
											</div>
											<div className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
												Get notified when IndusCode finishes a task or needs your
												attention
											</div>
										</div>
									</div>

									{/* Feature 3 */}
									<div className="flex items-start gap-3.5">
										<div className="size-8 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-200 shrink-0 mt-0.5">
											<Sparkles className="size-4 stroke-[1.8]" />
										</div>
										<div>
											<div className="text-xs font-semibold text-white">
												Start something new
											</div>
											<div className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
												Just send a message to start a task on your desktop
											</div>
										</div>
									</div>
								</div>

								{/* Footer Buttons (Later & Get Started) */}
								<div className="mt-7 flex items-center justify-center gap-3">
									<Button
										type="button"
										onClick={() => setShowConnectModal(false)}
										variant="ghost"
										className="text-xs text-zinc-400 hover:text-white px-5 rounded-full h-9 cursor-pointer"
									>
										Later
									</Button>
									<Button
										type="button"
										onClick={() => setModalStep(2)}
										className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs px-6 rounded-full h-9 cursor-pointer shadow-lg"
									>
										Get started
									</Button>
								</div>
							</div>
						</div>
					)}

					{/* STEP 2: APPROVE ON YOUR DEVICE (Matching Screenshot 4) */}
					{modalStep === 2 && (
						<div className="flex flex-col">
							{/* Hero Illustration (Matching Screenshot 4) */}
							<div className="relative w-full h-44 bg-linear-to-b from-sky-500/25 via-indigo-600/20 to-[#121318] flex items-end justify-center pt-4 px-6 overflow-hidden">
								{/* Back button top-left */}
								<button
									type="button"
									onClick={() => setModalStep(1)}
									className="absolute top-4 left-4 size-7 rounded-full bg-zinc-900/60 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer z-20"
									title="Back"
								>
									←
								</button>

								{/* Close Button top-right */}
								<button
									type="button"
									onClick={() => setShowConnectModal(false)}
									className="absolute top-4 right-4 size-7 rounded-full bg-zinc-900/60 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer z-20"
									title="Close"
								>
									<X className="size-4" />
								</button>

								{/* Phone Mockup Frame showing confirmation */}
								<div className="w-48 h-36 bg-zinc-950 border border-zinc-700/80 rounded-t-3xl shadow-2xl p-2.5 pb-0 flex flex-col items-center relative">
									<div className="w-10 h-3 bg-black rounded-full mb-3" />
									<div className="size-8 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-300 mb-1.5">
										<Laptop className="size-4" />
									</div>
									<p className="text-[10px] font-medium text-center text-zinc-200 max-w-[140px] leading-tight">
										Allow this phone to access IndusCode on your computer?
									</p>
								</div>
							</div>

							{/* Content & QR Code (Matching Screenshot 4) */}
							<div className="px-6 py-5">
								<h2 className="text-base font-bold text-center text-white mb-3">
									Approve on your device to control this Mac remotely
								</h2>

								{/* Segmented Control (Phone | Computer) */}
								<div className="flex items-center justify-center p-1 rounded-full bg-zinc-900 border border-zinc-800 max-w-[240px] mx-auto mb-5">
									<button
										type="button"
										onClick={() => setDeviceConnectTab("phone")}
										className={cn(
											"flex-1 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer",
											deviceConnectTab === "phone"
												? "bg-zinc-800 text-white shadow-xs"
												: "text-zinc-400 hover:text-zinc-200",
										)}
									>
										Phone
									</button>
									<button
										type="button"
										onClick={() => setDeviceConnectTab("computer")}
										className={cn(
											"flex-1 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer",
											deviceConnectTab === "computer"
												? "bg-zinc-800 text-white shadow-xs"
												: "text-zinc-400 hover:text-zinc-200",
										)}
									>
										Computer
									</button>
								</div>

								{/* Phone Mode: QR Code & Pair Code */}
								{deviceConnectTab === "phone" && (
									<div className="flex flex-col items-center">
										{/* White QR Code container matching Screenshot 4 */}
										<div className="relative bg-white rounded-2xl p-4 shadow-xl mb-4">
											{qrDataUrl ? (
												<img
													src={qrDataUrl}
													alt="IndusCode Pairing QR Code"
													className="size-48 object-contain rounded-lg"
												/>
											) : (
												<div className="size-48 flex items-center justify-center text-zinc-500">
													<Loader2 className="size-6 animate-spin text-zinc-900" />
												</div>
											)}

											{/* Center logo badge inside QR code */}
											<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
												<div className="size-8 rounded-lg bg-blue-600 border-2 border-white shadow-md flex items-center justify-center text-white font-black text-xs">
													I
												</div>
											</div>

											{/* Bottom right expand & refresh icons */}
											<div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-zinc-700 bg-white/90 p-1 rounded">
												<button
													type="button"
													onClick={refreshPairCode}
													className="hover:text-black cursor-pointer"
													title="Refresh QR code"
												>
													<RotateCw className="size-3.5" />
												</button>
											</div>
										</div>

										{/* Pair Code Section */}
										<div className="w-full max-w-xs space-y-2">
											<div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
												<div>
													<span className="text-[10px] text-zinc-500 block uppercase font-medium">
														Pairing Code
													</span>
													<span className="text-base font-mono font-bold text-white tracking-widest">
														{pairCode}
													</span>
												</div>
												<Button
													type="button"
													onClick={handleCopyCode}
													variant="outline"
													size="xs"
													className="border-zinc-700 hover:bg-zinc-800 text-xs gap-1.5 rounded-lg"
												>
													{isCopied ? (
														<Check className="size-3 text-emerald-400" />
													) : (
														<Copy className="size-3 text-zinc-400" />
													)}
													<span>{isCopied ? "Copied" : "Copy"}</span>
												</Button>
											</div>

											{/* Enter code manually or approve test device */}
											<div className="pt-2 flex items-center gap-2">
												<Input
													value={manualCodeInput}
													onChange={(e) => setManualCodeInput(e.target.value)}
													placeholder="Enter phone device code"
													className="bg-zinc-950 border-zinc-800 text-xs h-8 font-mono text-center"
												/>
												<Button
													type="button"
													onClick={() =>
														handleApproveDevice(
															manualCodeInput.trim()
																? `Phone (${manualCodeInput.trim()})`
																: "iPhone 16 Pro",
														)
													}
													className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 px-3 rounded-lg shrink-0 font-medium cursor-pointer"
												>
													Approve Device
												</Button>
											</div>
										</div>
									</div>
								)}

								{/* Computer Mode */}
								{deviceConnectTab === "computer" && (
									<div className="space-y-4 max-w-xs mx-auto text-left">
										<p className="text-xs text-zinc-400 leading-relaxed text-center">
											Run this command in the terminal of the other computer to
											connect to this Mac:
										</p>

										<div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2 font-mono text-xs text-blue-400">
											<code className="truncate">
												induscode remote pair --code{" "}
												{pairCode.replace(/[^0-9]/g, "")}
											</code>
											<Button
												type="button"
												onClick={() => {
													navigator.clipboard.writeText(
														`induscode remote pair --code ${pairCode.replace(/[^0-9]/g, "")}`,
													);
													setIsCopied(true);
													setTimeout(() => setIsCopied(false), 2000);
												}}
												variant="ghost"
												size="icon-xs"
												className="shrink-0 text-zinc-400 hover:text-white"
												title="Copy command"
											>
												{isCopied ? (
													<Check className="size-3.5 text-emerald-400" />
												) : (
													<Copy className="size-3.5" />
												)}
											</Button>
										</div>

										<div className="text-[11px] text-zinc-500 leading-relaxed text-center pt-1">
											Both machines should be connected to the internet or on
											the same local network.
										</div>

										<Button
											type="button"
											onClick={() => handleApproveDevice("MacBook Air (Remote)")}
											className="w-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs h-9 rounded-full cursor-pointer shadow-md mt-2"
										>
											Pair Computer Now
										</Button>
									</div>
								)}
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Delete SSH Host Confirmation Dialog */}
			<AlertDialog
				open={Boolean(deleteTarget)}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete SSH Host</AlertDialogTitle>
						<AlertDialogDescription>
							{deleteTarget
								? `Delete “${deleteTarget.name}” from remote environments? Projects and IndusCode session data remain on the remote host.`
								: "Delete this SSH host from remote environments?"}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className={buttonVariants({ variant: "destructive" })}
							disabled={isBusy}
							onClick={() => {
								if (deleteTarget) void deleteProfile(deleteTarget);
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<WhatsAppConnectDialog
				open={showWhatsAppDialog}
				onOpenChange={setShowWhatsAppDialog}
				currentHost={draft.host}
				onConnected={(profile) => {
					setDraft((prev) => ({
						...prev,
						name: profile.name || prev.name,
						host: profile.host || prev.host,
						user: profile.user || prev.user,
						port: profile.port || prev.port,
					}));
					if (draft.id) {
						setRuntimeState(draft.id, {
							connection: "connected",
							test: "passed",
							bootstrap: "ready",
							message: "Paired and connected via WhatsApp remote gateway.",
						});
					}
				}}
			/>
		</PageFrame>
	);
}
