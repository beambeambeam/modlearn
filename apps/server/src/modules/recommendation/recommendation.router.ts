import { listRecommendationsForUser } from "@/modules/recommendation/recommendation.service";
import {
	recommendationListForMeInputSchema,
	recommendationListForMeOutputSchema,
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
});
