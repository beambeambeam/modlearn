import { logAdminMutation } from "@/modules/admin-audit/admin-audit.service";
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
		.handler(({ context, input }) => {
			return getGenreById({
				db: context.db,
				input,
			});
		}),
	adminCreate: adminProcedure
		.input(genreAdminCreateInputSchema)
		.handler(async ({ context, input }) => {
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
		}),
	adminUpdate: adminProcedure
		.input(genreAdminUpdateInputSchema)
		.handler(async ({ context, input }) => {
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
		}),
	adminDelete: adminProcedure
		.input(genreAdminDeleteInputSchema)
		.handler(async ({ context, input }) => {
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
		}),
});
