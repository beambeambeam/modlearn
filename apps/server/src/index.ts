import { cors } from "@elysiajs/cors";
import { auth } from "@modlearn/auth";
import { env } from "@modlearn/env/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Elysia } from "elysia";
import { ensureBucketExists } from "./lib/storage";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/routers/index";

new Elysia()
	.use(
		cors({
			origin: env.CORS_ORIGIN,
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		})
	)
	.all("/api/auth/*", (context) => {
		const { request, status } = context;
		if (["POST", "GET"].includes(request.method)) {
			return auth.handler(request);
		}
		return status(405);
	})
	.all("/trpc/*", async (context) => {
		const res = await fetchRequestHandler({
			endpoint: "/trpc",
			router: appRouter,
			req: context.request,
			createContext: () => createContext({ context }),
		});
		return res;
	})
	.get("/", () => "OK")
	.listen(3000, async () => {
		console.log("Server is running on http://localhost:3000");

		// Initialize S3 bucket on startup
		try {
			const result = await ensureBucketExists(env.S3_BUCKET_NAME);
			if (result.created) {
				console.log(`✅ Created S3 bucket: ${result.bucketName}`);
			} else {
				console.log(`✅ S3 bucket ready: ${result.bucketName}`);
			}
		} catch (error) {
			console.error("❌ Failed to initialize S3 bucket:", error);
			// Don't crash the server, but log the error
		}
	});
