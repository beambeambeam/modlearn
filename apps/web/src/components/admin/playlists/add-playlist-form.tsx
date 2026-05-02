import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
    if (!form.title.trim()) return;
    createMutation.mutate({
      title: form.title,
      description: form.description || null,
      thumbnailImageId: form.thumbnailImageId || null,
      isSeries: form.isSeries,
    });
  };

  return (
    <div className="rounded-xl border bg-card p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Add New Playlist</h1>
          <p className="text-muted-foreground mt-1">
            Fill in the detail to publish a new curriculum to the platform.
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BookOpen size={20} className="text-primary" />
        </div>
      </div>

      <div className="divide-y">
        {/* Identity */}
        <div className="grid grid-cols-[220px_1fr] gap-8 py-8">
          <div>
            <h2 className="font-semibold text-base">Playlist Identity</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Basic information that appears in search results and landing pages.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Playlist Title</Label>
              <Input
                placeholder="e.g. Advanced UI/UX Design Principles"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
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
        <div className="grid grid-cols-[220px_1fr] gap-8 py-8">
          <div>
            <h2 className="font-semibold text-base">Description</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Provide a detailed overview of the playlist objectives.
            </p>
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
        <div className="grid grid-cols-[220px_1fr] gap-8 py-8">
          <div>
            <h2 className="font-semibold text-base">Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Additional configuration for this playlist.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Series Playlist</p>
              <p className="text-xs text-muted-foreground mt-0.5">
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
        <Button variant="ghost" onClick={() => navigate({ to: "/admin/playlists" })}>
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