import { createFileRoute } from "@tanstack/react-router";
import EditPlaylistForm from "@/components/admin/playlists/edit-playlist-form";

export const Route = createFileRoute("/_admin-layout/admin/playlists/$id/")({
	component: EditPlaylistPage,
});

function EditPlaylistPage() {
	const { id } = Route.useParams();

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 text-muted-foreground text-sm">
				<span>Playlists</span>
				<span>{">"}</span>
				<span className="font-medium text-primary">Edit Playlist</span>
			</div>
			<EditPlaylistForm id={id} />
		</div>
	);
}
