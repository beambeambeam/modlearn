import { useNavigate } from "@tanstack/react-router";
import { BookOpen, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePlaylist } from "@/hooks/playlist/use-playlist";

interface FormData {
	title: string;
	description: string;
	thumbnailImageId: string;
	isSeries: boolean;
}

const INITIAL_FORM: FormData = {
	title: "",
	description: "",
	thumbnailImageId: "",
	isSeries: false,
};

export default function AddCourseForm() {
	const navigate = useNavigate();
	const [form, setForm] = useState<FormData>(INITIAL_FORM);

	const createMutation = useCreatePlaylist((newId) => {
		navigate({ to: "/admin/playlists/$id", params: { id: newId } });
	});

	const set = (field: keyof FormData, value: string | boolean) =>
		setForm((prev) => ({ ...prev, [field]: value }));

	const handleSubmit = () => {
		if (!form.title.trim()) {
			return;
		}
		createMutation.mutate({
			title: form.title,
			description: form.description || null,
			thumbnailImageId: form.thumbnailImageId || null,
			isSeries: form.isSeries,
		});
	};

	return (
		<div className="rounded-xl border bg-card p-8">
			<div className="mb-8 flex items-start justify-between">
				<div>
					<h1 className="font-bold text-3xl">Add New Playlist</h1>
					<p className="mt-1 text-muted-foreground">
						Fill in the detail to publish a new curriculum to the platform.
					</p>
				</div>
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
					<BookOpen className="text-primary" size={20} />
				</div>
			</div>

			<div className="divide-y">
				{/* Identity */}
				<div className="grid grid-cols-[220px_1fr] gap-8 py-8">
					<div>
						<h2 className="font-semibold text-base">Playlist Identity</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							Basic information that appears in search results and landing
							pages.
						</p>
					</div>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<Label>Playlist Title</Label>
							<Input
								onChange={(e) => set("title", e.target.value)}
								placeholder="e.g. Advanced UI/UX Design Principles"
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
				<div className="grid grid-cols-[220px_1fr] gap-8 py-8">
					<div>
						<h2 className="font-semibold text-base">Description</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							Provide a detailed overview of the playlist objectives.
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
				<div className="grid grid-cols-[220px_1fr] gap-8 py-8">
					<div>
						<h2 className="font-semibold text-base">Settings</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							Additional configuration for this playlist.
						</p>
					</div>
					<div className="flex items-center justify-between rounded-lg border p-4">
						<div>
							<p className="font-medium text-sm">Series Playlist</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								Enable if this playlist contains multiple episodes in a series
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
			<div className="flex justify-end gap-3 pt-6">
				<Button
					onClick={() => navigate({ to: "/admin/playlists" })}
					variant="ghost"
				>
					Cancel
				</Button>
				<Button
					className="gap-2"
					disabled={createMutation.isPending || !form.title.trim()}
					onClick={handleSubmit}
				>
					<CheckCircle size={16} />
					{createMutation.isPending ? "Saving..." : "Save Playlist"}
				</Button>
			</div>
		</div>
	);
}
