import { TRPCError } from "@trpc/server";
import {
	createGenre,
	deleteGenre,
	getGenreById,
	listGenres,
	updateGenre,
} from "@/modules/genre/genre.service";
import {
	GenreNotFoundError,
	GenreSlugConflictError,
} from "@/modules/genre/genre.types";
import {
	genreAdminCreateInputSchema,
	genreAdminDeleteInputSchema,
	genreAdminUpdateInputSchema,
	genreByIdInputSchema,
	genreListInputSchema,
} from "@/modules/genre/genre.validators";
import { adminProcedure, publicProcedure, router } from "../index";
import { logAdminMutation } from "./_audit";

function mapGenreError(error: unknown): never {
	if (error instanceof GenreNotFoundError) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: error.message,
		});
	}

	if (error instanceof GenreSlugConflictError) {
		throw new TRPCError({
			code: "CONFLICT",
			message: error.message,
		});
	}

	throw error;
}

export const genreRouter = router({
	list: publicProcedure
		.input(genreListInputSchema.partial().optional())
		.query(({ ctx, input }) => {
			return listGenres({
				db: ctx.db,
				input: genreListInputSchema.parse(input ?? {}),
			});
		}),
	getById: publicProcedure
		.input(genreByIdInputSchema)
		.query(async ({ ctx, input }) => {
			try {
				return await getGenreById({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapGenreError(error);
			}
		}),
	adminCreate: adminProcedure
		.input(genreAdminCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const created = await createGenre({
					db: ctx.db,
					input,
				});
				await logAdminMutation({
					ctx,
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
		.mutation(async ({ ctx, input }) => {
			try {
				const updated = await updateGenre({
					db: ctx.db,
					input,
				});
				await logAdminMutation({
					ctx,
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
		.mutation(async ({ ctx, input }) => {
			try {
				const deleted = await deleteGenre({
					db: ctx.db,
					input,
				});
				await logAdminMutation({
					ctx,
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
