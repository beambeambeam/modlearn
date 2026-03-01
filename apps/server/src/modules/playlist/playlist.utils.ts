import { asc, eq, isNull, type SQL, sql } from "drizzle-orm";
import { playlistEpisode } from "@/lib/db/schema";

export function seasonBucketCondition(
	seasonNumber: number | null
): SQL<unknown> {
	if (seasonNumber === null) {
		return isNull(playlistEpisode.seasonNumber);
	}

	return eq(playlistEpisode.seasonNumber, seasonNumber);
}

export function episodesOrderBy() {
	return [
		sql`${playlistEpisode.seasonNumber} ASC NULLS LAST`,
		asc(playlistEpisode.episodeOrder),
		asc(playlistEpisode.addedAt),
		asc(playlistEpisode.id),
	] as const;
}
