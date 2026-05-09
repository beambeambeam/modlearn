import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export const playlistKeys = {
  all:     ()                        => ["playlist"]               as const,
  lists:   ()                        => ["playlist", "list"]       as const,
  list:    (page: number, search: string) => ["playlist", "list", page, search] as const,
  detail:  (id: string)              => ["playlist", "detail", id] as const,
  episodes:(id: string)              => ["playlist", "episodes", id] as const,
};

export function usePlaylists(page: number, search: string) {
  return useQuery({
    ...orpc.playlist.adminList.queryOptions({
      input: {
        page,
        limit: 4,
        search: search.trim() || undefined,
      },
    }),
    placeholderData: (prev) => prev,
  });
}

export function useDeletePlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.playlist.adminDelete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() });
    },
  });
}