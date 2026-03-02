import {
	createGenre,
	deleteGenre,
	getGenreById,
	listGenres,
	updateGenre,
} from "@/modules/genre/genre.service";
import {
	genreAdminCreateInputSchema,
	genreAdminDeleteInputSchema,
	genreAdminUpdateInputSchema,
	genreByIdInputSchema,
	genreListInputSchema,
} from "@/modules/genre/genre.validators";
import { adminProcedure, publicProcedure, router } from "@/orpc";
import { logAdminMutation } from "@/orpc/routers/_audit";
import { mapGenreError } from "@/orpc/routers/router.utils";

export const genreRouter = router({
	list: publicProcedure
		.input(genreListInputSchema.partial().optional())
		.handler(({ context, input }) => {
			return listGenres({
				db: context.db,
				input: genreListInputSchema.parse(input ?? {}),
			});
		}),
	getById: publicProcedure
		.input(genreByIdInputSchema)
		.handler(async ({ context, input }) => {
			try {
				return await getGenreById({
					db: context.db,
					input,
				});
			} catch (error) {
				mapGenreError(error);
			}
		}),
	adminCreate: adminProcedure
		.input(genreAdminCreateInputSchema)
		.handler(async ({ context, input }) => {
			try {
				const created = await createGenre({
					db: context.db,
					input,
				});
				await logAdminMutation({
					context,
					entityType: "GENRE",
					action: "CREATE",
					entityId: created.id,
				});
				return created;
			} catch (error) {
				mapGenreError(error);
			}
		}),
	adminUpdate: adminProcedure
		.input(genreAdminUpdateInputSchema)
		.handler(async ({ context, input }) => {
			try {
				const updated = await updateGenre({
					db: context.db,
					input,
				});
				await logAdminMutation({
					context,
					entityType: "GENRE",
					action: "UPDATE",
					entityId: updated.id,
					metadata: {
						patchKeys: Object.keys(input.patch),
					},
				});
				return updated;
			} catch (error) {
				mapGenreError(error);
			}
		}),
	adminDelete: adminProcedure
		.input(genreAdminDeleteInputSchema)
		.handler(async ({ context, input }) => {
			try {
				const deleted = await deleteGenre({
					db: context.db,
					input,
				});
				await logAdminMutation({
					context,
					entityType: "GENRE",
					action: "DELETE",
					entityId: deleted.id,
				});
				return deleted;
			} catch (error) {
				mapGenreError(error);
			}
		}),
});
