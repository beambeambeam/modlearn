import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { playlistKeys } from "./use-playlists";

export function useAddEpisode(playlistId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.playlist.adminAddEpisode.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.episodes(playlistId) });
    },
  });
}

export function useRemoveEpisode(playlistId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.playlist.adminRemoveEpisode.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.episodes(playlistId) });
    },
  });
}

export function useReorderEpisodes(playlistId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.playlist.adminReorderEpisodes.mutationOptions(),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: playlistKeys.episodes(playlistId) });

      const previous = queryClient.getQueryData(playlistKeys.episodes(playlistId));

      queryClient.setQueryData(playlistKeys.episodes(playlistId), (old: any) => {
        if (!old) return old;
        const ordered = variables.episodeIds.map((epId, index) => {
          const ep = old.find((e: any) => e.id === epId);
          return { ...ep, episodeOrder: index + 1 };
        });
        return ordered;
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(playlistKeys.episodes(playlistId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.episodes(playlistId) });
    },
  });
}