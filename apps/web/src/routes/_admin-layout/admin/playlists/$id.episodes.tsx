import { createFileRoute } from "@tanstack/react-router";
import EpisodeList from "@/components/admin/playlists/episode-list";

export const Route = createFileRoute(
	"/_admin-layout/admin/playlists/$id/episodes"
)({
	component: EpisodesPage,
});

function EpisodesPage() {
	const { id } = Route.useParams();

	return (
		<div className="space-y-6">
			{/* Breadcrumb */}
			<div className="flex items-center gap-2 text-muted-foreground text-sm">
				<span>Playlists</span>
				<span>{">"}</span>
				<button
					className="cursor-pointer hover:text-foreground"
					onClick={() => history.back()}
					type="button"
				>
					Edit Playlist
				</button>
				<span>{">"}</span>
				<span className="font-medium text-primary">Episodes</span>
			</div>

			<EpisodeList playlistId={id} />
		</div>
	);
}
