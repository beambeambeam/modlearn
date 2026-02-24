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
import { content } from "./content";
import { playlist } from "./playlist";

export const cartItemTypeEnum = pgEnum("cart_item_type", [
	"CONTENT",
	"PLAYLIST",
]);

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

export const cart = pgTable(
	"cart",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		...timestamps,
	},
	(table) => [index("cart_userId_idx").on(table.userId)]
);

export const cartItem = pgTable(
	"cart_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		cartId: uuid("cart_id")
			.notNull()
			.references(() => cart.id, { onDelete: "cascade" }),
		contentId: uuid("content_id").references(() => content.id, {
			onDelete: "cascade",
		}),
		playlistId: uuid("playlist_id").references(() => playlist.id, {
			onDelete: "cascade",
		}),
		itemType: cartItemTypeEnum("item_type").notNull(),
		price: decimal("price", { precision: 10, scale: 2 }).notNull(),
		addedAt: timestamp("added_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("cartItem_cartId_idx").on(table.cartId),
		index("cartItem_contentId_idx").on(table.contentId),
		index("cartItem_playlistId_idx").on(table.playlistId),
	]
);

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
		status: orderStatusEnum("status").notNull(),
		...timestamps,
	},
	(table) => [
		index("order_userId_idx").on(table.userId),
		index("order_status_idx").on(table.status),
		index("order_createdAt_idx").on(table.createdAt),
	]
);

export const orderItem = pgTable(
	"order_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => order.id, { onDelete: "cascade" }),
		contentId: uuid("content_id").references(() => content.id, {
			onDelete: "set null",
		}),
		playlistId: uuid("playlist_id").references(() => playlist.id, {
			onDelete: "set null",
		}),
		itemType: cartItemTypeEnum("item_type").notNull(),
		price: decimal("price", { precision: 10, scale: 2 }).notNull(),
	},
	(table) => [
		index("orderItem_orderId_idx").on(table.orderId),
		index("orderItem_contentId_idx").on(table.contentId),
		index("orderItem_playlistId_idx").on(table.playlistId),
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

export const contentPurchase = pgTable(
	"content_purchase",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		contentId: uuid("content_id")
			.notNull()
			.references(() => content.id, { onDelete: "cascade" }),
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
		index("contentPurchase_userId_idx").on(table.userId),
		index("contentPurchase_contentId_idx").on(table.contentId),
		unique("contentPurchase_userContent_unique").on(
			table.userId,
			table.contentId
		),
	]
);

export const userLibrary = pgTable(
	"user_library",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		contentId: uuid("content_id")
			.notNull()
			.references(() => content.id, { onDelete: "cascade" }),
		playlistId: uuid("playlist_id").references(() => playlist.id, {
			onDelete: "set null",
		}),
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
		index("userLibrary_contentId_idx").on(table.contentId),
		index("userLibrary_orderId_idx").on(table.orderId),
		unique("userLibrary_userContent_unique").on(table.userId, table.contentId),
	]
);

export const cartRelations = relations(cart, ({ one, many }) => ({
	user: one(user, {
		fields: [cart.userId],
		references: [user.id],
	}),
	cartItems: many(cartItem),
}));

export const cartItemRelations = relations(cartItem, ({ one }) => ({
	cart: one(cart, {
		fields: [cartItem.cartId],
		references: [cart.id],
	}),
	content: one(content, {
		fields: [cartItem.contentId],
		references: [content.id],
	}),
	playlist: one(playlist, {
		fields: [cartItem.playlistId],
		references: [playlist.id],
	}),
}));

export const orderRelations = relations(order, ({ one, many }) => ({
	user: one(user, {
		fields: [order.userId],
		references: [user.id],
	}),
	orderItems: many(orderItem),
	payments: many(payment),
	contentPurchases: many(contentPurchase),
	userLibraries: many(userLibrary),
}));

export const orderItemRelations = relations(orderItem, ({ one }) => ({
	order: one(order, {
		fields: [orderItem.orderId],
		references: [order.id],
	}),
	content: one(content, {
		fields: [orderItem.contentId],
		references: [content.id],
	}),
	playlist: one(playlist, {
		fields: [orderItem.playlistId],
		references: [playlist.id],
	}),
}));

export const paymentRelations = relations(payment, ({ one }) => ({
	order: one(order, {
		fields: [payment.orderId],
		references: [order.id],
	}),
}));

export const contentPurchaseRelations = relations(
	contentPurchase,
	({ one }) => ({
		content: one(content, {
			fields: [contentPurchase.contentId],
			references: [content.id],
		}),
		user: one(user, {
			fields: [contentPurchase.userId],
			references: [user.id],
		}),
		order: one(order, {
			fields: [contentPurchase.orderId],
			references: [order.id],
		}),
	})
);

export const userLibraryRelations = relations(userLibrary, ({ one }) => ({
	user: one(user, {
		fields: [userLibrary.userId],
		references: [user.id],
	}),
	content: one(content, {
		fields: [userLibrary.contentId],
		references: [content.id],
	}),
	playlist: one(playlist, {
		fields: [userLibrary.playlistId],
		references: [playlist.id],
	}),
	order: one(order, {
		fields: [userLibrary.orderId],
		references: [order.id],
	}),
}));
