import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import type { ContentType } from "@/lib/types/content";

export const contentKeys = {
  all:    () => ["content"]                          as const,
  lists:  () => ["content", "list"]                  as const,
  list:   (page: number, search: string, type?: ContentType) =>
    ["content", "list", page, search, type]          as const,
  detail: (id: string) => ["content", "detail", id]  as const,
};

export function useContents(page: number, search: string, contentType?: ContentType) {
  return useQuery({
    ...orpc.content.adminList.queryOptions({
      input: {
        page,
        limit: 10,
        search:      search.trim() || undefined,
        contentType: contentType,
        onlyPublished: false,
      },
    }),
    placeholderData: (prev) => prev,
  });
}

export function useContent(id: string) {
  return useQuery(
    orpc.content.adminGetById.queryOptions({
      input: { id, onlyPublished: false },
    })
  );
}

export function useCreateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.content.adminCreate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
    },
  });
}

export function useUpdateContent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.content.adminUpdate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contentKeys.detail(id) });
    },
  });
}

export function useDeleteContent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.content.adminDelete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
    },
  });
}

export function useSetContentPublishState(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.content.adminSetPublishState.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
    },
  });
}

export function useSetContentAvailability(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.content.adminSetAvailability.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
    },
  });
}

export function useSetContentClassification(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.content.adminSetClassification.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contentKeys.detail(id) });
    },
  });
}