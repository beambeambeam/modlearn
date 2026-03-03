import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { appRouter } from "@/orpc/router";

const generator = new OpenAPIGenerator({
	schemaConverters: [new ZodToJsonSchemaConverter()],
});

export function generateOpenApiSpec() {
	return generator.generate(appRouter, {
		info: {
			title: "ModLearn API",
			version: "1.0.0",
			description: "oRPC backend API documentation for ModLearn.",
		},
		tags: [
			{ name: "System" },
			{ name: "Category" },
			{ name: "Content" },
			{ name: "File" },
			{ name: "Playlist" },
			{ name: "Watch Progress" },
		],
		components: {
			securitySchemes: {
				BearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
				},
			},
		},
	});
}

export function renderScalarDocsHtml(specUrl: string): string {
	return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ModLearn API Docs</title>
  <style>
    body { margin: 0; }
  </style>
</head>
<body>
  <script id="api-reference" data-url="${specUrl}"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}
