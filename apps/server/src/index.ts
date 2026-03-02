import { cors } from "@elysiajs/cors";
import { env } from "@modlearn/env/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Elysia } from "elysia";
import { auth } from "@/lib/auth";
import { ensureBucketExists } from "@/lib/storage/s3-bucket";
import { createContext } from "@/orpc/context";
import { appRouter } from "@/orpc/routers";

const rpcHandler = new RPCHandler(appRouter);

export const createServerApp = () =>
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
		.all(
			"/rpc/*",
			async (context) => {
				return rpcHandler.handle(context.request, {
					prefix: "/rpc",
					context: await createContext({ context }),
				});
			},
			{
				parse: "none",
			}
		);

if (import.meta.main) {
	createServerApp().listen(3000, async () => {
		console.log("Server is running on http://localhost:3000");

		try {
			const result = await ensureBucketExists(env.S3_BUCKET_NAME);
			if (result.created) {
				console.log(`✅ Created S3 bucket: ${result.bucketName}`);
			} else {
				console.log(`✅ S3 bucket ready: ${result.bucketName}`);
			}
		} catch (error) {
			console.error("❌ Failed to initialize S3 bucket:", error);
		}
	});
}
