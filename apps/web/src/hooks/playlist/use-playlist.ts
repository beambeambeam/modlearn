import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { playlistKeys } from "./use-playlists";

export function usePlaylist(id: string) {
  return useQuery(
    orpc.playlist.adminGetByIdWithEpisodes.queryOptions({
      input: { id, onlyPublished: false },
    })
  );
}

export function useCreatePlaylist(onSuccess?: (id: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.playlist.adminCreate.mutationOptions(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() });
      onSuccess?.(data.id);
    },
  });
}

export function useUpdatePlaylist(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.playlist.adminUpdate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() });
      queryClient.invalidateQueries({ queryKey: playlistKeys.detail(id) });
    },
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

export function useSetPublishState(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.playlist.adminSetPublishState.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() });
    },
  });
}

export function useSetAvailability(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.playlist.adminSetAvailability.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() });
    },
  });
}