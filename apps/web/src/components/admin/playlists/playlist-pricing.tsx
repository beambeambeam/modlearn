import { useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	CheckCircle,
	DollarSign,
	Pencil,
	Plus,
	X,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	useCreatePlaylistPricing,
	usePlaylistPricing,
	useUpdatePlaylistPricing,
} from "@/hooks/playlist/use-playlist-pricing";
import type { PlaylistPricingWindow } from "@/lib/types/commerce";

const EMPTY_FORM = {
	price: "",
	currency: "USD",
	effectiveFrom: "",
	effectiveTo: "",
};

export default function PlaylistPricing({
	playlistId,
}: {
	playlistId: string;
}) {
	const navigate = useNavigate();

	const { data, isLoading, isError } = usePlaylistPricing(playlistId);
	const createMutation = useCreatePlaylistPricing(playlistId);
	const updateMutation = useUpdatePlaylistPricing(playlistId);

	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState(EMPTY_FORM);

	const windows = data?.items ?? [];
	const activePrice = windows.find((w) => w.isActive);

	const set = (field: keyof typeof EMPTY_FORM, value: string) =>
		setForm((prev) => ({ ...prev, [field]: value }));

	const handleEdit = (pw: PlaylistPricingWindow) => {
		setEditingId(pw.id);
		setForm({
			price: pw.price,
			currency: pw.currency,
			effectiveFrom: new Date(pw.effectiveFrom).toISOString().split("T")[0],
			effectiveTo: pw.effectiveTo
				? new Date(pw.effectiveTo).toISOString().split("T")[0]
				: "",
		});
		setShowForm(true);
	};

	const handleCancel = () => {
		setForm(EMPTY_FORM);
		setEditingId(null);
		setShowForm(false);
	};

	const handleSubmit = () => {
		if (!(form.price && form.effectiveFrom)) {
			return;
		}

		const effectiveFrom = new Date(form.effectiveFrom);
		const effectiveTo = form.effectiveTo ? new Date(form.effectiveTo) : null;

		if (editingId) {
			updateMutation.mutate(
				{
					id: editingId,
					patch: {
						price: form.price,
						currency: form.currency,
						effectiveFrom,
						effectiveTo,
					},
				},
				{ onSuccess: handleCancel }
			);
		} else {
			createMutation.mutate(
				{
					playlistId,
					price: form.price,
					currency: form.currency,
					effectiveFrom,
					effectiveTo,
				},
				{ onSuccess: handleCancel }
			);
		}
	};

	if (isLoading) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-muted-foreground text-sm">
				Loading pricing...
			</div>
		);
	}

	if (isError) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-destructive text-sm">
				Failed to load pricing
			</div>
		);
	}

	const isPending = createMutation.isPending || updateMutation.isPending;
	const buttonLabel = editingId ? "Save Changes" : "Add Pricing Window";

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl">Pricing</h1>
					<p className="mt-0.5 text-muted-foreground text-sm">
						Manage pricing windows for this playlist
					</p>
				</div>
				<Button
					className="gap-2"
					onClick={() =>
						navigate({ to: "/admin/playlists/$id", params: { id: playlistId } })
					}
					type="button"
					variant="outline"
				>
					<ArrowLeft size={16} />
					Back to Playlist
				</Button>
			</div>

			<div className="grid grid-cols-[1fr_320px] items-start gap-6">
				{/* Left — Pricing Windows Table */}
				<div className="rounded-xl border bg-card">
					<div className="grid grid-cols-[1fr_80px_1fr_1fr_80px_auto] gap-4 border-b px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
						<span>Price</span>
						<span>Currency</span>
						<span>Effective From</span>
						<span>Effective To</span>
						<span>Status</span>
						<span />
					</div>

					{windows.length === 0 ? (
						<div className="py-16 text-center text-muted-foreground text-sm">
							No pricing windows yet
						</div>
					) : (
						windows.map((pw) => (
							<div
								className="grid grid-cols-[1fr_80px_1fr_1fr_80px_auto] items-center gap-4 border-b px-6 py-4 transition-colors last:border-0 hover:bg-muted/30"
								key={pw.id}
							>
								<span className="font-semibold text-sm">${pw.price}</span>
								<span className="text-muted-foreground text-sm">
									{pw.currency}
								</span>
								<span className="text-muted-foreground text-sm">
									{new Date(pw.effectiveFrom).toLocaleDateString()}
								</span>
								<span className="text-muted-foreground text-sm">
									{pw.effectiveTo
										? new Date(pw.effectiveTo).toLocaleDateString()
										: "—"}
								</span>
								{pw.isActive ? (
									<Badge className="bg-green-100 text-green-600 hover:bg-green-100">
										Active
									</Badge>
								) : (
									<Badge variant="secondary">Inactive</Badge>
								)}
								<div className="flex items-center gap-1">
									<Button
										onClick={() => handleEdit(pw)}
										size="icon"
										type="button"
										variant="ghost"
									>
										<Pencil size={15} />
									</Button>
								</div>
							</div>
						))
					)}

					<div className="flex justify-end px-6 py-3">
						<Button
							className="gap-2"
							onClick={() => {
								setShowForm(true);
								setEditingId(null);
								setForm(EMPTY_FORM);
							}}
							size="sm"
							type="button"
							variant="outline"
						>
							<Plus size={14} />
							Add Pricing Window
						</Button>
					</div>
				</div>

				{/* Right — Active Price + Form */}
				<div className="space-y-4">
					{/* Active Price Card */}
					<div className="rounded-xl border bg-card p-5">
						<h3 className="mb-4 font-semibold text-sm">Current Price</h3>
						{activePrice ? (
							<div className="flex items-center gap-3">
								<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
									<DollarSign className="text-primary" size={22} />
								</div>
								<div>
									<p className="font-bold text-3xl">${activePrice.price}</p>
									<p className="mt-0.5 text-muted-foreground text-xs">
										{activePrice.currency} · Since{" "}
										{new Date(activePrice.effectiveFrom).toLocaleDateString()}
									</p>
								</div>
							</div>
						) : (
							<p className="text-muted-foreground text-sm">
								No active price set
							</p>
						)}
					</div>

					{/* Form */}
					{showForm && (
						<div className="space-y-4 rounded-xl border bg-card p-5">
							<div className="flex items-center justify-between">
								<h3 className="font-semibold text-sm">
									{editingId ? "Edit Pricing Window" : "New Pricing Window"}
								</h3>
								<Button
									onClick={handleCancel}
									size="icon"
									type="button"
									variant="ghost"
								>
									<X size={16} />
								</Button>
							</div>

							<div className="space-y-3">
								<div className="space-y-1.5">
									<Label>Price</Label>
									<div className="relative">
										<span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
											$
										</span>
										<Input
											className="pl-7"
											onChange={(e) => set("price", e.target.value)}
											placeholder="0.00"
											value={form.price}
										/>
									</div>
								</div>

								<div className="space-y-1.5">
									<Label>Currency</Label>
									<Input
										onChange={(e) => set("currency", e.target.value)}
										placeholder="USD"
										value={form.currency}
									/>
								</div>

								<div className="space-y-1.5">
									<Label>Effective From</Label>
									<Input
										onChange={(e) => set("effectiveFrom", e.target.value)}
										type="date"
										value={form.effectiveFrom}
									/>
								</div>

								<div className="space-y-1.5">
									<Label>
										Effective To
										<span className="ml-1 font-normal text-muted-foreground text-xs">
											(optional)
										</span>
									</Label>
									<Input
										onChange={(e) => set("effectiveTo", e.target.value)}
										type="date"
										value={form.effectiveTo}
									/>
								</div>
							</div>

							<Button
								className="w-full gap-2"
								disabled={isPending || !form.price || !form.effectiveFrom}
								onClick={handleSubmit}
								type="button"
							>
								<CheckCircle size={16} />
								{isPending ? "Saving..." : buttonLabel}
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
