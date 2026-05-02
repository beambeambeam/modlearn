import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export const categoryKeys = {
  all:   () => ["category"]              as const,
  lists: () => ["category", "list"]      as const,
  list:  (page: number, search: string) =>
    ["category", "list", page, search]   as const,
};

export function useCategories(page: number, search: string) {
  return useQuery({
    ...orpc.category.list.queryOptions({
      input: { page, limit: 20, search: search.trim() || undefined },
    }),
    placeholderData: (prev) => prev,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.category.adminCreate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.category.adminUpdate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.category.adminDelete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}