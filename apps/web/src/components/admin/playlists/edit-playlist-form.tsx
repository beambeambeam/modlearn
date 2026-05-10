import { useNavigate } from "@tanstack/react-router";
import {
	BookOpen,
	CheckCircle,
	DollarSign,
	ListVideo,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	useDeletePlaylist,
	usePlaylist,
	useSetAvailability,
	useSetPublishState,
	useUpdatePlaylist,
} from "@/hooks/playlist/use-playlist";

interface FormData {
	title: string;
	description: string;
	thumbnailImageId: string;
	isSeries: boolean;
}

export default function EditPlaylistForm({ id }: { id: string }) {
	const navigate = useNavigate();
	const { data: playlist, isLoading, isError } = usePlaylist(id);

	const updateMutation = useUpdatePlaylist(id);
	const deleteMutation = useDeletePlaylist();
	const publishMutation = useSetPublishState(id);
	const availabilityMutation = useSetAvailability(id);

	const [form, setForm] = useState<FormData>({
		title: "",
		description: "",
		thumbnailImageId: "",
		isSeries: false,
	});

	useEffect(() => {
		if (playlist) {
			setForm({
				title: playlist.title,
				description: playlist.description ?? "",
				thumbnailImageId: playlist.thumbnailImageId ?? "",
				isSeries: playlist.isSeries,
			});
		}
	}, [playlist]);

	const set = (field: keyof FormData, value: string | boolean) =>
		setForm((prev) => ({ ...prev, [field]: value }));

	const handleSubmit = () => {
		updateMutation.mutate({
			id,
			patch: {
				title: form.title,
				description: form.description || null,
				thumbnailImageId: form.thumbnailImageId || null,
				isSeries: form.isSeries,
			},
		});
	};

	const handleDelete = () => {
		deleteMutation.mutate(
			{ id },
			{
				onSuccess: () => navigate({ to: "/admin/playlists" }),
			}
		);
	};

	if (isLoading) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-muted-foreground text-sm">
				Loading playlist...
			</div>
		);
	}

	if (isError || !playlist) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-destructive text-sm">
				Failed to load playlist
			</div>
		);
	}

	return (
		<div className="grid grid-cols-[1fr_280px] items-start gap-6">
			{/* Left — Main Form */}
			<div className="rounded-xl border bg-card p-8">
				<div className="mb-8 flex items-start justify-between">
					<div>
						<h1 className="font-bold text-3xl">Edit Playlist</h1>
						<p className="mt-1 text-muted-foreground">
							Update the details of this playlist.
						</p>
					</div>
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<BookOpen className="text-primary" size={20} />
					</div>
				</div>

				<div className="divide-y">
					{/* Identity */}
					<div className="grid grid-cols-[200px_1fr] gap-8 py-8">
						<div>
							<h2 className="font-semibold text-base">Playlist Identity</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								Basic information shown in search results.
							</p>
						</div>
						<div className="space-y-4">
							<div className="space-y-1.5">
								<Label>Playlist Title</Label>
								<Input
									onChange={(e) => set("title", e.target.value)}
									value={form.title}
								/>
							</div>
							<div className="space-y-1.5">
								<Label>
									Thumbnail Image ID
									<span className="ml-1 font-normal text-muted-foreground text-xs">
										(optional)
									</span>
								</Label>
								<Input
									onChange={(e) => set("thumbnailImageId", e.target.value)}
									placeholder="e.g. uuid ของรูปภาพ"
									value={form.thumbnailImageId}
								/>
							</div>
						</div>
					</div>

					{/* Description */}
					<div className="grid grid-cols-[200px_1fr] gap-8 py-8">
						<div>
							<h2 className="font-semibold text-base">Description</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								Detailed overview of the playlist.
							</p>
						</div>
						<div className="space-y-1.5">
							<Label>Full Description</Label>
							<Textarea
								className="min-h-36 resize-none"
								onChange={(e) => set("description", e.target.value)}
								placeholder="Enter playlist description..."
								value={form.description}
							/>
						</div>
					</div>

					{/* Settings */}
					<div className="grid grid-cols-[200px_1fr] gap-8 py-8">
						<div>
							<h2 className="font-semibold text-base">Settings</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								Additional configuration.
							</p>
						</div>
						<div className="flex items-center justify-between rounded-lg border p-4">
							<div>
								<p className="font-medium text-sm">Series Playlist</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									Enable if this playlist contains multiple episodes
								</p>
							</div>
							<Switch
								checked={form.isSeries}
								onCheckedChange={(v) => set("isSeries", v)}
							/>
						</div>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center justify-between pt-6">
					<Button
						className="gap-2"
						disabled={deleteMutation.isPending}
						onClick={handleDelete}
						variant="destructive"
					>
						<Trash2 size={16} />
						{deleteMutation.isPending ? "Deleting..." : "Delete Playlist"}
					</Button>
					<div className="flex gap-3">
						<Button
							onClick={() => navigate({ to: "/admin/playlists" })}
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							className="gap-2"
							disabled={updateMutation.isPending}
							onClick={handleSubmit}
						>
							<CheckCircle size={16} />
							{updateMutation.isPending ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</div>
			</div>

			{/* Right — Status Panel */}
			<div className="space-y-4">
				<div className="space-y-4 rounded-xl border bg-card p-5">
					<h3 className="font-semibold text-sm">Status</h3>

					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium text-sm">Published</p>
							<p className="text-muted-foreground text-xs">Visible to users</p>
						</div>
						<Switch
							checked={playlist.isPublished}
							disabled={publishMutation.isPending}
							onCheckedChange={(v) =>
								publishMutation.mutate({ id, isPublished: v })
							}
						/>
					</div>

					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium text-sm">Available</p>
							<p className="text-muted-foreground text-xs">Can be enrolled</p>
						</div>
						<Switch
							checked={playlist.isAvailable}
							disabled={availabilityMutation.isPending}
							onCheckedChange={(v) =>
								availabilityMutation.mutate({ id, isAvailable: v })
							}
						/>
					</div>

					<div className="space-y-2 border-t pt-2">
						<div className="flex justify-between text-xs">
							<span className="text-muted-foreground">Created</span>
							<span className="font-medium">
								{new Date(playlist.createdAt).toLocaleDateString()}
							</span>
						</div>
						<div className="flex justify-between text-xs">
							<span className="text-muted-foreground">Updated</span>
							<span className="font-medium">
								{new Date(playlist.updatedAt).toLocaleDateString()}
							</span>
						</div>
					</div>
				</div>

				{/* Quick Links */}
				<div className="space-y-2 rounded-xl border bg-card p-5">
					<h3 className="mb-3 font-semibold text-sm">Manage</h3>
					<Button
						className="w-full justify-start gap-2 text-sm"
						onClick={() =>
							navigate({ to: "/admin/playlists/$id/episodes", params: { id } })
						}
						variant="outline"
					>
						<ListVideo size={16} />
						Episodes
					</Button>
					<Button
						className="w-full justify-start gap-2 text-sm"
						onClick={() =>
							navigate({ to: "/admin/playlists/$id/pricing", params: { id } })
						}
						variant="outline"
					>
						<DollarSign size={16} />
						Pricing
					</Button>
				</div>
			</div>
		</div>
	);
}
