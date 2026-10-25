"use client";

import type { IndusCodeAccountOrganization, IndusCodeAccountUser } from "@induscode/core";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { isIndusCodeAccountNotAuthenticatedResult } from "@/lib/induscode-account-state";
import { desktopClient } from "@/lib/desktop-client";

export const ACCOUNT_IDENTITY_STORAGE_KEY = "induscode.code.account-identity.v1";

const SIGNED_OUT_ERROR_MARKERS = [
	"No IndusCode account auth token found",
	"no longer valid",
];

type AccountContextValue = {
	user: IndusCodeAccountUser | null;
	/** False until the first identity lookup has finished, so a `null` user
	 * can be told apart from "still loading". */
	accountReady: boolean;
	organizations: IndusCodeAccountOrganization[];
	activeOrganization: IndusCodeAccountOrganization | null;
	refreshAccount: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue>({
	user: null,
	accountReady: false,
	organizations: [],
	activeOrganization: null,
	refreshAccount: async () => undefined,
});

export function parseCachedAccountUser(
	raw: string | null,
): IndusCodeAccountUser | null {
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as { user?: IndusCodeAccountUser | null };
		const user = parsed?.user;
		if (!user || typeof user !== "object") {
			return null;
		}
		if (
			typeof user.email !== "string" &&
			typeof user.displayName !== "string"
		) {
			return null;
		}
		return user;
	} catch {
		return null;
	}
}

function readCachedAccountUser(): IndusCodeAccountUser | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		return parseCachedAccountUser(
			window.localStorage.getItem(ACCOUNT_IDENTITY_STORAGE_KEY),
		);
	} catch {
		return null;
	}
}

function writeCachedAccountUser(user: IndusCodeAccountUser | null): void {
	if (typeof window === "undefined") {
		return;
	}
	try {
		if (user) {
			window.localStorage.setItem(
				ACCOUNT_IDENTITY_STORAGE_KEY,
				JSON.stringify({ user }),
			);
		} else {
			window.localStorage.removeItem(ACCOUNT_IDENTITY_STORAGE_KEY);
		}
	} catch {
		// Account identity still works for this session without the cache.
	}
}

export function isSignedOutAccountError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return SIGNED_OUT_ERROR_MARKERS.some((marker) => message.includes(marker));
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<IndusCodeAccountUser | null>(null);
	const [accountReady, setAccountReady] = useState(false);

	const refreshAccount = useCallback(async () => {
		try {
			const me = await desktopClient.invoke<IndusCodeAccountUser>("induscode_account", {
				action: "induscodeAccount",
				operation: "fetchMe",
			});
			// Signed out arrives as a typed result, not an error: an expected
			// state that clears the cached identity without any error handling.
			if (isIndusCodeAccountNotAuthenticatedResult(me)) {
				setUser(null);
				writeCachedAccountUser(null);
				return;
			}
			setUser((prev) => {
				const nextUser =
					me &&
					prev &&
					me.id === prev.id &&
					!me.photoUrl &&
					prev.photoUrl
						? { ...me, photoUrl: prev.photoUrl }
						: me;
				if (!nextUser && !prev) return null;
				if (
					prev &&
					nextUser &&
					prev.id === nextUser.id &&
					prev.email === nextUser.email &&
					prev.displayName === nextUser.displayName &&
					prev.photoUrl === nextUser.photoUrl
				) {
					return prev;
				}
				writeCachedAccountUser(nextUser ?? null);
				return nextUser ?? null;
			});
		} catch (error) {
			if (isSignedOutAccountError(error)) {
				setUser(null);
				writeCachedAccountUser(null);
			}
			// Transient failures (offline, sidecar restarting) keep the cached
			// identity rather than flashing a signed-out state.
		} finally {
			setAccountReady(true);
		}
	}, []);

	useEffect(() => {
		// Seed from the cached identity after mount so the signed-in name renders
		// without waiting on the network fetch, which revalidates it right after.
		// localStorage must not be read during the initial render: the server
		// renders the signed-out state, and a differing first client render would
		// be a hydration mismatch.
		setUser((current) => current ?? readCachedAccountUser());
		void refreshAccount();

		// Real-time synchronization: listen to account_changed broadcast from sidecar
		const unsubscribeAccountChanged = desktopClient.subscribe(
			"account_changed",
			(payload: any) => {
				if (payload?.authenticated === false || payload?.user === null) {
					setUser(null);
					writeCachedAccountUser(null);
				} else {
					void refreshAccount();
				}
			},
		);

		const handleFocus = () => {
			void refreshAccount();
		};
		window.addEventListener("focus", handleFocus);
		return () => {
			window.removeEventListener("focus", handleFocus);
			unsubscribeAccountChanged();
		};
	}, [refreshAccount]);

	const value = useMemo<AccountContextValue>(() => {
		const organizations = user?.organizations ?? [];
		return {
			user,
			accountReady,
			organizations,
			activeOrganization:
				organizations.find((organization) => organization.active) ?? null,
			refreshAccount,
		};
	}, [accountReady, refreshAccount, user]);

	return (
		<AccountContext.Provider value={value}>{children}</AccountContext.Provider>
	);
}

export function useAccount(): AccountContextValue {
	return useContext(AccountContext);
}
