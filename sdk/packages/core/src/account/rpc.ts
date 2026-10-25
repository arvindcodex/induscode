import type {
	IndusCodeAccountActionRequest,
	ProviderActionRequest,
} from "@induscode/shared";
import type {
	IndusCodeAccountBalance,
	IndusCodeAccountOrganization,
	IndusCodeAccountOrganizationBalance,
	IndusCodeAccountOrganizationUsageTransaction,
	IndusCodeAccountPaymentTransaction,
	IndusCodeAccountUsageTransaction,
	IndusCodeAccountUser,
	FeaturebaseTokenResponse,
} from "./types";

export interface IndusCodeAccountOperations {
	fetchMe(): Promise<IndusCodeAccountUser>;
	fetchBalance(userId?: string): Promise<IndusCodeAccountBalance>;
	fetchUsageTransactions(
		userId?: string,
	): Promise<IndusCodeAccountUsageTransaction[]>;
	fetchPaymentTransactions(
		userId?: string,
	): Promise<IndusCodeAccountPaymentTransaction[]>;
	fetchUserOrganizations(): Promise<IndusCodeAccountOrganization[]>;
	fetchOrganizationBalance(
		organizationId: string,
	): Promise<IndusCodeAccountOrganizationBalance>;
	fetchOrganizationUsageTransactions(input: {
		organizationId: string;
		memberId?: string;
	}): Promise<IndusCodeAccountOrganizationUsageTransaction[]>;
	switchAccount(organizationId?: string | null): Promise<void>;
	fetchFeaturebaseToken?(): Promise<FeaturebaseTokenResponse | undefined>;
}

export function isIndusCodeAccountActionRequest(
	request: ProviderActionRequest,
): request is IndusCodeAccountActionRequest {
	return request.action === "induscodeAccount";
}

export async function executeIndusCodeAccountAction(
	request: IndusCodeAccountActionRequest,
	service: IndusCodeAccountOperations,
): Promise<unknown> {
	switch (request.operation) {
		case "fetchMe":
			return service.fetchMe();
		case "fetchBalance":
			return service.fetchBalance(request.userId);
		case "fetchUsageTransactions":
			return service.fetchUsageTransactions(request.userId);
		case "fetchPaymentTransactions":
			return service.fetchPaymentTransactions(request.userId);
		case "fetchUserOrganizations":
			return service.fetchUserOrganizations();
		case "fetchOrganizationBalance":
			return service.fetchOrganizationBalance(request.organizationId);
		case "fetchOrganizationUsageTransactions":
			return service.fetchOrganizationUsageTransactions({
				organizationId: request.organizationId,
				memberId: request.memberId,
			});
		case "switchAccount":
			await service.switchAccount(request.organizationId);
			return { updated: true };
		case "fetchFeaturebaseToken":
			return service.fetchFeaturebaseToken?.();
		default: {
			const exhaustive: never = request;
			throw new Error(
				`Unsupported IndusCode account operation: ${String(exhaustive)}`,
			);
		}
	}
}

export interface ProviderActionExecutor {
	runProviderAction(request: ProviderActionRequest): Promise<{
		result: unknown;
	}>;
}

export class RpcIndusCodeAccountService implements IndusCodeAccountOperations {
	private readonly executor: ProviderActionExecutor;

	constructor(executor: ProviderActionExecutor) {
		this.executor = executor;
	}

	public async fetchMe(): Promise<IndusCodeAccountUser> {
		return this.request<IndusCodeAccountUser>({
			action: "induscodeAccount",
			operation: "fetchMe",
		});
	}

	public async fetchBalance(userId?: string): Promise<IndusCodeAccountBalance> {
		return this.request<IndusCodeAccountBalance>({
			action: "induscodeAccount",
			operation: "fetchBalance",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchUsageTransactions(
		userId?: string,
	): Promise<IndusCodeAccountUsageTransaction[]> {
		return this.request<IndusCodeAccountUsageTransaction[]>({
			action: "induscodeAccount",
			operation: "fetchUsageTransactions",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchPaymentTransactions(
		userId?: string,
	): Promise<IndusCodeAccountPaymentTransaction[]> {
		return this.request<IndusCodeAccountPaymentTransaction[]>({
			action: "induscodeAccount",
			operation: "fetchPaymentTransactions",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchUserOrganizations(): Promise<IndusCodeAccountOrganization[]> {
		return this.request<IndusCodeAccountOrganization[]>({
			action: "induscodeAccount",
			operation: "fetchUserOrganizations",
		});
	}

	public async fetchOrganizationBalance(
		organizationId: string,
	): Promise<IndusCodeAccountOrganizationBalance> {
		const orgId = organizationId.trim();
		if (!orgId) {
			throw new Error("organizationId is required");
		}
		return this.request<IndusCodeAccountOrganizationBalance>({
			action: "induscodeAccount",
			operation: "fetchOrganizationBalance",
			organizationId: orgId,
		});
	}

	public async fetchOrganizationUsageTransactions(input: {
		organizationId: string;
		memberId?: string;
	}): Promise<IndusCodeAccountOrganizationUsageTransaction[]> {
		const orgId = input.organizationId.trim();
		if (!orgId) {
			throw new Error("organizationId is required");
		}
		return this.request<IndusCodeAccountOrganizationUsageTransaction[]>({
			action: "induscodeAccount",
			operation: "fetchOrganizationUsageTransactions",
			organizationId: orgId,
			...(input.memberId?.trim() ? { memberId: input.memberId.trim() } : {}),
		});
	}

	public async switchAccount(organizationId?: string | null): Promise<void> {
		await this.request<{ updated: boolean }>({
			action: "induscodeAccount",
			operation: "switchAccount",
			organizationId: organizationId?.trim() || null,
		});
	}

	public async fetchFeaturebaseToken(): Promise<
		FeaturebaseTokenResponse | undefined
	> {
		return this.request<FeaturebaseTokenResponse | undefined>({
			action: "induscodeAccount",
			operation: "fetchFeaturebaseToken",
		});
	}

	private async request<T>(request: IndusCodeAccountActionRequest): Promise<T> {
		const response = await this.executor.runProviderAction(request);
		return response.result as T;
	}
}
