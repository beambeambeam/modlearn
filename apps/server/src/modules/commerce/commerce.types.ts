import type { DbClient } from "@/lib/db/orm";

export type CommerceItemType = "CONTENT" | "PLAYLIST";
export type CommerceCurrency = string;

export interface CommercePriceSnapshot {
	itemType: CommerceItemType;
	contentId: string | null;
	playlistId: string | null;
	price: string;
	currency: CommerceCurrency;
}

export interface CommercePaymentMarkSuccessInput {
	orderId: string;
	providerTransactionId: string;
	provider?: string;
}

export interface CommercePaymentRefundInput {
	orderId: string;
	reason?: string;
}

export interface CommerceBuyContentInput {
	contentId: string;
	providerTransactionId?: string;
}

export interface CommerceBuyPlaylistInput {
	playlistId: string;
	providerTransactionId?: string;
}

export interface CommercePaymentSuccessView {
	orderId: string;
	paymentId: string;
	status: "PAID";
	grantsCreated: number;
}

export interface CommerceRefundView {
	orderId: string;
	status: "REFUNDED";
	revokedCount: number;
}

export interface CommerceBuyView {
	orderId: string;
	paymentId: string;
	status: "PAID";
	alreadyOwned: boolean;
	grantedContentCount: number;
}

export interface CommercePricingPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface CommerceContentPricingWindowView {
	id: string;
	contentId: string;
	price: string;
	currency: string;
	effectiveFrom: Date;
	effectiveTo: Date | null;
	createdBy: string;
	createdAt: Date;
	isActive: boolean;
}

export interface CommercePlaylistPricingWindowView {
	id: string;
	playlistId: string;
	price: string;
	currency: string;
	effectiveFrom: Date;
	effectiveTo: Date | null;
	createdBy: string;
	createdAt: Date;
	isActive: boolean;
}

export interface CommerceContentPricingListInput {
	contentId: string;
	page?: number;
	limit?: number;
}

export interface CommercePlaylistPricingListInput {
	playlistId: string;
	page?: number;
	limit?: number;
}

export interface CommerceContentPricingCreateInput {
	contentId: string;
	price: string;
	currency: string;
	effectiveFrom: Date;
	effectiveTo?: Date | null;
}

export interface CommercePlaylistPricingCreateInput {
	playlistId: string;
	price: string;
	currency: string;
	effectiveFrom: Date;
	effectiveTo?: Date | null;
}

export interface CommerceContentPricingUpdateInput {
	id: string;
	patch: {
		price?: string;
		currency?: string;
		effectiveFrom?: Date;
		effectiveTo?: Date | null;
	};
}

export interface CommercePlaylistPricingUpdateInput {
	id: string;
	patch: {
		price?: string;
		currency?: string;
		effectiveFrom?: Date;
		effectiveTo?: Date | null;
	};
}

export interface CommerceContentPricingListView {
	items: CommerceContentPricingWindowView[];
	pagination: CommercePricingPagination;
}

export interface CommercePlaylistPricingListView {
	items: CommercePlaylistPricingWindowView[];
	pagination: CommercePricingPagination;
}

export interface CommerceServiceBaseParams {
	db: DbClient;
	userId: string;
}

export interface CommerceActivePriceQuery {
	db: DbClient;
	contentId?: string;
	playlistId?: string;
	now?: Date;
}

export interface CommerceOwnershipQuery {
	db: DbClient;
	userId: string;
	contentId?: string;
	playlistId?: string;
	now?: Date;
}

export class CommerceContentNotFoundError extends Error {
	constructor() {
		super("Content not found");
		this.name = "CommerceContentNotFoundError";
	}
}

export class CommercePlaylistNotFoundError extends Error {
	constructor() {
		super("Playlist not found");
		this.name = "CommercePlaylistNotFoundError";
	}
}

export class CommercePlaylistEmptyError extends Error {
	constructor() {
		super("Playlist has no episodes to purchase");
		this.name = "CommercePlaylistEmptyError";
	}
}

export class CommerceItemAlreadyOwnedError extends Error {
	constructor() {
		super("Item is already owned");
		this.name = "CommerceItemAlreadyOwnedError";
	}
}

export class CommercePriceNotFoundError extends Error {
	constructor() {
		super("Active price not found");
		this.name = "CommercePriceNotFoundError";
	}
}

export class CommercePricingWindowNotFoundError extends Error {
	constructor() {
		super("Pricing window not found");
		this.name = "CommercePricingWindowNotFoundError";
	}
}

export class CommercePricingWindowOverlapError extends Error {
	constructor(message = "Pricing window overlaps with an existing window") {
		super(message);
		this.name = "CommercePricingWindowOverlapError";
	}
}

export class CommercePricingWindowValidationError extends Error {
	constructor(message = "Invalid pricing window") {
		super(message);
		this.name = "CommercePricingWindowValidationError";
	}
}

export class CommerceCurrencyMismatchError extends Error {
	constructor() {
		super("Cart contains mixed currencies");
		this.name = "CommerceCurrencyMismatchError";
	}
}

export class CommerceOrderNotFoundError extends Error {
	constructor() {
		super("Order not found");
		this.name = "CommerceOrderNotFoundError";
	}
}

export class CommerceOrderStateError extends Error {
	constructor(message = "Order is not in a valid state") {
		super(message);
		this.name = "CommerceOrderStateError";
	}
}

export class CommercePaymentConflictError extends Error {
	constructor() {
		super("Payment transaction already used for another order");
		this.name = "CommercePaymentConflictError";
	}
}

export class CommerceInvalidOrderItemError extends Error {
	constructor(message = "Invalid order item payload") {
		super(message);
		this.name = "CommerceInvalidOrderItemError";
	}
}
