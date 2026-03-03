import { z } from "zod";
import { categoryRouter } from "@/modules/category/category.router";
import { commerceRouter } from "@/modules/commerce/commerce.router";
import { contentRouter } from "@/modules/content/content.router";
import { fileRouter } from "@/modules/file/file.router";
import { libraryRouter } from "@/modules/library/library.router";
import { playbackRouter } from "@/modules/playback/playback.router";
import { playlistRouter } from "@/modules/playlist/playlist.router";
import { watchProgressRouter } from "@/modules/watch-progress/watch-progress.router";
import {
	adminProcedure,
	protectedProcedure,
	publicProcedure,
	router,
} from "@/orpc";

const userOutputSchema = z
	.object({
		id: z.string(),
		email: z.string(),
		name: z.string(),
		role: z.string().nullable().optional(),
	})
	.passthrough();

export const appRouter = router({
	healthCheck: publicProcedure
		.route({
			method: "GET",
			path: "/rpc/healthCheck",
			tags: ["System"],
			summary: "Health check",
		})
		.output(z.string())
		.handler(() => {
			return "OK";
		}),
	privateData: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/privateData",
			tags: ["System"],
			summary: "Private data",
			description: "Requires authentication.",
		})
		.output(
			z.object({
				message: z.string(),
				user: userOutputSchema,
			})
		)
		.handler(({ context }) => {
			return {
				message: "This is private",
				user: context.session.user,
			};
		}),
	adminData: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/adminData",
			tags: ["System"],
			summary: "Admin data",
			description: "Requires admin or superadmin role.",
		})
		.output(
			z.object({
				message: z.string(),
				user: userOutputSchema,
			})
		)
		.handler(({ context }) => {
			return {
				message: "This is admin-only",
				user: context.session.user,
			};
		}),
	category: categoryRouter,
	commerce: commerceRouter,
	content: contentRouter,
	file: fileRouter,
	library: libraryRouter,
	playback: playbackRouter,
	playlist: playlistRouter,
	watchProgress: watchProgressRouter,
});
export type AppRouter = typeof appRouter;
