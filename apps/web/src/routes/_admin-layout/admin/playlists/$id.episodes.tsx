import { createFileRoute } from "@tanstack/react-router";
import EpisodeList from "@/components/admin/playlists/episode-list";

export const Route = createFileRoute("/_admin-layout/admin/playlists/$id/episodes")({
  component: EpisodesPage,
});

function EpisodesPage() {
  const { id } = Route.useParams();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Playlists</span>
        <span>{">"}</span>
        <button
          type="button"
          className="hover:text-foreground cursor-pointer"
          onClick={() => history.back()}
        >
          Edit Playlist
        </button>
        <span>{">"}</span>
        <span className="text-primary font-medium">Episodes</span>
      </div>

      <EpisodeList playlistId={id} />
    </div>
  );
}