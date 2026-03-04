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
			tags: ["Library User"],
			summary: "List Current User Library Items",
			description:
				"Requires authentication. Returns the signed-in user's owned or entitled library items.",
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
			tags: ["Library User"],
			summary: "Retrieve Current User Playlist Collection",
			description:
				"Requires authentication. Returns one purchased playlist collection for the signed-in user.",
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
			tags: ["Library User"],
			summary: "Check Current User Library Access",
			description:
				"Requires authentication. Checks whether the signed-in user can access the requested content or playlist.",
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
