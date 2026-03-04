import { z } from "zod";
import { logAdminMutation } from "@/modules/admin-audit/admin-audit.service";
import {
	addCartItem,
	buyContent,
	buyPlaylist,
	confirmPaymentWebhook,
	createCheckoutOrder,
	createContentPricingWindow,
	createPlaylistPricingWindow,
	listCart,
	listContentPricingWindows,
	listPlaylistPricingWindows,
	markPaymentSuccess,
	refundPayment,
	removeCartItem,
	updateContentPricingWindow,
	updatePlaylistPricingWindow,
} from "@/modules/commerce/commerce.service";
import {
	commerceAdminContentPricingCreateInputSchema,
	commerceAdminContentPricingListInputSchema,
	commerceAdminContentPricingListOutputSchema,
	commerceAdminContentPricingOutputSchema,
	commerceAdminContentPricingUpdateInputSchema,
	commerceAdminPlaylistPricingCreateInputSchema,
	commerceAdminPlaylistPricingListInputSchema,
	commerceAdminPlaylistPricingListOutputSchema,
	commerceAdminPlaylistPricingOutputSchema,
	commerceAdminPlaylistPricingUpdateInputSchema,
	commerceBuyContentInputSchema,
	commerceBuyOutputSchema,
	commerceBuyPlaylistInputSchema,
	commerceCartAddItemInputSchema,
	commerceCartOutputSchema,
	commerceCartRemoveItemInputSchema,
	commerceCheckoutCreateOrderInputSchema,
	commerceCheckoutOrderOutputSchema,
	commercePaymentConfirmWebhookInputSchema,
	commercePaymentMarkSuccessInputSchema,
	commercePaymentRefundInputSchema,
	commercePaymentRefundOutputSchema,
	commercePaymentSuccessOutputSchema,
} from "@/modules/commerce/commerce.validators";
import { adminProcedure, protectedProcedure, router } from "@/orpc";

