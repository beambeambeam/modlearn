import {
	getMyPlaylistCollection,
	hasLibraryAccess,
	listMyLibraryItems,
} from "@/modules/library/library.service";
import {
	libraryGetPlaylistCollectionInputSchema,
	libraryHasAccessInputSchema,
	libraryHasAccessOutputSchema,
	libraryListMyItemsInputSchema,
	libraryListMyItemsOutputSchema,
	libraryPlaylistCollectionSchema,
} from "@/modules/library/library.validators";
import { protectedProcedure, router } from "@/orpc";

export const libraryRouter = router({
	listMyItems: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/library/listMyItems",
			tags: ["Library"],
			summary: "List my library items",
			description: "Requires authentication.",
		})
		.input(libraryListMyItemsInputSchema.optional())
		.output(libraryListMyItemsOutputSchema)
		.handler(({ context, input }) => {
			return listMyLibraryItems({
				db: context.db,
				userId: context.session.user.id,
				input: libraryListMyItemsInputSchema.parse(input ?? {}),
			});
		}),
	getPlaylistCollection: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/library/getPlaylistCollection",
			tags: ["Library"],
			summary: "Get one purchased playlist collection",
			description: "Requires authentication.",
		})
		.input(libraryGetPlaylistCollectionInputSchema)
		.output(libraryPlaylistCollectionSchema)
		.handler(({ context, input }) => {
			return getMyPlaylistCollection({
				db: context.db,
				userId: context.session.user.id,
				input,
			});
		}),
	hasAccess: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/library/hasAccess",
			tags: ["Library"],
			summary: "Check if user has content or playlist access",
			description: "Requires authentication.",
		})
		.input(libraryHasAccessInputSchema)
		.output(libraryHasAccessOutputSchema)
		.handler(({ context, input }) => {
			return hasLibraryAccess({
				db: context.db,
				userId: context.session.user.id,
				input,
			});
		}),
});
