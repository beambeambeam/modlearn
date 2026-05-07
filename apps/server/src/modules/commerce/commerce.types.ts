import type { DbClient } from "@/lib/db/orm";

export type CommerceItemType = "COURSE";
export type CommerceCurrency = string;

export interface CommercePriceSnapshot {
	itemType: CommerceItemType;
	courseId: string;
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

export interface CommerceBuyCourseInput {
	courseId: string;
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

export interface CommerceCoursePricingWindowView {
	id: string;
	courseId: string;
	price: string;
	currency: string;
	effectiveFrom: Date;
	effectiveTo: Date | null;
	createdBy: string;
	createdAt: Date;
	isActive: boolean;
}

export interface CommerceCoursePricingListInput {
	courseId: string;
	page?: number;
	limit?: number;
}

export interface CommerceCoursePricingCreateInput {
	courseId: string;
	price: string;
	currency: string;
	effectiveFrom: Date;
	effectiveTo?: Date | null;
}

export interface CommerceCoursePricingUpdateInput {
	id: string;
	patch: {
		price?: string;
		currency?: string;
		effectiveFrom?: Date;
		effectiveTo?: Date | null;
	};
}

export interface CommerceCoursePricingListView {
	items: CommerceCoursePricingWindowView[];
	pagination: CommercePricingPagination;
}

export interface CommerceServiceBaseParams {
	db: DbClient;
	userId: string;
}

export interface CommerceActivePriceQuery {
	db: DbClient;
	courseId: string;
	now?: Date;
}

export interface CommerceOwnershipQuery {
	db: DbClient;
	userId: string;
	courseId: string;
	now?: Date;
}

export class CommerceCourseNotFoundError extends Error {
	constructor() {
		super("Course not found");
		this.name = "CommerceCourseNotFoundError";
	}
}

// Temporary aliases so shared error handling still compiles until fully cleaned up.
export class CommerceContentNotFoundError extends CommerceCourseNotFoundError {}
export class CommercePlaylistNotFoundError extends CommerceCourseNotFoundError {}

export class CommerceCourseEmptyError extends Error {
	constructor() {
		super("Course has no lessons to purchase");
		this.name = "CommerceCourseEmptyError";
	}
}

export class CommercePlaylistEmptyError extends CommerceCourseEmptyError {}

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
