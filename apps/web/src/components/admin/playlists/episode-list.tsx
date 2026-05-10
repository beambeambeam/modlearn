import { useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	CheckCircle,
	GripVertical,
	Pencil,
	Plus,
	Trash2,
	Video,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlaylist } from "@/hooks/playlist/use-playlist";
import {
	useRemoveEpisode,
	useReorderEpisodes,
} from "@/hooks/playlist/use-playlist-episodes";
import type { PlaylistEpisode } from "@/lib/types/playlist";

function formatDuration(seconds: number | null) {
	if (!seconds) {
		return "—";
	}
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function EpisodeList({ playlistId }: { playlistId: string }) {
	const navigate = useNavigate();

	const { data: playlist, isLoading, isError } = usePlaylist(playlistId);
	const removeMutation = useRemoveEpisode(playlistId);
	const reorderMutation = useReorderEpisodes(playlistId);

	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [localEpisodes, setLocalEpisodes] = useState<PlaylistEpisode[] | null>(
		null
	);
	const [hasChanges, setHasChanges] = useState(false);

	const episodes = localEpisodes ?? playlist?.episodes ?? [];

	const handleDragStart = (id: string) => setDraggingId(id);

	const handleDragOver = (e: React.DragEvent, targetId: string) => {
		e.preventDefault();
		if (!draggingId || draggingId === targetId) {
			return;
		}

		const items = [...episodes];
		const fromIdx = items.findIndex((ep) => ep.id === draggingId);
		const toIdx = items.findIndex((ep) => ep.id === targetId);
		const [moved] = items.splice(fromIdx, 1);
		items.splice(toIdx, 0, moved);
		setLocalEpisodes(items.map((ep, i) => ({ ...ep, episodeOrder: i + 1 })));
		setHasChanges(true);
	};

	const handleDragEnd = () => setDraggingId(null);

	const handleSaveOrder = () => {
		reorderMutation.mutate(
			{ playlistId, episodeIds: episodes.map((ep) => ep.id) },
			{
				onSuccess: () => {
					setLocalEpisodes(null);
					setHasChanges(false);
				},
			}
		);
	};

	const handleRemove = (episodeId: string) => {
		removeMutation.mutate({ id: episodeId });
	};

	if (isLoading) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-muted-foreground text-sm">
				Loading episodes...
			</div>
		);
	}

	if (isError || !playlist) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-destructive text-sm">
				Failed to load episodes
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl">Episodes</h1>
					<p className="mt-0.5 text-muted-foreground text-sm">
						{playlist.title} — drag to reorder
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						className="gap-2"
						onClick={() =>
							navigate({
								to: "/admin/playlists/$id",
								params: { id: playlistId },
							})
						}
						type="button"
						variant="outline"
					>
						<ArrowLeft size={16} />
						Back to Playlist
					</Button>
					{hasChanges && (
						<Button
							className="gap-2"
							disabled={reorderMutation.isPending}
							onClick={handleSaveOrder}
							type="button"
						>
							<CheckCircle size={16} />
							{reorderMutation.isPending ? "Saving..." : "Save Order"}
						</Button>
					)}
				</div>
			</div>

			{/* Table */}
			<div className="overflow-hidden rounded-xl border bg-card">
				<table className="w-full">
					<thead>
						<tr className="border-b">
							<th className="w-8 px-6 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide" />
							<th className="w-10 px-2 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
								#
							</th>
							<th className="px-2 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
								Title
							</th>
							<th className="w-20 px-2 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
								Duration
							</th>
							<th className="w-24 px-2 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
								Type
							</th>
							<th className="px-6 py-3" />
						</tr>
					</thead>
					<tbody>
						{episodes.length === 0 ? (
							<tr>
								<td
									className="py-16 text-center text-muted-foreground text-sm"
									colSpan={6}
								>
									No episodes yet — add content to this playlist
								</td>
							</tr>
						) : (
							episodes
								.slice()
								.sort((a, b) => a.episodeOrder - b.episodeOrder)
								.map((ep) => (
									<tr
										aria-label={`Episode ${ep.episodeOrder}: ${ep.title ?? ep.content.title}`}
										className={`border-b transition-colors last:border-0 ${
											draggingId === ep.id
												? "bg-muted opacity-40"
												: "hover:bg-muted/30"
										}`}
										draggable
										key={ep.id}
										onDragEnd={handleDragEnd}
										onDragOver={(e) => handleDragOver(e, ep.id)}
										onDragStart={() => handleDragStart(ep.id)}
										tabIndex={0}
									>
										<td className="px-6 py-4">
											<GripVertical
												className="cursor-grab text-muted-foreground"
												size={16}
											/>
										</td>

										<td className="px-2 py-4">
											<span className="font-mono text-muted-foreground text-sm">
												{ep.episodeOrder}
											</span>
										</td>

										<td className="px-2 py-4">
											<div className="flex items-center gap-3">
												<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
													<Video className="text-primary" size={14} />
												</div>
												<div>
													<p className="font-medium text-sm">
														{ep.title ?? ep.content.title}
													</p>
													{ep.seasonNumber && (
														<p className="text-muted-foreground text-xs">
															S{ep.seasonNumber} E{ep.episodeNumber}
														</p>
													)}
												</div>
											</div>
										</td>

										<td className="px-2 py-4">
											<span className="text-muted-foreground text-sm">
												{formatDuration(ep.content.duration)}
											</span>
										</td>

										<td className="px-2 py-4">
											<Badge
												className="w-fit text-xs capitalize"
												variant="outline"
											>
												{ep.content.contentType.toLowerCase()}
											</Badge>
										</td>

										<td className="px-6 py-4">
											<div className="flex items-center gap-1">
												<Button
													onClick={() =>
														navigate({
															to: "/admin/content/$id",
															params: { id: ep.content.id },
														})
													}
													size="icon"
													type="button"
													variant="ghost"
												>
													<Pencil size={15} />
												</Button>
												<Button
													className="text-destructive hover:bg-destructive/10 hover:text-destructive"
													disabled={removeMutation.isPending}
													onClick={() => handleRemove(ep.id)}
													size="icon"
													type="button"
													variant="ghost"
												>
													<Trash2 size={15} />
												</Button>
											</div>
										</td>
									</tr>
								))
						)}
					</tbody>
				</table>

				{/* Footer */}
				<div className="flex items-center justify-between border-t px-6 py-3">
					<span className="text-muted-foreground text-xs">
						{episodes.length} episode{episodes.length !== 1 ? "s" : ""}
					</span>
					<Button
						className="gap-2"
						onClick={() => navigate({ to: "/admin/content" })}
						size="sm"
						type="button"
						variant="outline"
					>
						<Plus size={14} />
						Add from Content
					</Button>
				</div>
			</div>
		</div>
	);
}
