import {
	adminDeleteReview,
	adminHideReview,
	adminListReviews,
	adminUnhideReview,
	deleteMyCourseReview,
	getCourseReviewSummary,
	getMyCourseReview,
	listCourseReviews,
	upsertMyCourseReview,
} from "@/modules/review/review.service";
import {
	reviewAdminDeleteInputSchema,
	reviewAdminDeleteResultSchema,
	reviewAdminHideInputSchema,
	reviewAdminItemSchema,
	reviewAdminListInputSchema,
	reviewAdminListOutputSchema,
	reviewAdminUnhideInputSchema,
	reviewDeleteMineInputSchema,
	reviewDeleteResultSchema,
	reviewGetCourseSummaryInputSchema,
	reviewGetMineInputSchema,
	reviewListByCourseInputSchema,
	reviewPublicListOutputSchema,
	reviewSummarySchema,
	reviewUpsertMineInputSchema,
} from "@/modules/review/review.validators";
import {
	adminProcedure,
	protectedProcedure,
	publicProcedure,
	router,
} from "@/orpc";

export const reviewRouter = router({
	listByCourse: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/review/listByCourse",
			tags: ["Review Public"],
			summary: "List Public Course Reviews",
			description:
				"Public endpoint. Returns visible reviews for a published and available course.",
		})
		.input(reviewListByCourseInputSchema)
		.output(reviewPublicListOutputSchema)
		.handler(({ context, input }) => {
			return listCourseReviews({
				db: context.db,
				input,
			});
		}),
	getCourseSummary: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/review/getCourseSummary",
			tags: ["Review Public"],
			summary: "Get Public Course Review Summary",
			description:
				"Public endpoint. Returns visible review summary metrics for a published and available course.",
		})
		.input(reviewGetCourseSummaryInputSchema)
		.output(reviewSummarySchema)
		.handler(({ context, input }) => {
			return getCourseReviewSummary({
				db: context.db,
				input,
			});
		}),
	getMine: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/review/getMine",
			tags: ["Review User"],
			summary: "Get Current User Review",
			description:
				"Requires authentication. Returns the signed-in user's review for one course, including hidden moderation state.",
		})
		.input(reviewGetMineInputSchema)
		.output(reviewAdminItemSchema.nullable())
		.handler(({ context, input }) => {
			return getMyCourseReview({
				db: context.db,
				userId: context.session.user.id,
				input,
			});
		}),
	upsertMine: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/review/upsertMine",
			tags: ["Review User"],
			summary: "Create Or Update Current User Review",
			description:
				"Requires authentication and active course ownership. Creates or updates the signed-in user's review.",
		})
		.input(reviewUpsertMineInputSchema)
		.output(reviewAdminItemSchema)
		.handler(({ context, input }) => {
			return upsertMyCourseReview({
				db: context.db,
				userId: context.session.user.id,
				input,
			});
		}),
	deleteMine: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/review/deleteMine",
			tags: ["Review User"],
			summary: "Delete Current User Review",
			description:
				"Requires authentication. Deletes the signed-in user's review for the requested course.",
		})
		.input(reviewDeleteMineInputSchema)
		.output(reviewDeleteResultSchema)
		.handler(({ context, input }) => {
			return deleteMyCourseReview({
				db: context.db,
				userId: context.session.user.id,
				input,
			});
		}),
	adminList: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/review/adminList",
			tags: ["Review Admin"],
			summary: "List Reviews For Moderation",
			description:
				"Requires admin or superadmin role. Returns review items across visibility states for moderation.",
		})
		.input(reviewAdminListInputSchema.optional())
		.output(reviewAdminListOutputSchema)
		.handler(({ context, input }) => {
			return adminListReviews({
				db: context.db,
				input: reviewAdminListInputSchema.parse(input ?? {}),
			});
		}),
	adminHide: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/review/adminHide",
			tags: ["Review Admin"],
			summary: "Hide Review",
			description:
				"Requires admin or superadmin role. Hides a review from public responses and stores moderation metadata.",
		})
		.input(reviewAdminHideInputSchema)
		.output(reviewAdminItemSchema)
		.handler(({ context, input }) => {
			return adminHideReview({
				db: context.db,
				adminUserId: context.session.user.id,
				input,
			});
		}),
	adminUnhide: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/review/adminUnhide",
			tags: ["Review Admin"],
			summary: "Unhide Review",
			description:
				"Requires admin or superadmin role. Restores a hidden review to public visibility.",
		})
		.input(reviewAdminUnhideInputSchema)
		.output(reviewAdminItemSchema)
		.handler(({ context, input }) => {
			return adminUnhideReview({
				db: context.db,
				input,
			});
		}),
	adminDelete: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/review/adminDelete",
			tags: ["Review Admin"],
			summary: "Delete Review",
			description:
				"Requires admin or superadmin role. Permanently deletes a review.",
		})
		.input(reviewAdminDeleteInputSchema)
		.output(reviewAdminDeleteResultSchema)
		.handler(({ context, input }) => {
			return adminDeleteReview({
				db: context.db,
				input,
			});
		}),
});
