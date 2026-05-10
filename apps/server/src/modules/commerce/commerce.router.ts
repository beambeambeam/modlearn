import {
	buyCourse,
	confirmPaymentWebhook,
	createCoursePricingWindow,
	listCoursePricingWindows,
	markPaymentSuccess,
	refundPayment,
	updateCoursePricingWindow,
} from "@/modules/commerce/commerce.service";
import {
	commerceAdminCoursePricingCreateInputSchema,
	commerceAdminCoursePricingListInputSchema,
	commerceAdminCoursePricingListOutputSchema,
	commerceAdminCoursePricingOutputSchema,
	commerceAdminCoursePricingUpdateInputSchema,
	commerceBuyCourseInputSchema,
	commerceBuyOutputSchema,
	commercePaymentConfirmWebhookInputSchema,
	commercePaymentMarkSuccessInputSchema,
	commercePaymentRefundInputSchema,
	commercePaymentRefundOutputSchema,
	commercePaymentSuccessOutputSchema,
} from "@/modules/commerce/commerce.validators";
import { adminProcedure, protectedProcedure, router } from "@/orpc";
import { withRpcErrorHandling } from "@/orpc/error-mapper";
import { errorGroups } from "@/orpc/errors";

export const commerceRouter = router({
	payment: router({
		markSuccess: protectedProcedure
			.errors(errorGroups.notFoundBadRequestConflict)
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
			.handler(
				withRpcErrorHandling(({ context, input }) => {
					return markPaymentSuccess({
						db: context.db,
						userId: context.session.user.id,
						input,
					});
				})
			),
		confirmWebhook: protectedProcedure
			.errors(errorGroups.notFoundBadRequestConflict)
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
			.handler(
				withRpcErrorHandling(({ context, input }) => {
					return confirmPaymentWebhook({
						db: context.db,
						userId: context.session.user.id,
						input: {
							orderId: input.orderId,
							provider: input.provider,
							providerTransactionId: input.providerTransactionId,
						},
					});
				})
			),
		refund: protectedProcedure
			.errors(errorGroups.notFoundBadRequestConflict)
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
			.handler(
				withRpcErrorHandling(({ context, input }) => {
					return refundPayment({
						db: context.db,
						userId: context.session.user.id,
						input,
					});
				})
			),
	}),
	purchase: router({
		buyCourse: protectedProcedure
			.errors(errorGroups.notFoundBadRequestConflict)
			.route({
				method: "POST",
				path: "/rpc/commerce/purchase/buyCourse",
				tags: ["Commerce Purchase User"],
				summary: "Purchase Whole Course",
				description:
					"Requires authentication. Purchases one whole course for the signed-in user.",
			})
			.input(commerceBuyCourseInputSchema)
			.output(commerceBuyOutputSchema)
			.handler(
				withRpcErrorHandling(({ context, input }) => {
					return buyCourse({
						db: context.db,
						userId: context.session.user.id,
						input,
					});
				})
			),
	}),
	adminPricing: router({
		course: router({
			list: adminProcedure
				.errors(errorGroups.notFound)
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/course/list",
					tags: ["Commerce Pricing Admin"],
					summary: "List Course Pricing Windows",
					description:
						"Requires admin role. Returns course pricing windows for admin management.",
				})
				.input(commerceAdminCoursePricingListInputSchema)
				.output(commerceAdminCoursePricingListOutputSchema)
				.handler(
					withRpcErrorHandling(({ context, input }) => {
						return listCoursePricingWindows({
							db: context.db,
							input,
						});
					})
				),
			create: adminProcedure
				.errors(errorGroups.notFoundBadRequestConflict)
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/course/create",
					tags: ["Commerce Pricing Admin"],
					summary: "Create Course Pricing Window",
					description:
						"Requires admin role. Creates a pricing window for a course.",
				})
				.input(commerceAdminCoursePricingCreateInputSchema)
				.output(commerceAdminCoursePricingOutputSchema)
				.handler(
					withRpcErrorHandling(({ context, input }) => {
						return createCoursePricingWindow({
							db: context.db,
							createdBy: context.session.user.id,
							input,
						});
					})
				),
			update: adminProcedure
				.errors(errorGroups.notFoundBadRequestConflict)
				.route({
					method: "POST",
					path: "/rpc/commerce/adminPricing/course/update",
					tags: ["Commerce Pricing Admin"],
					summary: "Update Course Pricing Window",
					description:
						"Requires admin role. Updates mutable fields of a course pricing window.",
				})
				.input(commerceAdminCoursePricingUpdateInputSchema)
				.output(commerceAdminCoursePricingOutputSchema)
				.handler(
					withRpcErrorHandling(({ context, input }) => {
						return updateCoursePricingWindow({
							db: context.db,
							input,
						});
					})
				),
		}),
	}),
});
