import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Film, CheckCircle, Trash2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useContent, useCreateContent, useUpdateContent,
  useDeleteContent, useSetContentPublishState,
  useSetContentAvailability, useSetContentClassification,
} from "@/hooks/content/use-content";
import { useCategories } from "@/hooks/category/use-categories";
import { toast } from "sonner";
import type { ContentType } from "@/lib/types/content";

interface FormData {
  title:            string;
  description:      string;
  thumbnailImageId: string;
  fileId:           string;
  duration:         string;
  releaseDate:      string;
  contentType:      ContentType;
}

const INITIAL_FORM: FormData = {
  title:            "",
  description:      "",
  thumbnailImageId: "",
  fileId:           "",
  duration:         "",
  releaseDate:      "",
  contentType:      "MOVIE",
};

const CONTENT_TYPES: ContentType[] = ["MOVIE", "SERIES", "EPISODE", "MUSIC"];

function getSaveButtonLabel(isPending: boolean, isEdit: boolean): string {
  if (isPending) return "Saving...";
  if (isEdit)    return "Save Changes";
  return "Create Content";
}

export default function ContentForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const isEdit   = !!id;

  const { data: content, isLoading } = useContent(id ?? "");
  const { data: categoriesData }     = useCategories(1, "");

  const createMutation       = useCreateContent();
  const updateMutation       = useUpdateContent(id ?? "");
  const deleteMutation       = useDeleteContent();
  const publishMutation      = useSetContentPublishState(id ?? "");
  const availabilityMutation = useSetContentAvailability(id ?? "");
  const classifyMutation     = useSetContentClassification(id ?? "");

  const [form, setForm]                             = useState<FormData>(INITIAL_FORM);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (content && isEdit) {
      setForm({
        title:            content.title,
        description:      content.description ?? "",
        thumbnailImageId: content.thumbnailImageId ?? "",
        fileId:           content.fileId ?? "",
        duration:         content.duration?.toString() ?? "",
        releaseDate:      content.releaseDate
          ? new Date(content.releaseDate).toISOString().split("T")[0]
          : "",
        contentType:      content.contentType,
      });
      setSelectedCategories(content.categories?.map((c) => c.id) ?? []);
    }
  }, [content, isEdit]);

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = () => {
    if (!form.title.trim()) return;

    const payload = {
      title:            form.title,
      description:      form.description || null,
      thumbnailImageId: form.thumbnailImageId || null,
      fileId:           form.fileId || null,
      duration:         form.duration ? Number.parseInt(form.duration, 10) : null,
      releaseDate:      form.releaseDate || null,
      contentType:      form.contentType,
    };

    if (isEdit && id) {
      updateMutation.mutate(
        { id, patch: payload },
        {
          onSuccess: () => toast.success("Content updated"),
          onError:   () => toast.error("Failed to update content"),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (data) => {
          toast.success("Content created");
          navigate({ to: "/admin/content/$id", params: { id: data.id } });
        },
        onError: () => toast.error("Failed to create content"),
      });
    }
  };

  const handleDelete = () => {
    if (!id) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Content deleted");
          navigate({ to: "/admin/content" });
        },
        onError: () => toast.error("Failed to delete content"),
      }
    );
  };

  const handleCategoryToggle = (catId: string) => {
    const next = selectedCategories.includes(catId)
      ? selectedCategories.filter((c) => c !== catId)
      : [...selectedCategories, catId];

    setSelectedCategories(next);

    if (id) {
      classifyMutation.mutate(
        { id, categoryIds: next },
        { onError: () => toast.error("Failed to update categories") }
      );
    }
  };

  if (isEdit && isLoading) return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
      Loading content...
    </div>
  );

  const isPending  = createMutation.isPending || updateMutation.isPending;
  const categories = categoriesData?.items ?? [];

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6 items-start">

      {/* Left — Main Form */}
      <div className="rounded-xl border bg-card p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              {isEdit ? "Edit Content" : "Add New Content"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEdit
                ? "Update the details of this content item."
                : "Fill in the details to publish new content."}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Film size={20} className="text-primary" />
          </div>
        </div>

        <div className="divide-y">

          {/* Section 1: Identity */}
          <div className="grid grid-cols-[200px_1fr] gap-8 py-8">
            <div>
              <h2 className="font-semibold text-base">Content Identity</h2>
              <p className="text-sm text-muted-foreground mt-1">Basic information shown to users.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  placeholder="e.g. Introduction to React"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Content Type</Label>
                <Select value={form.contentType} onValueChange={(v) => set("contentType", v as ContentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Thumbnail Image ID
                  <span className="text-muted-foreground font-normal ml-1 text-xs">(optional)</span>
                </Label>
                <Input
                  placeholder="UUID of thumbnail image"
                  value={form.thumbnailImageId}
                  onChange={(e) => set("thumbnailImageId", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Description */}
          <div className="grid grid-cols-[200px_1fr] gap-8 py-8">
            <div>
              <h2 className="font-semibold text-base">Description</h2>
              <p className="text-sm text-muted-foreground mt-1">Detailed overview of the content.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Full Description</Label>
              <Textarea
                placeholder="Enter content description..."
                className="min-h-32 resize-none"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
          </div>

          {/* Section 3: Media */}
          <div className="grid grid-cols-[200px_1fr] gap-8 py-8">
            <div>
              <h2 className="font-semibold text-base">Media</h2>
              <p className="text-sm text-muted-foreground mt-1">File and playback details.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  File ID
                  <span className="text-muted-foreground font-normal ml-1 text-xs">(from Files page)</span>
                </Label>
                <Input
                  placeholder="UUID from /admin/files"
                  value={form.fileId}
                  onChange={(e) => set("fileId", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>
                    Duration
                    <span className="text-muted-foreground font-normal ml-1 text-xs">(seconds)</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g. 3600"
                    value={form.duration}
                    onChange={(e) => set("duration", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Release Date</Label>
                  <Input
                    type="date"
                    value={form.releaseDate}
                    onChange={(e) => set("releaseDate", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Categories */}
          <div className="grid grid-cols-[200px_1fr] gap-8 py-8">
            <div>
              <h2 className="font-semibold text-base">Categories</h2>
              <p className="text-sm text-muted-foreground mt-1">Tag this content with relevant categories.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categories available</p>
              ) : (
                categories.map((cat) => {
                  const selected = selectedCategories.includes(cat.id);
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => handleCategoryToggle(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                        ${selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                        }`}
                    >
                      {cat.title}
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6">
          {isEdit ? (
            <Button
              type="button"
              variant="destructive" className="gap-2"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
            >
              <Trash2 size={16} />
              {deleteMutation.isPending ? "Deleting..." : "Delete Content"}
            </Button>
          ) : <div />}

          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: "/admin/content" })}>
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={isPending || !form.title.trim()}
              onClick={handleSubmit}
            >
              <CheckCircle size={16} />
              {getSaveButtonLabel(isPending, isEdit)}
            </Button>
          </div>
        </div>
      </div>

      {/* Right — Status Panel (edit only) */}
      {isEdit && id && content && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="font-semibold text-sm">Status</h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Published</p>
                <p className="text-xs text-muted-foreground">Visible to users</p>
              </div>
              <Switch
                checked={content.isPublished}
                disabled={publishMutation.isPending}
                onCheckedChange={(v) => publishMutation.mutate({ id, isPublished: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Available</p>
                <p className="text-xs text-muted-foreground">Can be accessed</p>
              </div>
              <Switch
                checked={content.isAvailable}
                disabled={availabilityMutation.isPending}
                onCheckedChange={(v) => availabilityMutation.mutate({ id, isAvailable: v })}
              />
            </div>

            <div className="pt-2 border-t space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Views</span>
                <span className="font-medium">{content.viewCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{new Date(content.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Updated</span>
                <span className="font-medium">{new Date(content.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="rounded-xl border bg-card p-5 space-y-2">
            <h3 className="font-semibold text-sm mb-3">Manage</h3>
            <Button
              type="button"
              variant="outline" className="w-full justify-start gap-2 text-sm"
              onClick={() => navigate({ to: "/admin/content/$id/pricing", params: { id } })}
            >
              <DollarSign size={16} />
              Pricing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}