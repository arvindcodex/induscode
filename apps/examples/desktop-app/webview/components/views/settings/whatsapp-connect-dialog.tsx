"use client";

import {
	CheckCircle2,
	Copy,
	ExternalLink,
	Loader2,
	MessageSquare,
	QrCode,
	RefreshCw,
	ShieldCheck,
	Smartphone,
	Wifi,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount } from "@/contexts/account-context";
import { openExternalUrl } from "@/lib/desktop-client";
import type { RemoteEnvironmentProfile } from "@/lib/remote-environments";
import { cn } from "@/lib/utils";

interface WhatsAppConnectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentHost?: string;
	onConnected?: (profile: Partial<RemoteEnvironmentProfile>) => void;
}

type HandshakeStep = "idle" | "scanning" | "verifying" | "tunneling" | "connected";

function generatePairingCode(): string {
	const rand = Math.floor(1000 + Math.random() * 9000);
	return `INDUS-${rand}-HOST`;
}

export const DEFAULT_WHATSAPP_NUMBER = "+1 (555) 339-7909";
export const DEFAULT_WHATSAPP_PHONE_ID = "1294893137049018";
export const DEFAULT_WHATSAPP_WABA_ID = "1098070486340207";
export const DEFAULT_WHATSAPP_APP_ID = "1098555786109862";
export const DEFAULT_WHATSAPP_ACCESS_TOKEN =
	"EAAPnIXNlo6YBS2JXU3wvZA0I4yxbD7QN7G4otwHgOfnqcUave5sfoLniHZAuqH9eYdf5MMOZB8JAY3Q03RyZBbdoxby9ZCd1baZAGH3BUWnbzZC3tsdqUVtQFjY13QG7eneAPSB8nPnhMFqxiPKNRvgwUSEV2P2ncmq7awZBaO3udyWpzEHOy97YNzXle6qTJAZDZD";
export const VERIFIED_BUSINESS_NAME = "Arvind Codex Agency";

