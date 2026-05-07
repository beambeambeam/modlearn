import {
	getMyCourse,
	hasLibraryAccess,
	listMyLibraryItems,
} from "@/modules/library/library.service";
import {
	libraryCourseItemSchema,
	libraryGetCourseInputSchema,
	libraryHasAccessInputSchema,
	libraryHasAccessOutputSchema,
	libraryListMyItemsInputSchema,
	libraryListMyItemsOutputSchema,
} from "@/modules/library/library.validators";
import { protectedProcedure, router } from "@/orpc";
import { errorGroups } from "@/orpc/errors";
import { withRpcErrorHandling } from "@/orpc/error-mapper";

export const libraryRouter = router({
	listMyItems: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/library/listMyItems",
			tags: ["Library User"],
			summary: "List Current User Library Items",
			description:
				"Requires authentication. Returns the signed-in user's owned courses.",
		})
		.input(libraryListMyItemsInputSchema.optional())
		.output(libraryListMyItemsOutputSchema)
		.handler(
			withRpcErrorHandling(({ context, input }) => {
				return listMyLibraryItems({
					db: context.db,
					userId: context.session.user.id,
					input: libraryListMyItemsInputSchema.parse(input ?? {}),
				});
			})
		),
	getCourse: protectedProcedure
		.errors(errorGroups.notFoundForbidden)
		.route({
			method: "POST",
			path: "/rpc/library/getCourse",
			tags: ["Library User"],
			summary: "Retrieve Current User Course",
			description:
				"Requires authentication. Returns one owned course for the signed-in user.",
		})
		.input(libraryGetCourseInputSchema)
		.output(libraryCourseItemSchema)
		.handler(
			withRpcErrorHandling(({ context, input }) => {
				return getMyCourse({
					db: context.db,
					userId: context.session.user.id,
					input,
				});
			})
		),
	hasAccess: protectedProcedure
		.errors(errorGroups.notFoundForbidden)
		.route({
			method: "POST",
			path: "/rpc/library/hasAccess",
			tags: ["Library User"],
			summary: "Check Current User Library Access",
			description:
				"Requires authentication. Checks whether the signed-in user can access the requested course or lesson.",
		})
		.input(libraryHasAccessInputSchema)
		.output(libraryHasAccessOutputSchema)
		.handler(
			withRpcErrorHandling(({ context, input }) => {
				return hasLibraryAccess({
					db: context.db,
					userId: context.session.user.id,
					input,
				});
			})
		),
});
