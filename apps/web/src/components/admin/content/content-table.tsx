import { useNavigate } from "@tanstack/react-router";
import {
	Eye,
	EyeOff,
	Film,
	Music,
	Pencil,
	Plus,
	Search,
	Trash2,
	Video,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContents, useDeleteContent } from "@/hooks/content/use-content";
import type { Content, ContentType } from "@/lib/types/content";

const TYPE_ICON: Record<ContentType, React.ElementType> = {
	MOVIE: Film,
	SERIES: Video,
	EPISODE: Video,
	MUSIC: Music,
};

const TYPE_COLOR: Record<ContentType, string> = {
	MOVIE: "bg-blue-100 text-blue-600",
	SERIES: "bg-purple-100 text-purple-600",
	EPISODE: "bg-indigo-100 text-indigo-600",
	MUSIC: "bg-pink-100 text-pink-600",
};

function StatusBadge({ content }: { content: Content }) {
	if (!content.isPublished) {
		return <Badge variant="secondary">Draft</Badge>;
	}
	if (!content.isAvailable) {
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

const USE_MOCK = false; // ← flip to false when real API is ready

export default function ContentTable() {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [filterType, setFilterType] = useState<ContentType | undefined>();

	const apiResult = useContents(page, search, filterType);
	const deleteMutation = useDeleteContent();

	const contents = apiResult.data?.items ?? [];
	const totalPages = apiResult.data?.pagination.totalPages ?? 1;
	const isLoading = apiResult.isLoading;
	const isError = apiResult.isError;

	const filteredContents = USE_MOCK
		? contents.filter((c) => {
				const matchSearch = c.title
					.toLowerCase()
					.includes(search.toLowerCase());
				const matchType = filterType ? c.contentType === filterType : true;
				return matchSearch && matchType;
			})
		: contents;

	const handleDelete = (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		deleteMutation.mutate(
			{ id },
			{
				onSuccess: () => toast.success("Content deleted"),
				onError: () => toast.error("Failed to delete content"),
			}
		);
	};

	if (isLoading) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-muted-foreground text-sm">
				Loading content...
			</div>
		);
	}

	if (isError) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-destructive text-sm">
				Failed to load content
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Search + Filter + Add */}
			<div className="flex items-center gap-3">
				<div className="relative flex-1">
					<Search
						className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
						size={16}
					/>
					<Input
						className="pl-9"
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
						placeholder="Search content..."
						value={search}
					/>
				</div>

				{/* Type Filter */}
				<div className="flex items-center gap-1 rounded-lg border p-1">
					{([undefined, "MOVIE", "SERIES", "EPISODE", "MUSIC"] as const).map(
						(t) => (
							<button
								className={`rounded-md px-3 py-1 font-medium text-xs capitalize transition-colors ${
									filterType === t
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground"
								}`}
								key={t ?? "all"}
								onClick={() => {
									setFilterType(t);
									setPage(1);
								}}
								type="button"
							>
								{t ?? "All"}
							</button>
						)
					)}
				</div>

				<Button
					className="gap-2"
					onClick={() => navigate({ to: "/admin/content/new" })}
					type="button"
				>
					<Plus size={16} />
					Add Content
				</Button>
			</div>

			{/* Table */}
			<div className="rounded-xl border bg-card">
				<div className="grid grid-cols-[2.5fr_100px_80px_80px_100px_auto] gap-4 border-b px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					<span>Title</span>
					<span>Type</span>
					<span>Published</span>
					<span>Available</span>
					<span>Price</span>
					<span />
				</div>

				{filteredContents.length === 0 ? (
					<div className="py-16 text-center text-muted-foreground text-sm">
						No content found
					</div>
				) : (
					filteredContents.map((c) => {
						const Icon = TYPE_ICON[c.contentType];
						return (
							<div
								className="grid grid-cols-[2.5fr_100px_80px_80px_100px_auto] items-center gap-4 border-b px-6 py-4 transition-colors last:border-0 hover:bg-muted/30"
								key={c.id}
							>
								{/* Clickable row area — semantic button */}
								<button
									className="col-span-5 grid grid-cols-subgrid items-center gap-4 text-left"
									onClick={() =>
										navigate({ to: "/admin/content/$id", params: { id: c.id } })
									}
									type="button"
								>
									<div className="flex items-center gap-3">
										<div
											className={`flex h-8 w-8 items-center justify-center rounded-lg ${TYPE_COLOR[c.contentType]}`}
										>
											<Icon size={14} />
										</div>
										<div>
											<p className="font-medium text-sm">{c.title}</p>
											<p className="text-muted-foreground text-xs">
												{c.viewCount.toLocaleString()} views
											</p>
										</div>
									</div>

									<Badge className="w-fit text-xs capitalize" variant="outline">
										{c.contentType.toLowerCase()}
									</Badge>

									{c.isPublished ? (
										<Eye className="text-green-500" size={16} />
									) : (
										<EyeOff className="text-muted-foreground" size={16} />
									)}

									<StatusBadge content={c} />

									<span className="text-muted-foreground text-sm">
										{c.activePricing
											? `${c.activePricing.currency} ${c.activePricing.price}`
											: "Free"}
									</span>
								</button>

								{/* Action buttons — separate from the row click */}
								<div className="flex items-center gap-1">
									<Button
										onClick={() =>
											navigate({
												to: "/admin/content/$id",
												params: { id: c.id },
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
										disabled={deleteMutation.isPending}
										onClick={(e) => handleDelete(e, c.id)}
										size="icon"
										type="button"
										variant="ghost"
									>
										<Trash2 size={15} />
									</Button>
								</div>
							</div>
						);
					})
				)}

				<div className="flex items-center justify-between px-6 py-3">
					<span className="text-muted-foreground text-xs">
						Showing {filteredContents.length} of{" "}
						{apiResult.data?.pagination.total ?? 0} items
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
