import {
	buyContent,
	buyPlaylist,
	confirmPaymentWebhook,
	createContentPricingWindow,
	createPlaylistPricingWindow,
	listContentPricingWindows,
	listPlaylistPricingWindows,
	markPaymentSuccess,
	refundPayment,
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
	commercePaymentConfirmWebhookInputSchema,
	commercePaymentMarkSuccessInputSchema,
	commercePaymentRefundInputSchema,
	commercePaymentRefundOutputSchema,
	commercePaymentSuccessOutputSchema,
} from "@/modules/commerce/commerce.validators";
import { adminProcedure, protectedProcedure, router } from "@/orpc";

export const commerceRouter = router({
	payment: router({
		markSuccess: protectedProcedure
			.route({
				method: "POST",
				path: "/rpc/commerce/payment/markSuccess",
				tags: ["Commerce Payment User"],
				summary: "Mark Payment As Successful (Mock)",
				description:
					"Requires authentication. Mock endpoint to mark a payment order as successful.",
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
				tags: ["Commerce Payment User"],
				summary: "Confirm Payment Webhook (Mock)",
				description:
					"Requires authentication. Mock endpoint to process provider webhook confirmation for an order.",
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
				tags: ["Commerce Payment User"],
				summary: "Refund Payment (Mock)",
				description:
					"Requires authentication. Mock endpoint to refund a completed payment order.",
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
				tags: ["Commerce Purchase User"],
				summary: "Purchase Single Content Item",
				description:
					"Requires authentication. Purchases one content item for the signed-in user.",
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
				tags: ["Commerce Purchase User"],
				summary: "Purchase Playlist",
				description:
					"Requires authentication. Purchases one playlist for the signed-in user.",
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
					tags: ["Commerce Pricing Admin"],
					summary: "List Content Pricing Windows",
					description:
						"Requires admin or superadmin role. Returns content pricing windows for admin management.",
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
					tags: ["Commerce Pricing Admin"],
					summary: "Create Content Pricing Window",
					description:
						"Requires admin or superadmin role. Creates a pricing window for a content item.",
				})
				.input(commerceAdminContentPricingCreateInputSchema)
				.output(commerceAdminContentPricingOutputSchema)
				.handler(({ context, input }) => {
					return createContentPricingWindow({
						db: context.db,
						createdBy: context.session.user.id,
						input,
					});
				}),
			update: adminProcedure
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/content/update",
					tags: ["Commerce Pricing Admin"],
					summary: "Update Content Pricing Window",
					description:
						"Requires admin or superadmin role. Updates mutable fields of a content pricing window.",
				})
				.input(commerceAdminContentPricingUpdateInputSchema)
				.output(commerceAdminContentPricingOutputSchema)
				.handler(({ context, input }) => {
					return updateContentPricingWindow({
						db: context.db,
						input,
					});
				}),
		}),
		playlist: router({
			list: adminProcedure
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/playlist/list",
					tags: ["Commerce Pricing Admin"],
					summary: "List Playlist Pricing Windows",
					description:
						"Requires admin or superadmin role. Returns playlist pricing windows for admin management.",
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
					tags: ["Commerce Pricing Admin"],
					summary: "Create Playlist Pricing Window",
					description:
						"Requires admin or superadmin role. Creates a pricing window for a playlist.",
				})
				.input(commerceAdminPlaylistPricingCreateInputSchema)
				.output(commerceAdminPlaylistPricingOutputSchema)
				.handler(({ context, input }) => {
					return createPlaylistPricingWindow({
						db: context.db,
						createdBy: context.session.user.id,
						input,
					});
				}),
			update: adminProcedure
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/playlist/update",
					tags: ["Commerce Pricing Admin"],
					summary: "Update Playlist Pricing Window",
					description:
						"Requires admin or superadmin role. Updates mutable fields of a playlist pricing window.",
				})
				.input(commerceAdminPlaylistPricingUpdateInputSchema)
				.output(commerceAdminPlaylistPricingOutputSchema)
				.handler(({ context, input }) => {
					return updatePlaylistPricingWindow({
						db: context.db,
						input,
					});
				}),
		}),
	}),
});
