import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, isNull, lte, ne, or } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import {
	course,
	courseLesson,
	coursePricing,
	coursePurchase,
	order,
	payment,
	userLibrary,
} from "@/lib/db/schema";
import {
	type CommerceActivePriceQuery,
	type CommerceBuyCourseInput,
	type CommerceBuyView,
	CommerceCourseEmptyError,
	CommerceCourseNotFoundError,
	type CommerceCoursePricingCreateInput,
	type CommerceCoursePricingListInput,
	type CommerceCoursePricingListView,
	type CommerceCoursePricingUpdateInput,
	type CommerceCoursePricingWindowView,
	CommerceInvalidOrderItemError,
	CommerceItemAlreadyOwnedError,
	CommerceOrderNotFoundError,
	CommerceOrderStateError,
	type CommercePaymentMarkSuccessInput,
	type CommercePaymentRefundInput,
	type CommercePaymentSuccessView,
	CommercePriceNotFoundError,
	type CommercePriceSnapshot,
	CommercePricingWindowNotFoundError,
	CommercePricingWindowOverlapError,
	CommercePricingWindowValidationError,
	type CommerceRefundView,
} from "./commerce.types";

function buildProviderTransactionId(seed?: string): string {
	return seed ?? `mock-${randomUUID()}`;
}

async function assertCourseExists(db: DbClient, courseId: string) {
	const row = await db.query.course.findFirst({
		where: and(eq(course.id, courseId), eq(course.isDeleted, false)),
		columns: { id: true },
	});

	if (!row) {
		throw new CommerceCourseNotFoundError();
	}
}

async function assertCourseHasLessons(db: DbClient, courseId: string) {
	const [countRow] = await db
		.select({ total: count() })
		.from(courseLesson)
		.where(eq(courseLesson.courseId, courseId));

	if (Number(countRow?.total ?? 0) === 0) {
		throw new CommerceCourseEmptyError();
	}
}

async function resolveActiveCoursePrice(
	query: CommerceActivePriceQuery
): Promise<CommercePriceSnapshot> {
	const { db, courseId, now = new Date() } = query;
	const row = await db.query.coursePricing.findFirst({
		where: and(
			eq(coursePricing.courseId, courseId),
			lte(coursePricing.effectiveFrom, now),
			or(isNull(coursePricing.effectiveTo), gt(coursePricing.effectiveTo, now))
		),
		orderBy: [desc(coursePricing.effectiveFrom), desc(coursePricing.createdAt)],
	});

	if (!row) {
		throw new CommercePriceNotFoundError();
	}

	return {
		itemType: "COURSE",
		courseId,
		price: row.price,
		currency: row.currency.toUpperCase(),
	};
}

function findExistingOwnership(params: {
	db: DbClient;
	userId: string;
	courseId: string;
}) {
	const { db, userId, courseId } = params;
	return db.query.coursePurchase.findFirst({
		where: and(
			eq(coursePurchase.userId, userId),
			eq(coursePurchase.courseId, courseId)
		),
	});
}

function toCoursePricingWindowView(params: {
	row: typeof coursePricing.$inferSelect;
	now?: Date;
}): CommerceCoursePricingWindowView {
	const { row, now = new Date() } = params;
	const isActive =
		row.effectiveFrom <= now &&
		(row.effectiveTo === null || row.effectiveTo > now);
	return {
		id: row.id,
		courseId: row.courseId,
		price: row.price,
		currency: row.currency.toUpperCase(),
		effectiveFrom: row.effectiveFrom,
		effectiveTo: row.effectiveTo,
		createdBy: row.createdBy,
		createdAt: row.createdAt,
		isActive,
	};
}

function assertCoursePricingWindowValidity(params: {
	effectiveFrom: Date;
	effectiveTo: Date | null;
}) {
	const { effectiveFrom, effectiveTo } = params;
	if (effectiveTo && effectiveTo <= effectiveFrom) {
		throw new CommercePricingWindowValidationError(
			"effectiveTo must be greater than effectiveFrom"
		);
	}
}

async function assertNoCoursePricingOverlap(params: {
	db: DbClient;
	courseId: string;
	effectiveFrom: Date;
	effectiveTo: Date | null;
	excludeId?: string;
}) {
	const { db, courseId, effectiveFrom, effectiveTo, excludeId } = params;
	const overlap = await db.query.coursePricing.findFirst({
		where: and(
			eq(coursePricing.courseId, courseId),
			excludeId ? ne(coursePricing.id, excludeId) : undefined,
			effectiveTo ? lte(coursePricing.effectiveFrom, effectiveTo) : undefined,
			or(
				isNull(coursePricing.effectiveTo),
				gt(coursePricing.effectiveTo, effectiveFrom)
			)
		),
		columns: { id: true },
	});

	if (overlap) {
		throw new CommercePricingWindowOverlapError();
	}
}

