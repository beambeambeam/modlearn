import { z } from "zod";

export const fileAdminCreateUploadRequestInputSchema = z.object({
	name: z.string().trim().min(1),
	size: z.number().int().positive(),
	mimeType: z.string().trim().min(1),
	extension: z.string().trim().min(1),
	checksum: z.string().trim().length(64),
});

export const fileAdminByIdInputSchema = z.object({
	fileId: z.uuid(),
});
