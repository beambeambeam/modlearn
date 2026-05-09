import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Plus, Pencil, Trash2, Video, Music, FileText, Film, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useContents, useDeleteContent } from "@/hooks/content/use-content";
import type { Content, ContentType } from "@/lib/types/content";
import { toast } from "sonner";

const TYPE_ICON: Record<ContentType, React.ElementType> = {
  MOVIE:   Film,
  SERIES:  Video,
  EPISODE: Video,
  MUSIC:   Music,
};

const TYPE_COLOR: Record<ContentType, string> = {
  MOVIE:   "bg-blue-100 text-blue-600",
  SERIES:  "bg-purple-100 text-purple-600",
  EPISODE: "bg-indigo-100 text-indigo-600",
  MUSIC:   "bg-pink-100 text-pink-600",
};

function StatusBadge({ content }: { content: Content }) {
  if (!content.isPublished) return <Badge variant="secondary">Draft</Badge>;
  if (!content.isAvailable) return <Badge className="bg-orange-100 text-orange-600 hover:bg-orange-100">Unavailable</Badge>;
  return <Badge className="bg-green-100 text-green-600 hover:bg-green-100">Active</Badge>;
}

const USE_MOCK = false; // ← flip to false when real API is ready

export default function ContentTable() {
  const navigate = useNavigate();
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
  const [filterType, setFilterType]   = useState<ContentType | undefined>();

  const apiResult                     = useContents(page, search, filterType);
  const deleteMutation                = useDeleteContent();


  const contents   = apiResult.data?.items ?? []
  const totalPages = apiResult.data?.pagination.totalPages ?? 1
  const isLoading  = apiResult.isLoading;
  const isError    = apiResult.isError;

  const filteredContents = USE_MOCK
    ? contents.filter((c) => {
        const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
        const matchType   = filterType ? c.contentType === filterType : true;
        return matchSearch && matchType;
      })
    : contents;

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => toast.success("Content deleted"),
        onError:   () => toast.error("Failed to delete content"),
      }
    );
  };

  if (isLoading) return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
      Loading content...
    </div>
  );

  if (isError) return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-destructive">
      Failed to load content
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Search + Filter + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {([undefined, "MOVIE", "SERIES", "EPISODE", "MUSIC"] as const).map((t) => (
            <button
              type="button"
              key={t ?? "all"}
              onClick={() => { setFilterType(t); setPage(1); }}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors
                ${filterType === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"}`}
            >
              {t ?? "All"}
            </button>
          ))}
        </div>

        <Button
          type="button"
          className="gap-2"
          onClick={() => navigate({ to: "/admin/content/new" })}
        >
          <Plus size={16} />
          Add Content
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <div className="grid grid-cols-[2.5fr_100px_80px_80px_100px_auto] gap-4 px-6 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Title</span>
          <span>Type</span>
          <span>Published</span>
          <span>Available</span>
          <span>Price</span>
          <span />
        </div>

        {filteredContents.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No content found
          </div>
        ) : (
          filteredContents.map((c) => {
            const Icon = TYPE_ICON[c.contentType];
            return (
              <div
                key={c.id}
                className="grid grid-cols-[2.5fr_100px_80px_80px_100px_auto] items-center gap-4 border-b px-6 py-4 transition-colors last:border-0 hover:bg-muted/30"
              >
                {/* Clickable row area — semantic button */}
                <button
                  type="button"
                  className="col-span-5 grid grid-cols-subgrid items-center gap-4 text-left"
                  onClick={() => navigate({ to: "/admin/content/$id", params: { id: c.id } })}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TYPE_COLOR[c.contentType]}`}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.viewCount.toLocaleString()} views
                      </p>
                    </div>
                  </div>

                  <Badge variant="outline" className="capitalize text-xs w-fit">
                    {c.contentType.toLowerCase()}
                  </Badge>

                  {c.isPublished
                    ? <Eye size={16} className="text-green-500" />
                    : <EyeOff size={16} className="text-muted-foreground" />
                  }

                  <StatusBadge content={c} />

                  <span className="text-sm text-muted-foreground">
                    {c.activePricing ? `${c.activePricing.currency} ${c.activePricing.price}` : "Free"}
                  </span>
                </button>

                {/* Action buttons — separate from the row click */}
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost" size="icon"
                    onClick={() => navigate({ to: "/admin/content/$id", params: { id: c.id } })}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost" size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={deleteMutation.isPending}
                    onClick={(e) => handleDelete(e, c.id)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            );
          })
        )}

        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-xs text-muted-foreground">
            Showing {filteredContents.length} of {apiResult.data?.pagination.total ?? 0} items
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