import type { z } from "zod";
import type {
  commerceAdminPlaylistPricingOutputSchema,
  commerceAdminContentPricingOutputSchema,
} from "server/modules/commerce/commerce.validators";

// Infer type from zod schema in server
export type PlaylistPricingWindow = z.infer<typeof commerceAdminPlaylistPricingOutputSchema>;
export type ContentPricingWindow  = z.infer<typeof commerceAdminContentPricingOutputSchema>;