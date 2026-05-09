import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, CheckCircle, Trash2, ListVideo, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  usePlaylist,
  useUpdatePlaylist,
  useDeletePlaylist,
  useSetPublishState,
  useSetAvailability,
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

  const updateMutation       = useUpdatePlaylist(id);
  const deleteMutation       = useDeletePlaylist();
  const publishMutation      = useSetPublishState(id);
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
        title:            playlist.title,
        description:      playlist.description ?? "",
        thumbnailImageId: playlist.thumbnailImageId ?? "",
        isSeries:         playlist.isSeries,
      });
    }
  }, [playlist]);

  const set = (field: keyof FormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = () => {
    updateMutation.mutate({
      id,
      patch: {
        title:            form.title,
        description:      form.description || null,
        thumbnailImageId: form.thumbnailImageId || null,
        isSeries:         form.isSeries,
      },
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => navigate({ to: "/admin/playlists" }),
    });
  };

  if (isLoading) return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
      Loading playlist...
    </div>
  );

  if (isError || !playlist) return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-destructive">
      Failed to load playlist
    </div>
  );

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6 items-start">

      {/* Left — Main Form */}
      <div className="rounded-xl border bg-card p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Edit Playlist</h1>
            <p className="text-muted-foreground mt-1">Update the details of this playlist.</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen size={20} className="text-primary" />
          </div>
        </div>

        <div className="divide-y">
          {/* Identity */}
          <div className="grid grid-cols-[200px_1fr] gap-8 py-8">
            <div>
              <h2 className="font-semibold text-base">Playlist Identity</h2>
              <p className="text-sm text-muted-foreground mt-1">Basic information shown in search results.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Playlist Title</Label>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Thumbnail Image ID
                  <span className="text-muted-foreground font-normal ml-1 text-xs">(optional)</span>
                </Label>
                <Input
                  placeholder="e.g. uuid ของรูปภาพ"
                  value={form.thumbnailImageId}
                  onChange={(e) => set("thumbnailImageId", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="grid grid-cols-[200px_1fr] gap-8 py-8">
            <div>
              <h2 className="font-semibold text-base">Description</h2>
              <p className="text-sm text-muted-foreground mt-1">Detailed overview of the playlist.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Full Description</Label>
              <Textarea
                placeholder="Enter playlist description..."
                className="min-h-36 resize-none"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-[200px_1fr] gap-8 py-8">
            <div>
              <h2 className="font-semibold text-base">Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">Additional configuration.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Series Playlist</p>
                <p className="text-xs text-muted-foreground mt-0.5">Enable if this playlist contains multiple episodes</p>
              </div>
              <Switch checked={form.isSeries} onCheckedChange={(v) => set("isSeries", v)} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6">
          <Button
            variant="destructive" className="gap-2"
            disabled={deleteMutation.isPending}
            onClick={handleDelete}
          >
            <Trash2 size={16} />
            {deleteMutation.isPending ? "Deleting..." : "Delete Playlist"}
          </Button>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate({ to: "/admin/playlists" })}>
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
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Status</h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Published</p>
              <p className="text-xs text-muted-foreground">Visible to users</p>
            </div>
            <Switch
              checked={playlist.isPublished}
              disabled={publishMutation.isPending}
              onCheckedChange={(v) => publishMutation.mutate({ id, isPublished: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Available</p>
              <p className="text-xs text-muted-foreground">Can be enrolled</p>
            </div>
            <Switch
              checked={playlist.isAvailable}
              disabled={availabilityMutation.isPending}
              onCheckedChange={(v) => availabilityMutation.mutate({ id, isAvailable: v })}
            />
          </div>

          <div className="pt-2 border-t space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{new Date(playlist.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Updated</span>
              <span className="font-medium">{new Date(playlist.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <h3 className="font-semibold text-sm mb-3">Manage</h3>
          <Button
            variant="outline" className="w-full justify-start gap-2 text-sm"
            onClick={() => navigate({ to: "/admin/playlists/$id/episodes", params: { id } })}
          >
            <ListVideo size={16} />
            Episodes
          </Button>
          <Button
            variant="outline" className="w-full justify-start gap-2 text-sm"
            onClick={() => navigate({ to: "/admin/playlists/$id/pricing", params: { id } })}
          >
            <DollarSign size={16} />
            Pricing
          </Button>
        </div>
      </div>
    </div>
  );
}