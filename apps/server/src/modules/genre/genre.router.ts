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
	genreDeleteOutputSchema,
	genreListInputSchema,
	genreListOutputSchema,
	genreSchema,
} from "@/modules/genre/genre.validators";
import { adminProcedure, publicProcedure, router } from "@/orpc";

export const genreRouter = router({
	list: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/genre/list",
			tags: ["Genre"],
			summary: "List genres",
		})
		.input(genreListInputSchema.partial().optional())
		.output(genreListOutputSchema)
		.handler(({ context, input }) => {
			return listGenres({
				db: context.db,
				input: genreListInputSchema.parse(input ?? {}),
			});
		}),
	getById: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/genre/getById",
			tags: ["Genre"],
			summary: "Get genre by ID",
		})
		.input(genreByIdInputSchema)
		.output(genreSchema)
		.handler(({ context, input }) => {
			return getGenreById({
				db: context.db,
				input,
			});
		}),
	adminCreate: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/genre/adminCreate",
			tags: ["Genre"],
			summary: "Create genre",
			description: "Requires admin or superadmin role.",
		})
		.input(genreAdminCreateInputSchema)
		.output(genreSchema)
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
		.route({
			method: "POST",
			path: "/rpc/genre/adminUpdate",
			tags: ["Genre"],
			summary: "Update genre",
			description: "Requires admin or superadmin role.",
		})
		.input(genreAdminUpdateInputSchema)
		.output(genreSchema)
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
		.route({
			method: "POST",
			path: "/rpc/genre/adminDelete",
			tags: ["Genre"],
			summary: "Delete genre",
			description: "Requires admin or superadmin role.",
		})
		.input(genreAdminDeleteInputSchema)
		.output(genreDeleteOutputSchema)
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
