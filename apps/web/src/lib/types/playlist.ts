import type {
	playlistEpisodeSchema,
	playlistListOutputSchema,
	playlistSchema,
	playlistWithEpisodesOutputSchema,
} from "server/modules/playlist/playlist.validators";
import type { z } from "zod";

// Infer type from zod schema in server
export type Playlist = z.infer<typeof playlistSchema>;
export type PlaylistEpisode = z.infer<typeof playlistEpisodeSchema>;
export type PlaylistListOutput = z.infer<typeof playlistListOutputSchema>;
export type PlaylistWithEpisodes = z.infer<
	typeof playlistWithEpisodesOutputSchema
>;
