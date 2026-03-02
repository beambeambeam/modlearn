import {
	adminProcedure,
	protectedProcedure,
	publicProcedure,
	router,
} from "../index";
import { categoryRouter } from "./category.router";
import { contentRouter } from "./content.router";
import { fileRouter } from "./file.router";
import { genreRouter } from "./genre.router";
import { playlistRouter } from "./playlist.router";
import { watchProgressRouter } from "./watch-progress.router";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session.user,
		};
	}),
	adminData: adminProcedure.query(({ ctx }) => {
		return {
			message: "This is admin-only",
			user: ctx.session.user,
		};
	}),
	category: categoryRouter,
	content: contentRouter,
	file: fileRouter,
	genre: genreRouter,
	playlist: playlistRouter,
	watchProgress: watchProgressRouter,
});
export type AppRouter = typeof appRouter;
