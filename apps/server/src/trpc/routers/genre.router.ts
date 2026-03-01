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
				return await createGenre({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapGenreError(error);
			}
		}),
	adminUpdate: adminProcedure
		.input(genreAdminUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await updateGenre({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapGenreError(error);
			}
		}),
	adminDelete: adminProcedure
		.input(genreAdminDeleteInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await deleteGenre({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapGenreError(error);
			}
		}),
});