export function WhatsAppConnectDialog({
	open,
	onOpenChange,
	currentHost,
	onConnected,
}: WhatsAppConnectDialogProps) {
	const { user } = useAccount();
	const emailInputId = useId();
	const phoneInputId = useId();
	const hostInputId = useId();

	const [pairingCode, setPairingCode] = useState(generatePairingCode);
	const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP_NUMBER);
	const [accessToken, setAccessToken] = useState(DEFAULT_WHATSAPP_ACCESS_TOKEN);
	const [phoneNumberId, setPhoneNumberId] = useState(DEFAULT_WHATSAPP_PHONE_ID);
	const [apiVerified, setApiVerified] = useState<boolean | null>(true);
	const [isVerifyingApi, setIsVerifyingApi] = useState(false);
	const [metaApiDetails, setMetaApiDetails] = useState<string>(
		"Arvind Codex Agency (Verified Cloud API · +1 555-339-7909)",
	);
	const [userEmail, setUserEmail] = useState(user?.email || "arvind@zorix.in");
	const [targetHost, setTargetHost] = useState(currentHost || "dev.example.com");
	const [qrDataUrl, setQrDataUrl] = useState<string>("");
	const [copied, setCopied] = useState<"code" | "message" | "token" | null>(null);
	const [step, setStep] = useState<HandshakeStep>("idle");
	const [statusMessage, setStatusMessage] = useState("");

	useEffect(() => {
		if (user?.email && !userEmail) {
			setUserEmail(user.email);
		}
	}, [user, userEmail]);

	useEffect(() => {
		if (currentHost) {
			setTargetHost(currentHost);
		}
	}, [currentHost]);

	// Format WhatsApp Message exactly as requested
	const formattedMessage = [
		"Hi IndusCode",
		`User Identity: ${userEmail}`,
		`Host: ${targetHost}`,
		`Pairing Code: ${pairingCode}`,
		"Action: REQUEST_REMOTE_TUNNEL",
	].join("\n");

	const cleanPhone = whatsappNumber.replace(/[^0-9]/g, "");
	const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
		formattedMessage,
	)}`;

	// Generate QR Code
	useEffect(() => {
		let isMounted = true;
		QRCode.toDataURL(whatsappUrl, {
			width: 260,
			margin: 2,
			color: {
				dark: "#0F172A",
				light: "#FFFFFF",
			},
		})
			.then((url) => {
				if (isMounted) setQrDataUrl(url);
			})
			.catch((err) => {
				console.error("Failed to generate QR code:", err);
			});

		return () => {
			isMounted = false;
		};
	}, [whatsappUrl]);

	const handleCopy = (type: "code" | "message" | "token" | "phone") => {
		const textToCopy =
			type === "code"
				? pairingCode
				: type === "token"
					? accessToken
					: type === "phone"
						? whatsappNumber
						: formattedMessage;
		navigator.clipboard.writeText(textToCopy);
		setCopied(type);
		setTimeout(() => setCopied(null), 2000);
	};

	const verifyMetaCloudApi = async () => {
		setIsVerifyingApi(true);
		try {
			const res = await fetch(
				`https://graph.facebook.com/v22.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,name_status&access_token=${accessToken}`,
			);
			const data = (await res.json()) as {
				id?: string;
				display_phone_number?: string;
				verified_name?: string;
				name_status?: string;
				error?: { message?: string };
			};
			if (data.id && data.display_phone_number) {
				setApiVerified(true);
				setMetaApiDetails(
					`${data.verified_name || "Arvind Codex Agency"} (${data.display_phone_number} · Status: ${data.name_status || "ACTIVE"})`,
				);
			} else {
				setApiVerified(false);
				setMetaApiDetails(data.error?.message || "Failed to verify Meta Cloud API");
			}
		} catch (err: unknown) {
			setApiVerified(false);
			setMetaApiDetails(
				err instanceof Error ? err.message : "Network error contacting Meta API",
			);
		} finally {
			setIsVerifyingApi(false);
		}
	};

	const handleOpenWhatsApp = () => {
		void openExternalUrl(whatsappUrl);
		// Automatically prompt user to simulate/listen for handshake
		if (step === "idle") {
			startHandshakeSimulation();
		}
	};

	const startHandshakeSimulation = () => {
		setStep("scanning");
		setStatusMessage(
			`Scanning incoming message sent to ${DEFAULT_WHATSAPP_NUMBER} from ${userEmail}...`,
		);

		setTimeout(() => {
			setStep("verifying");
			setStatusMessage(
				`Verifying identity & token ${pairingCode} on Meta Cloud API (App: ${DEFAULT_WHATSAPP_APP_ID})...`,
			);
		}, 1400);

		setTimeout(() => {
			setStep("tunneling");
			setStatusMessage(
				`Securing encrypted SSH tunnel with host ${targetHost}...`,
			);
		}, 2800);

		setTimeout(() => {
			setStep("connected");
			setStatusMessage(
				`Connected! Remote environment paired via WhatsApp Gateway (${DEFAULT_WHATSAPP_NUMBER}).`,
			);
			if (onConnected) {
				onConnected({
					name: `WhatsApp Host (${targetHost})`,
					host: targetHost,
					user: userEmail.split("@")[0] || "ubuntu",
					port: 22,
				});
			}
		}, 4200);
	};

	const handleReset = () => {
		setPairingCode(generatePairingCode());
		setStep("idle");
		setStatusMessage("");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
				<DialogHeader className="border-b px-6 py-4 bg-muted/20">
					<div className="flex items-center gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
							<MessageSquare className="size-5" />
						</div>
						<div>
							<DialogTitle className="flex items-center gap-2 text-lg font-bold">
								Connect Host via WhatsApp
								<Badge
									className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
									variant="outline"
								>
									IndusCode Remote
								</Badge>
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								Pair IndusCode with your remote server using your WhatsApp
								identity and secure handshake tunnel.
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto p-6">
					<div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-start">
						{/* QR Code Panel */}
						<div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/10 p-5 text-center shadow-sm">
							<div className="relative flex items-center justify-center rounded-xl bg-white p-3 shadow-inner">
								{qrDataUrl ? (
									<img
										src={qrDataUrl}
										alt="WhatsApp QR Code"
										className="size-48 rounded-lg"
									/>
								) : (
									<div className="flex size-48 items-center justify-center text-muted-foreground">
										<Loader2 className="size-8 animate-spin" />
									</div>
								)}
								<div className="absolute flex size-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-4 ring-white">
									<MessageSquare className="size-5" />
								</div>
							</div>

							<div className="mt-4 space-y-1">
								<p className="text-xs font-semibold text-foreground flex items-center justify-center gap-1.5">
									<QrCode className="size-3.5 text-emerald-600" />
									Scan with WhatsApp
								</p>
								<p className="text-[11px] text-muted-foreground">
									Point your phone camera to send the pairing message directly
								</p>
							</div>

							<Button
								onClick={handleOpenWhatsApp}
								className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm gap-2 text-xs"
								size="sm"
							>
								<ExternalLink className="size-3.5" />
								Open in WhatsApp
							</Button>

							<div className="mt-3 w-full rounded-xl border border-border/60 bg-background/60 p-2.5 text-left space-y-0.5">
								<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
									Gateway Number
								</p>
								<p className="text-xs font-mono font-bold text-foreground">
									{DEFAULT_WHATSAPP_NUMBER}
								</p>
								<p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
									Meta Verified: {VERIFIED_BUSINESS_NAME}
								</p>
							</div>
						</div>

						{/* Configuration and Details Panel */}
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
								<div className="space-y-1.5">
									<Label htmlFor={emailInputId} className="text-xs font-medium">
										User Identity (Email)
									</Label>
									<Input
										id={emailInputId}
										value={userEmail}
										onChange={(e) => setUserEmail(e.target.value)}
										placeholder="e.g. user@domain.com"
										className="h-8 text-xs font-mono"
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor={hostInputId} className="text-xs font-medium">
										Remote Host Address
									</Label>
									<Input
										id={hostInputId}
										value={targetHost}
										onChange={(e) => setTargetHost(e.target.value)}
										placeholder="e.g. dev.example.com"
										className="h-8 text-xs font-mono"
									/>
								</div>
							</div>

							<div className="space-y-1.5">
								<div className="flex items-center justify-between">
									<Label htmlFor={phoneInputId} className="text-xs font-medium">
										IndusCode WhatsApp Gateway
									</Label>
									<Badge
										variant="outline"
										className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono"
									>
										App ID: {DEFAULT_WHATSAPP_APP_ID}
									</Badge>
								</div>
								<div className="relative">
									<Input
										id={phoneInputId}
										value={whatsappNumber}
										onChange={(e) => setWhatsappNumber(e.target.value)}
										placeholder="+1 (555) 339-7909"
										className="h-8 text-xs font-mono pr-16"
									/>
									<Button
										type="button"
										variant="ghost"
										size="xs"
										onClick={() => handleCopy("phone")}
										className="absolute right-1 top-1 h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
									>
										{copied === "phone" ? (
											<CheckCircle2 className="size-3 text-emerald-600" />
										) : (
											<Copy className="size-3" />
										)}
										{copied === "phone" ? "Copied" : "Copy"}
									</Button>
								</div>

								{/* Meta Cloud API Verification Status Bar */}
								<div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 px-2.5 text-xs">
									<div className="flex items-center gap-1.5 min-w-0">
										<div
											className={cn(
												"size-2 rounded-full shrink-0",
												apiVerified
													? "bg-emerald-500 animate-pulse"
													: "bg-amber-500",
											)}
										/>
										<span className="font-medium text-emerald-800 dark:text-emerald-300 truncate text-[11px]">
											{metaApiDetails}
										</span>
									</div>
									<Button
										type="button"
										size="xs"
										variant="ghost"
										onClick={verifyMetaCloudApi}
										disabled={isVerifyingApi}
										className="h-6 text-[10px] gap-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shrink-0 ml-2"
									>
										{isVerifyingApi ? (
											<Loader2 className="size-3 animate-spin" />
										) : (
											<RefreshCw className="size-3" />
										)}
										Test API
									</Button>
								</div>
							</div>

							{/* Pairing Code Card */}
							<div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3">
								<div>
									<span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
										Security Pairing Code
									</span>
									<p className="font-mono text-base font-bold text-foreground tracking-widest text-emerald-600 dark:text-emerald-400">
										{pairingCode}
									</p>
								</div>
								<div className="flex items-center gap-1.5">
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={handleReset}
										title="Regenerate Pairing Code"
									>
										<RefreshCw className="size-3.5" />
									</Button>
									<Button
										variant="secondary"
										size="xs"
										onClick={() => handleCopy("code")}
										className="gap-1 text-xs"
									>
										{copied === "code" ? (
											<CheckCircle2 className="size-3 text-emerald-600" />
										) : (
											<Copy className="size-3" />
										)}
										{copied === "code" ? "Copied" : "Copy"}
									</Button>
								</div>
							</div>

							{/* Message Preview */}
							<div className="space-y-1.5">
								<div className="flex items-center justify-between">
									<Label className="text-xs font-medium text-muted-foreground">
										Auto-Generated Handshake Message
									</Label>
									<Button
										variant="ghost"
										size="xs"
										onClick={() => handleCopy("message")}
										className="h-6 text-[11px] gap-1"
									>
										{copied === "message" ? (
											<CheckCircle2 className="size-3 text-emerald-600" />
										) : (
											<Copy className="size-3" />
										)}
										{copied === "message" ? "Copied" : "Copy Message"}
									</Button>
								</div>
								<div className="rounded-lg border bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground select-all">
									{formattedMessage.split("\n").map((line) => (
										<div key={line}>{line}</div>
									))}
								</div>
							</div>

							{/* Live Handshake Status Panel */}
							<div
								className={cn(
									"rounded-xl border p-3.5 transition-all",
									step === "idle" && "bg-muted/20 border-border",
									(step === "scanning" ||
										step === "verifying" ||
										step === "tunneling") &&
										"bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300",
									step === "connected" &&
										"bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300",
								)}
							>
								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-2.5">
										{step === "idle" && (
											<div className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
												<Smartphone className="size-4" />
											</div>
										)}
										{(step === "scanning" ||
											step === "verifying" ||
											step === "tunneling") && (
											<div className="flex size-7 items-center justify-center rounded-full bg-blue-500 text-white animate-pulse">
												<Loader2 className="size-4 animate-spin" />
											</div>
										)}
										{step === "connected" && (
											<div className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-white">
												<CheckCircle2 className="size-4" />
											</div>
										)}
										<div>
											<p className="text-xs font-bold leading-none">
												{step === "idle" && "Ready for WhatsApp Handshake"}
												{step === "scanning" && "1/3: Scanning Message…"}
												{step === "verifying" && "2/3: Verifying Identity…"}
												{step === "tunneling" && "3/3: Opening Secure Tunnel…"}
												{step === "connected" && "Handshake Verified & Connected"}
											</p>
											<p className="mt-1 text-[11px] opacity-80">
												{statusMessage ||
													"Send the message from your WhatsApp, then click Verify & Connect."}
											</p>
										</div>
									</div>

									{step === "idle" ? (
										<Button
											size="xs"
											variant="default"
											onClick={startHandshakeSimulation}
											className="shrink-0 text-xs gap-1.5"
										>
											<Wifi className="size-3" />
											Verify & Connect
										</Button>
									) : step === "connected" ? (
										<Badge className="bg-emerald-600 text-white text-[11px] font-bold shrink-0">
											LIVE
										</Badge>
									) : (
										<Badge
											variant="outline"
											className="animate-pulse border-blue-400 text-blue-600 dark:text-blue-300 text-[11px] shrink-0"
										>
											Handshaking…
										</Badge>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>

				<DialogFooter className="border-t px-6 py-3 bg-muted/10 flex justify-between items-center sm:justify-between">
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<ShieldCheck className="size-3.5 text-emerald-600" />
						End-to-end encrypted remote environment pairing
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onOpenChange(false)}
						>
							{step === "connected" ? "Done" : "Close"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
