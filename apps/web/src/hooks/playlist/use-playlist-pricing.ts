import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { playlistKeys } from "./use-playlists";

export const playlistPricingKeys = {
  list: (playlistId: string) => [...playlistKeys.detail(playlistId), "pricing"] as const,
};

export function usePlaylistPricing(playlistId: string) {
  return useQuery(
    orpc.commerce.adminPricing.playlist.list.queryOptions({
      input: { playlistId, page: 1, limit: 50 },
    })
  );
}

export function useCreatePlaylistPricing(playlistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.commerce.adminPricing.playlist.create.mutationOptions(),
    onSuccess: () => {
      // invalidate pricing list + playlist detail
      queryClient.invalidateQueries({ queryKey: playlistPricingKeys.list(playlistId) });
      queryClient.invalidateQueries({ queryKey: playlistKeys.detail(playlistId) });
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() });
    },
  });
}

export function useUpdatePlaylistPricing(playlistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.commerce.adminPricing.playlist.update.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistPricingKeys.list(playlistId) });
      queryClient.invalidateQueries({ queryKey: playlistKeys.detail(playlistId) });
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() });
    },
  });
}