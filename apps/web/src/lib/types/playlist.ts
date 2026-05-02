import type { z } from "zod";
import type {
  playlistSchema,
  playlistEpisodeSchema,
  playlistListOutputSchema,
  playlistWithEpisodesOutputSchema,
} from "server/modules/playlist/playlist.validators";

// Infer type from zod schema in server
export type Playlist            = z.infer<typeof playlistSchema>;
export type PlaylistEpisode     = z.infer<typeof playlistEpisodeSchema>;
export type PlaylistListOutput  = z.infer<typeof playlistListOutputSchema>;
export type PlaylistWithEpisodes = z.infer<typeof playlistWithEpisodesOutputSchema>;