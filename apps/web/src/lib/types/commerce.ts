import type {
	commerceAdminContentPricingOutputSchema,
	commerceAdminPlaylistPricingOutputSchema,
} from "server/modules/commerce/commerce.validators";
import type { z } from "zod";

// Infer type from zod schema in server
export type PlaylistPricingWindow = z.infer<
	typeof commerceAdminPlaylistPricingOutputSchema
>;
export type ContentPricingWindow = z.infer<
	typeof commerceAdminContentPricingOutputSchema
>;
