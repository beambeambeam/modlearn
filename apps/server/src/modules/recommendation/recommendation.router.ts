import {
	listPopularRecommendations,
	listRecentlyAddedRecommendations,
	listRecommendationsForUser,
} from "@/modules/recommendation/recommendation.service";
import {
	recommendationListForMeInputSchema,
	recommendationListForMeOutputSchema,
	recommendationListPopularInputSchema,
	recommendationListPopularOutputSchema,
	recommendationListRecentlyAddedInputSchema,
	recommendationListRecentlyAddedOutputSchema,
} from "@/modules/recommendation/recommendation.validators";
import { protectedProcedure, router } from "@/orpc";

export const recommendationRouter = router({
	listForMe: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/recommendation/listForMe",
			tags: ["Recommendation"],
			summary: "List personalized recommendations",
			description: "Requires authentication.",
		})
		.input(recommendationListForMeInputSchema.optional())
		.output(recommendationListForMeOutputSchema)
		.handler(({ context, input }) => {
			return listRecommendationsForUser({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...recommendationListForMeInputSchema.parse(input ?? {}),
				},
			});
		}),
	listPopular: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/recommendation/listPopular",
			tags: ["Recommendation"],
			summary: "List popular recommendations",
			description: "Requires authentication.",
		})
		.input(recommendationListPopularInputSchema.optional())
		.output(recommendationListPopularOutputSchema)
		.handler(({ context, input }) => {
			return listPopularRecommendations({
				db: context.db,
				input: recommendationListPopularInputSchema.parse(input ?? {}),
			});
		}),
	listRecentlyAdded: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/recommendation/listRecentlyAdded",
			tags: ["Recommendation"],
			summary: "List recently added recommendations",
			description: "Requires authentication.",
		})
		.input(recommendationListRecentlyAddedInputSchema.optional())
		.output(recommendationListRecentlyAddedOutputSchema)
		.handler(({ context, input }) => {
			return listRecentlyAddedRecommendations({
				db: context.db,
				input: recommendationListRecentlyAddedInputSchema.parse(input ?? {}),
			});
		}),
});
