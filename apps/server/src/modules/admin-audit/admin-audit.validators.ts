import { z } from "zod";

const auditEntityTypeSchema = z.enum([
	"CONTENT",
	"PLAYLIST",
	"PLAYLIST_EPISODE",
	"CATEGORY",
	"FILE",
]);

const auditActionSchema = z.enum([
	"CREATE",
	"UPDATE",
	"DELETE",
	"SET_PUBLISH_STATE",
	"SET_AVAILABILITY",
	"SET_CLASSIFICATION",
	"ADD_EPISODE",
	"REORDER_EPISODES",
	"UPDATE_EPISODE",
	"REMOVE_EPISODE",
]);

export const adminAuditListInputSchema = z
	.object({
		page: z.number().int().min(1).default(1),
		limit: z.number().int().min(1).max(100).default(20),
		adminId: z.string().trim().min(1).optional(),
		entityId: z.uuid().optional(),
		entityType: auditEntityTypeSchema.optional(),
		action: auditActionSchema.optional(),
		from: z.date().optional(),
		to: z.date().optional(),
	})
	.superRefine((value, ctx) => {
		if (value.from && value.to && value.from > value.to) {
			ctx.addIssue({
				code: "custom",
				path: ["to"],
				message: "to must be greater than or equal to from",
			});
		}
	});

export const adminAuditListOutputSchema = z.object({
	items: z.array(
		z.object({
			id: z.uuid(),
			adminId: z.string(),
			entityId: z.uuid(),
			entityType: auditEntityTypeSchema,
			action: auditActionSchema,
			metadata: z.record(z.string(), z.unknown()).nullable(),
			createdAt: z.date(),
			ipAddress: z.string().nullable(),
			admin: z.object({
				id: z.string(),
				email: z.string().email(),
				name: z.string(),
			}),
		})
	),
	pagination: z.object({
		page: z.number().int(),
		limit: z.number().int(),
		total: z.number().int(),
		totalPages: z.number().int(),
	}),
});
