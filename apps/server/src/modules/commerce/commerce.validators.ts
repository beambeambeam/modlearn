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

export const commerceBuyCourseInputSchema = z.object({
	courseId: z.uuid(),
	providerTransactionId: z.string().trim().min(1).optional(),
});

export const commerceBuyOutputSchema = z.object({
	orderId: z.uuid(),
	paymentId: z.uuid(),
	status: z.literal("PAID"),
	alreadyOwned: z.boolean(),
	grantedContentCount: z.number().int().min(0),
});

const coursePricingWindowSchema = z.object({
	id: z.uuid(),
	courseId: z.uuid(),
	price: z.string(),
	currency: z.string(),
	effectiveFrom: z.date(),
	effectiveTo: z.date().nullable(),
	createdBy: z.string(),
	createdAt: z.date(),
	isActive: z.boolean(),
});

export const commerceAdminCoursePricingListInputSchema =
	pricingPaginationInputSchema.extend({
		courseId: z.uuid(),
	});

export const commerceAdminCoursePricingCreateInputSchema = z
	.object({
		courseId: z.uuid(),
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

export const commerceAdminCoursePricingUpdateInputSchema = z.object({
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

export const commerceAdminCoursePricingListOutputSchema = z.object({
	items: z.array(coursePricingWindowSchema),
	pagination: z.object({
		page: z.number().int(),
		limit: z.number().int(),
		total: z.number().int(),
		totalPages: z.number().int(),
	}),
});

export const commerceAdminCoursePricingOutputSchema = coursePricingWindowSchema;
