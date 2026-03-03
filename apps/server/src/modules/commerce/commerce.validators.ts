import { z } from "zod";

const commerceItemTypeSchema = z.enum(["CONTENT", "PLAYLIST"]);

export const commerceCartAddItemInputSchema = z
	.object({
		itemType: commerceItemTypeSchema,
		contentId: z.uuid().optional(),
		playlistId: z.uuid().optional(),
	})
	.superRefine((value, ctx) => {
		if (value.itemType === "CONTENT") {
			if (!value.contentId || value.playlistId) {
				ctx.addIssue({
					code: "custom",
					path: ["contentId"],
					message: "CONTENT item requires contentId only",
				});
			}
			return;
		}

		if (!value.playlistId || value.contentId) {
			ctx.addIssue({
				code: "custom",
				path: ["playlistId"],
				message: "PLAYLIST item requires playlistId only",
			});
		}
	});

export const commerceCartRemoveItemInputSchema = z.object({
	cartItemId: z.uuid(),
});

export const commerceCartItemOutputSchema = z.object({
	id: z.uuid(),
	itemType: commerceItemTypeSchema,
	contentId: z.uuid().nullable(),
	playlistId: z.uuid().nullable(),
	price: z.string(),
	currency: z.string(),
	addedAt: z.date(),
});

export const commerceCartOutputSchema = z.object({
	items: z.array(commerceCartItemOutputSchema),
	totalAmount: z.string(),
	currency: z.string().nullable(),
});

export const commerceCheckoutCreateOrderInputSchema = z.object({
	source: z.literal("CART").default("CART"),
});

export const commerceOrderItemOutputSchema = z.object({
	itemType: commerceItemTypeSchema,
	contentId: z.uuid().nullable(),
	playlistId: z.uuid().nullable(),
	price: z.string(),
	currency: z.string(),
});

export const commerceCheckoutOrderOutputSchema = z.object({
	orderId: z.uuid(),
	status: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]),
	totalAmount: z.string(),
	currency: z.string(),
	items: z.array(commerceOrderItemOutputSchema),
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
