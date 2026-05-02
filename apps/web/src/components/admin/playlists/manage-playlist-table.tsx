import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Plus, Trash2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePlaylists, useDeletePlaylist } from "@/hooks/playlist/use-playlists";
import type { Playlist } from "@/lib/types/playlist";

// --- Status Badge ---
function StatusBadge({ playlist }: { playlist: Playlist }) {
  if (!playlist.isPublished)
    return <Badge variant="secondary">Draft</Badge>;
  if (!playlist.isAvailable)
    return <Badge className="bg-orange-100 text-orange-600 hover:bg-orange-100">Unavailable</Badge>;
  return <Badge className="bg-green-100 text-green-600 hover:bg-green-100">Active</Badge>;
}

// --- Main Component ---
export default function ManageCourseTable() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);

  const { data, isLoading, isError } = usePlaylists(page, search);
  const deleteMutation = useDeletePlaylist();

  const playlists  = data?.items ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteMutation.mutate({ id });
  };

  if (isLoading) return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
      Loading playlists...
    </div>
  );

  if (isError) return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-destructive">
      Failed to load playlists
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Search + Add */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Button type="button" className="gap-2" onClick={() => navigate({ to: "/admin/playlists/new" })}>
          <Plus size={16} />
          Add Playlist
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Name</span>
          <span>Price</span>
          <span>Status</span>
          <span />
        </div>

        {playlists.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No playlists found</div>
        ) : (
          playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="grid grid-cols-[2fr_1fr_0.9fr_auto] items-center gap-4 border-b px-6 py-4 transition-colors last:border-0 hover:bg-muted/30"
            >
              {/* Clickable row area */}
              <button
                type="button"
                className="col-span-3 grid grid-cols-subgrid items-center gap-4 text-left"
                onClick={() => navigate({ to: "/admin/playlists/$id", params: { id: playlist.id } })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{playlist.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {playlist.isSeries ? "Series" : "Single"}
                    </p>
                  </div>
                </div>

                <span className="text-sm font-medium">
                  {playlist.activePricing
                    ? `${playlist.activePricing.currency} ${playlist.activePricing.price}`
                    : "Free"}
                </span>

                <StatusBadge playlist={playlist} />
              </button>

              {/* Action buttons — separate from row click */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost" size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deleteMutation.isPending}
                  onClick={(e) => handleDelete(e, playlist.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))
        )}

        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-xs text-muted-foreground">
            Showing {playlists.length} of {data?.pagination.total ?? 0} playlists
          </span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>{"<"}</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button type="button" key={p} variant={p === page ? "default" : "ghost"} size="icon" className="h-8 w-8 text-xs" onClick={() => setPage(p)}>{p}</Button>
            ))}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>{">"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}