export interface IndusCodeClientIdentity {
	name?: string;
	version?: string;
	platform?: string;
	platformVersion?: string;
}

interface IndusCodeClientIdentityGlobal {
	__induscodeClientIdentity?: IndusCodeClientIdentity;
}

function identityHolder(): IndusCodeClientIdentityGlobal {
	return globalThis as IndusCodeClientIdentityGlobal;
}

export function setIndusCodeClientIdentity(
	identity: IndusCodeClientIdentity | undefined,
): void {
	identityHolder().__induscodeClientIdentity = identity;
}

export function getIndusCodeClientIdentity(): IndusCodeClientIdentity | undefined {
	return identityHolder().__induscodeClientIdentity;
}
