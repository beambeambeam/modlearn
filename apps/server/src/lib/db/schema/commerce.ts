import { relations } from "drizzle-orm";
import {
	decimal,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_helpers";
import { user } from "./auth";
import { course } from "./course";

export const cartItemTypeEnum = pgEnum("cart_item_type", ["COURSE"]);

export const orderStatusEnum = pgEnum("order_status", [
	"PENDING",
	"PAID",
	"FAILED",
	"REFUNDED",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
	"INITIATED",
	"SUCCESS",
	"FAILED",
]);

export const order = pgTable(
	"order",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		totalAmount: decimal("total_amount", {
			precision: 10,
			scale: 2,
		}).notNull(),
		currency: text("currency").notNull(),
		itemType: cartItemTypeEnum("item_type").notNull(),
		courseId: uuid("course_id").references(() => course.id, {
			onDelete: "set null",
		}),
		status: orderStatusEnum("status").notNull(),
		...timestamps,
	},
	(table) => [
		index("order_userId_idx").on(table.userId),
		index("order_status_idx").on(table.status),
		index("order_courseId_idx").on(table.courseId),
		index("order_createdAt_idx").on(table.createdAt),
	]
);

export const payment = pgTable(
	"payment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => order.id, { onDelete: "cascade" }),
		providerTransactionId: text("provider_transaction_id").notNull(),
		provider: text("provider").notNull(),
		amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
		currency: text("currency").notNull(),
		status: paymentStatusEnum("status").notNull(),
		paidAt: timestamp("paid_at", { withTimezone: true }),
		failureReason: text("failure_reason"),
	},
	(table) => [
		index("payment_orderId_idx").on(table.orderId),
		index("payment_providerTransId_idx").on(
			table.provider,
			table.providerTransactionId
		),
		index("payment_status_idx").on(table.status),
	]
);

export const coursePurchase = pgTable(
	"course_purchase",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		purchasedAt: timestamp("purchased_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		price: decimal("price", { precision: 10, scale: 2 }).notNull(),
		status: text("status").notNull(),
		orderId: uuid("order_id").references(() => order.id, {
			onDelete: "set null",
		}),
	},
	(table) => [
		index("coursePurchase_userId_idx").on(table.userId),
		index("coursePurchase_courseId_idx").on(table.courseId),
		unique("coursePurchase_userCourse_unique").on(table.userId, table.courseId),
	]
);

export const userLibrary = pgTable(
	"user_library",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "cascade" }),
		orderId: uuid("order_id")
			.notNull()
			.references(() => order.id, { onDelete: "cascade" }),
		acquiredAt: timestamp("acquired_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
	},
	(table) => [
		index("userLibrary_userId_idx").on(table.userId),
		index("userLibrary_courseId_idx").on(table.courseId),
		index("userLibrary_orderId_idx").on(table.orderId),
		unique("userLibrary_userCourse_unique").on(table.userId, table.courseId),
	]
);

export const orderRelations = relations(order, ({ one, many }) => ({
	user: one(user, {
		fields: [order.userId],
		references: [user.id],
	}),
	course: one(course, {
		fields: [order.courseId],
		references: [course.id],
	}),
	payments: many(payment),
	coursePurchases: many(coursePurchase),
	userLibraries: many(userLibrary),
}));

export const paymentRelations = relations(payment, ({ one }) => ({
	order: one(order, {
		fields: [payment.orderId],
		references: [order.id],
	}),
}));

export const coursePurchaseRelations = relations(coursePurchase, ({ one }) => ({
	course: one(course, {
		fields: [coursePurchase.courseId],
		references: [course.id],
	}),
	user: one(user, {
		fields: [coursePurchase.userId],
		references: [user.id],
	}),
	order: one(order, {
		fields: [coursePurchase.orderId],
		references: [order.id],
	}),
}));

export const userLibraryRelations = relations(userLibrary, ({ one }) => ({
	user: one(user, {
		fields: [userLibrary.userId],
		references: [user.id],
	}),
	course: one(course, {
		fields: [userLibrary.courseId],
		references: [course.id],
	}),
	order: one(order, {
		fields: [userLibrary.orderId],
		references: [order.id],
	}),
}));
