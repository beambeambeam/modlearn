import { CheckCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	useCategories,
	useCreateCategory,
	useDeleteCategory,
	useUpdateCategory,
} from "@/hooks/category/use-categories";
import type { Category } from "@/lib/types/category";

const EMPTY_FORM = { title: "", slug: "", description: "" };

function getButtonLabel(isPending: boolean, editingId: string | null): string {
	if (isPending) {
		return "Saving...";
	}
	if (editingId) {
		return "Save Changes";
	}
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
			<div className="py-16 text-center text-muted-foreground text-sm">
				Loading categories...
			</div>
		);
	}

	if (isError) {
		return (
			<div className="py-16 text-center text-destructive text-sm">
				Failed to load categories
			</div>
		);
	}

	if (categories.length === 0) {
		return (
			<div className="py-16 text-center text-muted-foreground text-sm">
				No categories found
			</div>
		);
	}

	return (
		<>
			{categories.map((cat) => (
				<div
					className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 border-b px-6 py-4 transition-colors last:border-0 hover:bg-muted/30"
					key={cat.id}
				>
					<div>
						<p className="font-medium text-sm">{cat.title}</p>
						{cat.description && (
							<p className="max-w-xs truncate text-muted-foreground text-xs">
								{cat.description}
							</p>
						)}
					</div>

					<code className="text-muted-foreground text-xs">{cat.slug}</code>

					<div className="flex items-center gap-1">
						<Button
							onClick={() => onEdit(cat)}
							size="icon"
							type="button"
							variant="ghost"
						>
							<Pencil size={15} />
						</Button>
						<Button
							className="text-destructive hover:bg-destructive/10 hover:text-destructive"
							disabled={deleteMutation.isPending}
							onClick={() => onDelete(cat.id, cat.title)}
							size="icon"
							type="button"
							variant="ghost"
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
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState(EMPTY_FORM);

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
			title: cat.title,
			slug: cat.slug ?? "",
			description: cat.description ?? "",
		});
	};

	const handleCancel = () => {
		setForm(EMPTY_FORM);
		setEditingId(null);
	};

	const handleSubmit = () => {
		if (!(form.title.trim() && form.slug.trim())) {
			return;
		}

		if (editingId) {
			updateMutation.mutate(
				{
					id: editingId,
					patch: {
						title: form.title,
						slug: form.slug,
						description: form.description || null,
					},
				},
				{
					onSuccess: () => {
						toast.success("Category updated");
						handleCancel();
					},
					onError: () => toast.error("Failed to update category"),
				}
			);
		} else {
			createMutation.mutate(
				{
					title: form.title,
					slug: form.slug,
					description: form.description || null,
				},
				{
					onSuccess: () => {
						toast.success("Category created");
						handleCancel();
					},
					onError: () => toast.error("Failed to create category"),
				}
			);
		}
	};

	const handleDelete = (id: string, title: string) => {
		deleteMutation.mutate(
			{ id },
			{
				onSuccess: () => toast.success(`Deleted: ${title}`),
				onError: () => toast.error("Failed to delete category"),
			}
		);
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<div className="grid grid-cols-[1fr_320px] items-start gap-6">
			{/* Left — Category List */}
			<div className="space-y-4">
				{/* Search */}
				<div className="relative">
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
						placeholder="Search categories..."
						value={search}
					/>
				</div>

				{/* Table */}
				<div className="rounded-xl border bg-card">
					<div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
						<span>Title</span>
						<span>Slug</span>
						<span />
					</div>

					<CategoryTableBody
						categories={categories}
						deleteMutation={deleteMutation}
						isError={isError}
						isLoading={isLoading}
						onDelete={handleDelete}
						onEdit={handleEdit}
					/>

					{/* Pagination */}
					<div className="flex items-center justify-between px-6 py-3">
						<span className="text-muted-foreground text-xs">
							{data?.pagination.total ?? 0} categories
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

			{/* Right — Form */}
			<div className="space-y-4 rounded-xl border bg-card p-5">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-sm">
						{editingId ? "Edit Category" : "New Category"}
					</h3>
					{editingId && (
						<Button
							onClick={handleCancel}
							size="icon"
							type="button"
							variant="ghost"
						>
							<X size={16} />
						</Button>
					)}
				</div>

				<div className="space-y-3">
					<div className="space-y-1.5">
						<Label>Title</Label>
						<Input
							onChange={(e) => {
								set("title", e.target.value);
								if (!editingId) {
									set(
										"slug",
										e.target.value
											.toLowerCase()
											.replace(/\s+/g, "-")
											.replace(/[^a-z0-9-]/g, "")
									);
								}
							}}
							placeholder="e.g. Frontend Development"
							value={form.title}
						/>
					</div>

					<div className="space-y-1.5">
						<Label>Slug</Label>
						<Input
							onChange={(e) => set("slug", e.target.value)}
							placeholder="e.g. frontend-development"
							value={form.slug}
						/>
					</div>

					<div className="space-y-1.5">
						<Label>
							Description
							<span className="ml-1 font-normal text-muted-foreground text-xs">
								(optional)
							</span>
						</Label>
						<Textarea
							className="min-h-24 resize-none"
							onChange={(e) => set("description", e.target.value)}
							placeholder="Brief description of this category..."
							value={form.description}
						/>
					</div>
				</div>

				<Button
					className="w-full gap-2"
					disabled={isPending || !form.title.trim() || !form.slug.trim()}
					onClick={handleSubmit}
					type="button"
				>
					<CheckCircle size={16} />
					{getButtonLabel(isPending, editingId)}
				</Button>

				{!editingId && (
					<Button
						className="w-full gap-2"
						onClick={handleCancel}
						type="button"
						variant="outline"
					>
						<Plus size={16} />
						The form is always visible — just fill and submit
					</Button>
				)}
			</div>
		</div>
	);
}
