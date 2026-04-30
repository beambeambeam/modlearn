import { z } from "zod";

const priceStringSchema = z
	.string()
	.trim()
	.regex(/^\d+(\.\d{1,2})?$/, "Price must be a positive decimal string")
	.refine((value) => Number(value) > 0, "Price must be greater than zero");
const pricingPaginationInputSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(20),
});

export const commercePaymentMarkSuccessInputSchema = z.object({
	orderId: z.uuid(),
	providerTransactionId: z.string().trim().min(1),
	provider: z.string().trim().min(1).default("mock"),
});

export const commercePaymentConfirmWebhookInputSchema =
	commercePaymentMarkSuccessInputSchema.extend({
		signature: z.string().optional(),
	});

export const commercePaymentSuccessOutputSchema = z.object({
	orderId: z.uuid(),
	paymentId: z.uuid(),
	status: z.literal("PAID"),
	grantsCreated: z.number().int().min(0),
});

export const commercePaymentRefundInputSchema = z.object({
	orderId: z.uuid(),
	reason: z.string().trim().min(1).optional(),
});

export const commercePaymentRefundOutputSchema = z.object({
	orderId: z.uuid(),
	status: z.literal("REFUNDED"),
	revokedCount: z.number().int().min(0),
});

export const commerceBuyContentInputSchema = z.object({
	contentId: z.uuid(),
	providerTransactionId: z.string().trim().min(1).optional(),
});

export const commerceBuyPlaylistInputSchema = z.object({
	playlistId: z.uuid(),
	providerTransactionId: z.string().trim().min(1).optional(),
});

export const commerceBuyOutputSchema = z.object({
	orderId: z.uuid(),
	paymentId: z.uuid(),
	status: z.literal("PAID"),
	alreadyOwned: z.boolean(),
	grantedContentCount: z.number().int().min(0),
});

const contentPricingWindowSchema = z.object({
	id: z.uuid(),
	contentId: z.uuid(),
	price: z.string(),
	currency: z.string(),
	effectiveFrom: z.date(),
	effectiveTo: z.date().nullable(),
	createdBy: z.string(),
	createdAt: z.date(),
	isActive: z.boolean(),
});

const playlistPricingWindowSchema = z.object({
	id: z.uuid(),
	playlistId: z.uuid(),
	price: z.string(),
	currency: z.string(),
	effectiveFrom: z.date(),
	effectiveTo: z.date().nullable(),
	createdBy: z.string(),
	createdAt: z.date(),
	isActive: z.boolean(),
});

export const commerceAdminContentPricingListInputSchema =
	pricingPaginationInputSchema.extend({
		contentId: z.uuid(),
	});

export const commerceAdminContentPricingCreateInputSchema = z
	.object({
		contentId: z.uuid(),
		price: priceStringSchema,
		currency: z.string().trim().min(1),
		effectiveFrom: z.date(),
		effectiveTo: z.date().nullable().optional(),
	})
	.superRefine((value, ctx) => {
		if (value.effectiveTo && value.effectiveTo <= value.effectiveFrom) {
			ctx.addIssue({
				code: "custom",
				path: ["effectiveTo"],
				message: "effectiveTo must be greater than effectiveFrom",
			});
		}
	});

export const commerceAdminContentPricingUpdateInputSchema = z.object({
	id: z.uuid(),
	patch: z
		.object({
			price: priceStringSchema.optional(),
			currency: z.string().trim().min(1).optional(),
			effectiveFrom: z.date().optional(),
			effectiveTo: z.date().nullable().optional(),
		})
		.refine(
			(value) => Object.keys(value).length > 0,
			"At least one field must be provided in patch"
		),
});

export const commerceAdminPlaylistPricingListInputSchema =
	pricingPaginationInputSchema.extend({
		playlistId: z.uuid(),
	});

export const commerceAdminPlaylistPricingCreateInputSchema = z
	.object({
		playlistId: z.uuid(),
		price: priceStringSchema,
		currency: z.string().trim().min(1),
		effectiveFrom: z.date(),
		effectiveTo: z.date().nullable().optional(),
	})
	.superRefine((value, ctx) => {
		if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
			ctx.addIssue({
				code: "custom",
				path: ["effectiveTo"],
				message: "effectiveTo must be greater than or equal to effectiveFrom",
			});
		}
	});

export const commerceAdminPlaylistPricingUpdateInputSchema = z.object({
	id: z.uuid(),
	patch: z
		.object({
			price: priceStringSchema.optional(),
			currency: z.string().trim().min(1).optional(),
			effectiveFrom: z.date().optional(),
			effectiveTo: z.date().nullable().optional(),
		})
		.refine(
			(value) => Object.keys(value).length > 0,
			"At least one field must be provided in patch"
		),
});

export const commerceAdminContentPricingListOutputSchema = z.object({
	items: z.array(contentPricingWindowSchema),
	pagination: z.object({
		page: z.number().int(),
		limit: z.number().int(),
		total: z.number().int(),
		totalPages: z.number().int(),
	}),
});

export const commerceAdminPlaylistPricingListOutputSchema = z.object({
	items: z.array(playlistPricingWindowSchema),
	pagination: z.object({
		page: z.number().int(),
		limit: z.number().int(),
		total: z.number().int(),
		totalPages: z.number().int(),
	}),
});

export const commerceAdminContentPricingOutputSchema =
	contentPricingWindowSchema;
export const commerceAdminPlaylistPricingOutputSchema =
	playlistPricingWindowSchema;
