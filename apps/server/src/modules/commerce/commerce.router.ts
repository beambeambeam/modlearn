import { z } from "zod";
import {
	addCartItem,
	buyContent,
	buyPlaylist,
	confirmPaymentWebhook,
	createCheckoutOrder,
	listCart,
	markPaymentSuccess,
	refundPayment,
	removeCartItem,
} from "@/modules/commerce/commerce.service";
import {
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
import { protectedProcedure, router } from "@/orpc";

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
});