async function grantCourseOwnership(params: {
	db: DbClient;
	orderId: string;
	userId: string;
	courseId: string;
	price: string;
}) {
	const { db, orderId, userId, courseId, price } = params;
	const existing = await findExistingOwnership({ db, userId, courseId });
	if (existing) {
		return 0;
	}

	await db.insert(coursePurchase).values({
		courseId,
		userId,
		price,
		status: "PAID",
		orderId,
	});
	await db.insert(userLibrary).values({
		userId,
		courseId,
		orderId,
	});
	return 1;
}

export async function listCoursePricingWindows(params: {
	db: DbClient;
	input: CommerceCoursePricingListInput;
}): Promise<CommerceCoursePricingListView> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	await assertCourseExists(db, input.courseId);

	const [countRow] = await db
		.select({ total: count() })
		.from(coursePricing)
		.where(eq(coursePricing.courseId, input.courseId));
	const total = Number(countRow?.total ?? 0);

	const rows = await db.query.coursePricing.findMany({
		where: eq(coursePricing.courseId, input.courseId),
		orderBy: [
			desc(coursePricing.effectiveFrom),
			desc(coursePricing.createdAt),
			desc(coursePricing.id),
		],
		limit,
		offset,
	});

	return {
		items: rows.map((row) => toCoursePricingWindowView({ row })),
		pagination: {
			page,
			limit,
			total,
			totalPages: total === 0 ? 0 : Math.ceil(total / limit),
		},
	};
}