export const commerceRouter = router({
	cart: router({
		addItem: protectedProcedure
			.route({
				method: "POST",
				path: "/rpc/commerce/cart/addItem",
				tags: ["Commerce"],
				summary: "Add item to cart",
				description: "Requires authentication.",
			})
			.input(commerceCartAddItemInputSchema)
			.output(commerceCartOutputSchema)
			.handler(({ context, input }) => {
				return addCartItem({
					db: context.db,
					userId: context.session.user.id,
					input,
				});
			}),
		removeItem: protectedProcedure
			.route({
				method: "POST",
				path: "/rpc/commerce/cart/removeItem",
				tags: ["Commerce"],
				summary: "Remove item from cart",
				description: "Requires authentication.",
			})
			.input(commerceCartRemoveItemInputSchema)
			.output(commerceCartOutputSchema)
			.handler(({ context, input }) => {
				return removeCartItem({
					db: context.db,
					userId: context.session.user.id,
					input,
				});
			}),
		list: protectedProcedure
			.route({
				method: "POST",
				path: "/rpc/commerce/cart/list",
				tags: ["Commerce"],
				summary: "List cart",
				description: "Requires authentication.",
			})
			.input(z.object({}).optional())
			.output(commerceCartOutputSchema)
			.handler(({ context }) => {
				return listCart({
					db: context.db,
					userId: context.session.user.id,
				});
			}),
	}),
	checkout: router({
		createOrder: protectedProcedure
			.route({
				method: "POST",
				path: "/rpc/commerce/checkout/createOrder",
				tags: ["Commerce"],
				summary: "Create checkout order",
				description: "Requires authentication.",
			})
			.input(commerceCheckoutCreateOrderInputSchema)
			.output(commerceCheckoutOrderOutputSchema)
			.handler(({ context, input }) => {
				return createCheckoutOrder({
					db: context.db,
					userId: context.session.user.id,
					input,
				});
			}),
	}),
	payment: router({
		markSuccess: protectedProcedure
			.route({
				method: "POST",
				path: "/rpc/commerce/payment/markSuccess",
				tags: ["Commerce"],
				summary: "Mark payment success (mock)",
				description: "Requires authentication.",
			})
			.input(commercePaymentMarkSuccessInputSchema)
			.output(commercePaymentSuccessOutputSchema)
			.handler(({ context, input }) => {
				return markPaymentSuccess({
					db: context.db,
					userId: context.session.user.id,
					input,
				});
			}),
		confirmWebhook: protectedProcedure
			.route({
				method: "POST",
				path: "/rpc/commerce/payment/confirmWebhook",
				tags: ["Commerce"],
				summary: "Confirm payment webhook (mock)",
				description: "Requires authentication.",
			})
			.input(commercePaymentConfirmWebhookInputSchema)
			.output(commercePaymentSuccessOutputSchema)
			.handler(({ context, input }) => {
				return confirmPaymentWebhook({
					db: context.db,
					userId: context.session.user.id,
					input: {
						orderId: input.orderId,
						provider: input.provider,
						providerTransactionId: input.providerTransactionId,
					},
				});
			}),
		refund: protectedProcedure
			.route({
				method: "POST",
				path: "/rpc/commerce/payment/refund",
				tags: ["Commerce"],
				summary: "Refund payment (mock)",
				description: "Requires authentication.",
			})
			.input(commercePaymentRefundInputSchema)
			.output(commercePaymentRefundOutputSchema)
			.handler(({ context, input }) => {
				return refundPayment({
					db: context.db,
					userId: context.session.user.id,
					input,
				});
			}),
	}),
	purchase: router({
		buyContent: protectedProcedure
			.route({
				method: "POST",
				path: "/rpc/commerce/purchase/buyContent",
				tags: ["Commerce"],
				summary: "Buy single content",
				description: "Requires authentication.",
			})
			.input(commerceBuyContentInputSchema)
			.output(commerceBuyOutputSchema)
			.handler(({ context, input }) => {
				return buyContent({
					db: context.db,
					userId: context.session.user.id,
					input,
				});
			}),
		buyPlaylist: protectedProcedure
			.route({
				method: "POST",
				path: "/rpc/commerce/purchase/buyPlaylist",
				tags: ["Commerce"],
				summary: "Buy playlist",
				description: "Requires authentication.",
			})
			.input(commerceBuyPlaylistInputSchema)
			.output(commerceBuyOutputSchema)
			.handler(({ context, input }) => {
				return buyPlaylist({
					db: context.db,
					userId: context.session.user.id,
					input,
				});
			}),
	}),
	adminPricing: router({
		content: router({
			list: adminProcedure
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/content/list",
					tags: ["Commerce"],
					summary: "Admin list content pricing windows",
					description: "Requires admin or superadmin role.",
				})
				.input(commerceAdminContentPricingListInputSchema)
				.output(commerceAdminContentPricingListOutputSchema)
				.handler(({ context, input }) => {
					return listContentPricingWindows({
						db: context.db,
						input,
					});
				}),
			create: adminProcedure
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/content/create",
					tags: ["Commerce"],
					summary: "Admin create content pricing window",
					description: "Requires admin or superadmin role.",
				})
				.input(commerceAdminContentPricingCreateInputSchema)
				.output(commerceAdminContentPricingOutputSchema)
				.handler(async ({ context, input }) => {
					const created = await createContentPricingWindow({
						db: context.db,
						createdBy: context.session.user.id,
						input,
					});
					await logAdminMutation({
						context,
						entityType: "CONTENT",
						action: "UPDATE",
						entityId: created.contentId,
						metadata: {
							operation: "CREATE_PRICING",
							pricingId: created.id,
						},
					});
					return created;
				}),
			update: adminProcedure
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/content/update",
					tags: ["Commerce"],
					summary: "Admin update content pricing window",
					description: "Requires admin or superadmin role.",
				})
				.input(commerceAdminContentPricingUpdateInputSchema)
				.output(commerceAdminContentPricingOutputSchema)
				.handler(async ({ context, input }) => {
					const updated = await updateContentPricingWindow({
						db: context.db,
						input,
					});
					await logAdminMutation({
						context,
						entityType: "CONTENT",
						action: "UPDATE",
						entityId: updated.contentId,
						metadata: {
							operation: "UPDATE_PRICING",
							pricingId: updated.id,
							patchKeys: Object.keys(input.patch),
						},
					});
					return updated;
				}),
		}),
		playlist: router({
			list: adminProcedure
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/playlist/list",
					tags: ["Commerce"],
					summary: "Admin list playlist pricing windows",
					description: "Requires admin or superadmin role.",
				})
				.input(commerceAdminPlaylistPricingListInputSchema)
				.output(commerceAdminPlaylistPricingListOutputSchema)
				.handler(({ context, input }) => {
					return listPlaylistPricingWindows({
						db: context.db,
						input,
					});
				}),
			create: adminProcedure
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/playlist/create",
					tags: ["Commerce"],
					summary: "Admin create playlist pricing window",
					description: "Requires admin or superadmin role.",
				})
				.input(commerceAdminPlaylistPricingCreateInputSchema)
				.output(commerceAdminPlaylistPricingOutputSchema)
				.handler(async ({ context, input }) => {
					const created = await createPlaylistPricingWindow({
						db: context.db,
						createdBy: context.session.user.id,
						input,
					});
					await logAdminMutation({
						context,
						entityType: "PLAYLIST",
						action: "UPDATE",
						entityId: created.playlistId,
						metadata: {
							operation: "CREATE_PRICING",
							pricingId: created.id,
						},
					});
					return created;
				}),
			update: adminProcedure
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/playlist/update",
					tags: ["Commerce"],
					summary: "Admin update playlist pricing window",
					description: "Requires admin or superadmin role.",
				})
				.input(commerceAdminPlaylistPricingUpdateInputSchema)
				.output(commerceAdminPlaylistPricingOutputSchema)
				.handler(async ({ context, input }) => {
					const updated = await updatePlaylistPricingWindow({
						db: context.db,
						input,
					});
					await logAdminMutation({
						context,
						entityType: "PLAYLIST",
						action: "UPDATE",
						entityId: updated.playlistId,
						metadata: {
							operation: "UPDATE_PRICING",
							pricingId: updated.id,
							patchKeys: Object.keys(input.patch),
						},
					});
					return updated;
				}),
		}),
	}),
});
