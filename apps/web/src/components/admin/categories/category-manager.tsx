import { useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/hooks/category/use-categories";
import type { Category } from "@/lib/types/category";
import { toast } from "sonner";

const EMPTY_FORM = { title: "", slug: "", description: "" };

function getButtonLabel(isPending: boolean, editingId: string | null): string {
  if (isPending) return "Saving...";
  if (editingId) return "Save Changes";
  return "Create Category";
}

function CategoryTableBody({
  isLoading,
  isError,
  categories,
  deleteMutation,
  onEdit,
  onDelete,
}: {
  isLoading: boolean;
  isError: boolean;
  categories: Category[];
  deleteMutation: { isPending: boolean };
  onEdit: (cat: Category) => void;
  onDelete: (id: string, title: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading categories...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-16 text-center text-sm text-destructive">
        Failed to load categories
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No categories found
      </div>
    );
  }

  return (
    <>
      {categories.map((cat) => (
        <div
          key={cat.id}
          className="grid grid-cols-[1fr_1fr_auto] gap-4 items-center px-6 py-4 border-b last:border-0 hover:bg-muted/30 transition-colors"
        >
          <div>
            <p className="text-sm font-medium">{cat.title}</p>
            {cat.description && (
              <p className="text-xs text-muted-foreground truncate max-w-xs">
                {cat.description}
              </p>
            )}
          </div>

          <code className="text-xs text-muted-foreground">{cat.slug}</code>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost" size="icon"
              onClick={() => onEdit(cat)}
            >
              <Pencil size={15} />
            </Button>
            <Button
              type="button"
              variant="ghost" size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={deleteMutation.isPending}
              onClick={() => onDelete(cat.id, cat.title)}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        </div>
      ))}
    </>
  );
}

export default function CategoryManager() {
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);

  const { data, isLoading, isError } = useCategories(page, search);
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const categories = data?.items ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  const set = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      title:       cat.title,
      slug:        cat.slug ?? "",
      description: cat.description ?? "",
    });
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.slug.trim()) return;

    if (editingId) {
      updateMutation.mutate(
        {
          id: editingId,
          patch: {
            title:       form.title,
            slug:        form.slug,
            description: form.description || null,
          },
        },
        {
          onSuccess: () => { toast.success("Category updated"); handleCancel(); },
          onError:   () => toast.error("Failed to update category"),
        }
      );
    } else {
      createMutation.mutate(
        {
          title:       form.title,
          slug:        form.slug,
          description: form.description || null,
        },
        {
          onSuccess: () => { toast.success("Category created"); handleCancel(); },
          onError:   () => toast.error("Failed to create category"),
        }
      );
    }
  };

  const handleDelete = (id: string, title: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => toast.success(`Deleted: ${title}`),
        onError:   () => toast.error("Failed to delete category"),
      }
    );
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-6 items-start">

      {/* Left — Category List */}
      <div className="space-y-4">

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-4 px-6 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Title</span>
            <span>Slug</span>
            <span />
          </div>

          <CategoryTableBody
            isLoading={isLoading}
            isError={isError}
            categories={categories}
            deleteMutation={deleteMutation}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3">
            <span className="text-xs text-muted-foreground">
              {data?.pagination.total ?? 0} categories
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

      {/* Right — Form */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">
            {editingId ? "Edit Category" : "New Category"}
          </h3>
          {editingId && (
            <Button type="button" variant="ghost" size="icon" onClick={handleCancel}>
              <X size={16} />
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Frontend Development"
              value={form.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!editingId) {
                  set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input
              placeholder="e.g. frontend-development"
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Description
              <span className="text-muted-foreground font-normal ml-1 text-xs">(optional)</span>
            </Label>
            <Textarea
              placeholder="Brief description of this category..."
              className="min-h-24 resize-none"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </div>

        <Button
          type="button"
          className="w-full gap-2"
          disabled={isPending || !form.title.trim() || !form.slug.trim()}
          onClick={handleSubmit}
        >
          <CheckCircle size={16} />
          {getButtonLabel(isPending, editingId)}
        </Button>

        {!editingId && (
          <Button
            type="button"
            variant="outline" className="w-full gap-2"
            onClick={handleCancel}
          >
            <Plus size={16} />
            The form is always visible — just fill and submit
          </Button>
        )}
      </div>
    </div>
  );
}