export async function createCoursePricingWindow(params: {
	db: DbClient;
	createdBy: string;
	input: CommerceCoursePricingCreateInput;
}): Promise<CommerceCoursePricingWindowView> {
	const { db, createdBy, input } = params;
	await assertCourseExists(db, input.courseId);
	const effectiveTo = input.effectiveTo ?? null;
	assertCoursePricingWindowValidity({
		effectiveFrom: input.effectiveFrom,
		effectiveTo,
	});
	await assertNoCoursePricingOverlap({
		db,
		courseId: input.courseId,
		effectiveFrom: input.effectiveFrom,
		effectiveTo,
	});

	const [created] = await db
		.insert(coursePricing)
		.values({
			courseId: input.courseId,
			price: input.price,
			currency: input.currency.toUpperCase(),
			effectiveFrom: input.effectiveFrom,
			effectiveTo,
			createdBy,
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create course pricing window");
	}

	return toCoursePricingWindowView({ row: created });
}

export async function updateCoursePricingWindow(params: {
	db: DbClient;
	input: CommerceCoursePricingUpdateInput;
}): Promise<CommerceCoursePricingWindowView> {
	const { db, input } = params;
	const existing = await db.query.coursePricing.findFirst({
		where: eq(coursePricing.id, input.id),
	});
	if (!existing) {
		throw new CommercePricingWindowNotFoundError();
	}

	const nextEffectiveFrom = input.patch.effectiveFrom ?? existing.effectiveFrom;
	const nextEffectiveTo =
		input.patch.effectiveTo === undefined
			? existing.effectiveTo
			: input.patch.effectiveTo;
	assertCoursePricingWindowValidity({
		effectiveFrom: nextEffectiveFrom,
		effectiveTo: nextEffectiveTo,
	});
	await assertNoCoursePricingOverlap({
		db,
		courseId: existing.courseId,
		effectiveFrom: nextEffectiveFrom,
		effectiveTo: nextEffectiveTo,
		excludeId: existing.id,
	});

	const [updated] = await db
		.update(coursePricing)
		.set({
			price: input.patch.price ?? existing.price,
			currency: input.patch.currency?.toUpperCase() ?? existing.currency,
			effectiveFrom: nextEffectiveFrom,
			effectiveTo: nextEffectiveTo,
		})
		.where(eq(coursePricing.id, input.id))
		.returning();

	if (!updated) {
		throw new CommercePricingWindowNotFoundError();
	}

	return toCoursePricingWindowView({ row: updated });
}

export async function buyCourse(params: {
	db: DbClient;
	userId: string;
	input: CommerceBuyCourseInput;
}): Promise<CommerceBuyView> {
	const { db, userId, input } = params;
	await assertCourseExists(db, input.courseId);
	await assertCourseHasLessons(db, input.courseId);

	const owned = await findExistingOwnership({
		db,
		userId,
		courseId: input.courseId,
	});
	if (owned) {
		const paymentRow = owned.orderId
			? await db.query.payment.findFirst({
					where: eq(payment.orderId, owned.orderId),
				})
			: null;
		if (!(owned.orderId && paymentRow)) {
			throw new CommerceItemAlreadyOwnedError();
		}
		return {
			orderId: owned.orderId,
			paymentId: paymentRow.id,
			status: "PAID",
			alreadyOwned: true,
			grantedContentCount: 0,
		};
	}

	const activePrice = await resolveActiveCoursePrice({
		db,
		courseId: input.courseId,
	});

	return db.transaction(async (tx) => {
		const [createdOrder] = await tx
			.insert(order)
			.values({
				userId,
				totalAmount: activePrice.price,
				currency: activePrice.currency,
				itemType: "COURSE",
				courseId: input.courseId,
				status: "PAID",
			})
			.returning();

		if (!createdOrder) {
			throw new Error("Failed to create order");
		}

		const [createdPayment] = await tx
			.insert(payment)
			.values({
				orderId: createdOrder.id,
				providerTransactionId: buildProviderTransactionId(
					input.providerTransactionId
				),
				provider: "mock",
				amount: activePrice.price,
				currency: activePrice.currency,
				status: "SUCCESS",
				paidAt: new Date(),
			})
			.returning();

		if (!createdPayment) {
			throw new Error("Failed to create payment");
		}

		const grantsCreated = await grantCourseOwnership({
			db: tx,
			orderId: createdOrder.id,
			userId,
			courseId: input.courseId,
			price: activePrice.price,
		});

		return {
			orderId: createdOrder.id,
			paymentId: createdPayment.id,
			status: "PAID",
			alreadyOwned: false,
			grantedContentCount: grantsCreated,
		};
	});
}

export async function markPaymentSuccess(params: {
	db: DbClient;
	userId: string;
	input: CommercePaymentMarkSuccessInput;
}): Promise<CommercePaymentSuccessView> {
	const { db, userId, input } = params;
	const existingOrder = await db.query.order.findFirst({
		where: eq(order.id, input.orderId),
	});
	if (!existingOrder) {
		throw new CommerceOrderNotFoundError();
	}
	if (existingOrder.userId !== userId) {
		throw new CommerceOrderNotFoundError();
	}
	if (!existingOrder.courseId) {
		throw new CommerceInvalidOrderItemError("Order has no courseId");
	}
	if (existingOrder.status === "REFUNDED") {
		throw new CommerceOrderStateError("Order is already refunded");
	}
	const courseId = existingOrder.courseId;

	return db.transaction(async (tx) => {
		const [upsertedPayment] = await tx
			.insert(payment)
			.values({
				orderId: existingOrder.id,
				providerTransactionId: buildProviderTransactionId(
					input.providerTransactionId
				),
				provider: input.provider ?? "mock",
				amount: existingOrder.totalAmount,
				currency: existingOrder.currency,
				status: "SUCCESS",
				paidAt: new Date(),
			})
			.returning();

		if (!upsertedPayment) {
			throw new Error("Failed to create payment");
		}

		await tx
			.update(order)
			.set({ status: "PAID" })
			.where(eq(order.id, existingOrder.id));

		const grantsCreated = await grantCourseOwnership({
			db: tx,
			orderId: existingOrder.id,
			userId,
			courseId,
			price: existingOrder.totalAmount,
		});

		return {
			orderId: existingOrder.id,
			paymentId: upsertedPayment.id,
			status: "PAID",
			grantsCreated,
		};
	});
}

export function confirmPaymentWebhook(params: {
	db: DbClient;
	userId: string;
	input: CommercePaymentMarkSuccessInput;
}): Promise<CommercePaymentSuccessView> {
	return markPaymentSuccess(params);
}

export async function refundPayment(params: {
	db: DbClient;
	userId: string;
	input: CommercePaymentRefundInput;
}): Promise<CommerceRefundView> {
	const { db, userId, input } = params;
	const existingOrder = await db.query.order.findFirst({
		where: eq(order.id, input.orderId),
	});
	if (!existingOrder) {
		throw new CommerceOrderNotFoundError();
	}
	if (existingOrder.userId !== userId) {
		throw new CommerceOrderNotFoundError();
	}
	if (existingOrder.status !== "PAID") {
		throw new CommerceOrderStateError("Order is not paid");
	}

	return db.transaction(async (tx) => {
		const revokedRows = await tx
			.delete(userLibrary)
			.where(eq(userLibrary.orderId, existingOrder.id))
			.returning();
		await tx
			.delete(coursePurchase)
			.where(eq(coursePurchase.orderId, existingOrder.id));
		await tx
			.update(order)
			.set({ status: "REFUNDED" })
			.where(eq(order.id, existingOrder.id));

		return {
			orderId: existingOrder.id,
			status: "REFUNDED",
			revokedCount: revokedRows.length,
		};
	});
}
