import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { contentKeys } from "./use-content";

export const contentPricingKeys = {
  list: (contentId: string) => [...contentKeys.detail(contentId), "pricing"] as const,
};

export function useContentPricing(contentId: string) {
  return useQuery(
    orpc.commerce.adminPricing.content.list.queryOptions({
      input: { contentId, page: 1, limit: 50 },
    })
  );
}

export function useCreateContentPricing(contentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.commerce.adminPricing.content.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contentPricingKeys.list(contentId) });
      queryClient.invalidateQueries({ queryKey: contentKeys.detail(contentId) });
      queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
    },
  });
}

export function useUpdateContentPricing(contentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.commerce.adminPricing.content.update.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contentPricingKeys.list(contentId) });
      queryClient.invalidateQueries({ queryKey: contentKeys.detail(contentId) });
    },
  });
}