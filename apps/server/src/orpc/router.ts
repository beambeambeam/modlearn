import { categoryRouter } from "@/modules/category/category.router";
import { contentRouter } from "@/modules/content/content.router";
import { fileRouter } from "@/modules/file/file.router";
import { genreRouter } from "@/modules/genre/genre.router";
import { playlistRouter } from "@/modules/playlist/playlist.router";
import { watchProgressRouter } from "@/modules/watch-progress/watch-progress.router";
import {
	adminProcedure,
	protectedProcedure,
	publicProcedure,
	router,
} from "@/orpc";

export const appRouter = router({
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	privateData: protectedProcedure.handler(({ context }) => {
		return {
			message: "This is private",
			user: context.session.user,
		};
	}),
	adminData: adminProcedure.handler(({ context }) => {
		return {
			message: "This is admin-only",
			user: context.session.user,
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
