import { useNavigate } from "@tanstack/react-router";
import { BookOpen, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	useDeletePlaylist,
	usePlaylists,
} from "@/hooks/playlist/use-playlists";
import type { Playlist } from "@/lib/types/playlist";

// --- Status Badge ---
function StatusBadge({ playlist }: { playlist: Playlist }) {
	if (!playlist.isPublished) {
		return <Badge variant="secondary">Draft</Badge>;
	}
	if (!playlist.isAvailable) {
		return (
			<Badge className="bg-orange-100 text-orange-600 hover:bg-orange-100">
				Unavailable
			</Badge>
		);
	}
	return (
		<Badge className="bg-green-100 text-green-600 hover:bg-green-100">
			Active
		</Badge>
	);
}

// --- Main Component ---
export default function ManageCourseTable() {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);

	const { data, isLoading, isError } = usePlaylists(page, search);
	const deleteMutation = useDeletePlaylist();

	const playlists = data?.items ?? [];
	const totalPages = data?.pagination.totalPages ?? 1;

	const handleSearch = (val: string) => {
		setSearch(val);
		setPage(1);
	};

	const handleDelete = (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		deleteMutation.mutate({ id });
	};

	if (isLoading) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-muted-foreground text-sm">
				Loading playlists...
			</div>
		);
	}

	if (isError) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-destructive text-sm">
				Failed to load playlists
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Search + Add */}
			<div className="flex items-center gap-4">
				<div className="relative flex-1">
					<Search
						className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
						size={16}
					/>
					<Input
						className="pl-9"
						onChange={(e) => handleSearch(e.target.value)}
						placeholder="Search..."
						value={search}
					/>
				</div>
				<Button
					className="gap-2"
					onClick={() => navigate({ to: "/admin/playlists/new" })}
					type="button"
				>
					<Plus size={16} />
					Add Playlist
				</Button>
			</div>

			{/* Table */}
			<div className="rounded-xl border bg-card">
				<div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					<span>Name</span>
					<span>Price</span>
					<span>Status</span>
					<span />
				</div>

				{playlists.length === 0 ? (
					<div className="py-16 text-center text-muted-foreground text-sm">
						No playlists found
					</div>
				) : (
					playlists.map((playlist) => (
						<div
							className="grid grid-cols-[2fr_1fr_0.9fr_auto] items-center gap-4 border-b px-6 py-4 transition-colors last:border-0 hover:bg-muted/30"
							key={playlist.id}
						>
							{/* Clickable row area */}
							<button
								className="col-span-3 grid grid-cols-subgrid items-center gap-4 text-left"
								onClick={() =>
									navigate({
										to: "/admin/playlists/$id",
										params: { id: playlist.id },
									})
								}
								type="button"
							>
								<div className="flex items-center gap-3">
									<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
										<BookOpen className="text-primary" size={16} />
									</div>
									<div>
										<p className="font-medium text-sm">{playlist.title}</p>
										<p className="text-muted-foreground text-xs">
											{playlist.isSeries ? "Series" : "Single"}
										</p>
									</div>
								</div>

								<span className="font-medium text-sm">
									{playlist.activePricing
										? `${playlist.activePricing.currency} ${playlist.activePricing.price}`
										: "Free"}
								</span>

								<StatusBadge playlist={playlist} />
							</button>

							{/* Action buttons — separate from row click */}
							<div className="flex items-center gap-2">
								<Button
									className="text-destructive hover:bg-destructive/10 hover:text-destructive"
									disabled={deleteMutation.isPending}
									onClick={(e) => handleDelete(e, playlist.id)}
									size="icon"
									type="button"
									variant="ghost"
								>
									<Trash2 size={16} />
								</Button>
							</div>
						</div>
					))
				)}

				<div className="flex items-center justify-between px-6 py-3">
					<span className="text-muted-foreground text-xs">
						Showing {playlists.length} of {data?.pagination.total ?? 0}{" "}
						playlists
					</span>
					<div className="flex items-center gap-1">
						<Button
							className="h-8 w-8"
							disabled={page === 1}
							onClick={() => setPage((p) => p - 1)}
							size="icon"
							type="button"
							variant="ghost"
						>
							{"<"}
						</Button>
						{Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
							<Button
								className="h-8 w-8 text-xs"
								key={p}
								onClick={() => setPage(p)}
								size="icon"
								type="button"
								variant={p === page ? "default" : "ghost"}
							>
								{p}
							</Button>
						))}
						<Button
							className="h-8 w-8"
							disabled={page === totalPages}
							onClick={() => setPage((p) => p + 1)}
							size="icon"
							type="button"
							variant="ghost"
						>
							{">"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
