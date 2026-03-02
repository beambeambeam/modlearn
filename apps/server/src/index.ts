import { cors } from "@elysiajs/cors";
import { env } from "@modlearn/env/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Elysia } from "elysia";
import { auth } from "@/lib/auth";
import { ensureBucketExists } from "@/lib/storage/s3-bucket";
import { createContext } from "@/orpc/context";
import { rpcErrorInterceptor } from "@/orpc/error-mapper";
import { generateOpenApiSpec, renderScalarDocsHtml } from "@/orpc/openapi";
import { appRouter } from "@/orpc/router";

const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [rpcErrorInterceptor as never],
});

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
		.get("/docs/openapi.json", async () => {
			const spec = await generateOpenApiSpec();
			return Response.json(spec);
		})
		.get("/docs", () => {
			return new Response(renderScalarDocsHtml("/docs/openapi.json"), {
				headers: {
					"content-type": "text/html; charset=utf-8",
				},
			});
		})
		.all(
			"/rpc/*",
			async (context) => {
				const result = await rpcHandler.handle(context.request, {
					prefix: "/rpc",
					context: await createContext({ context }),
				});

				if (!(result.matched && result.response)) {
					return context.status(404);
				}

				return result.response;
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
