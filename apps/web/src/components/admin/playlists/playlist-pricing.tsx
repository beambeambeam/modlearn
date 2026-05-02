import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DollarSign, Plus, Pencil, Trash2, ArrowLeft, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  usePlaylistPricing,
  useCreatePlaylistPricing,
  useUpdatePlaylistPricing,
} from "@/hooks/playlist/use-playlist-pricing";
import type { PlaylistPricingWindow } from "@/lib/types/commerce";

const EMPTY_FORM = {
  price: "",
  currency: "USD",
  effectiveFrom: "",
  effectiveTo: "",
};

export default function PlaylistPricing({ playlistId }: { playlistId: string }) {
  const navigate = useNavigate();

  const { data, isLoading, isError } = usePlaylistPricing(playlistId);
  const createMutation = useCreatePlaylistPricing(playlistId);
  const updateMutation = useUpdatePlaylistPricing(playlistId);

  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);

  const windows     = data?.items ?? [];
  const activePrice = windows.find((w) => w.isActive);

  const set = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleEdit = (pw: PlaylistPricingWindow) => {
    setEditingId(pw.id);
    setForm({
      price:         pw.price,
      currency:      pw.currency,
      effectiveFrom: new Date(pw.effectiveFrom).toISOString().split("T")[0],
      effectiveTo:   pw.effectiveTo
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
    if (!form.price || !form.effectiveFrom) return;

    const effectiveFrom = new Date(form.effectiveFrom);
    const effectiveTo   = form.effectiveTo ? new Date(form.effectiveTo) : null;

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, patch: { price: form.price, currency: form.currency, effectiveFrom, effectiveTo } },
        { onSuccess: handleCancel }
      );
    } else {
      createMutation.mutate(
        { playlistId, price: form.price, currency: form.currency, effectiveFrom, effectiveTo },
        { onSuccess: handleCancel }
      );
    }
  };

  if (isLoading) return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
      Loading pricing...
    </div>
  );

  if (isError) return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-destructive">
      Failed to load pricing
    </div>
  );

  const isPending = createMutation.isPending || updateMutation.isPending;
  const buttonLabel = editingId ? "Save Changes" : "Add Pricing Window";

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pricing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage pricing windows for this playlist
          </p>
        </div>
        <Button
          type="button"
          variant="outline" className="gap-2"
          onClick={() => navigate({ to: "/admin/playlists/$id", params: { id: playlistId } })}
        >
          <ArrowLeft size={16} />
          Back to Playlist
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6 items-start">

        {/* Left — Pricing Windows Table */}
        <div className="rounded-xl border bg-card">
          <div className="grid grid-cols-[1fr_80px_1fr_1fr_80px_auto] gap-4 px-6 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Price</span>
            <span>Currency</span>
            <span>Effective From</span>
            <span>Effective To</span>
            <span>Status</span>
            <span></span>
          </div>

          {windows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No pricing windows yet
            </div>
          ) : (
            windows.map((pw) => (
              <div
                key={pw.id}
                className="grid grid-cols-[1fr_80px_1fr_1fr_80px_auto] gap-4 items-center px-6 py-4 border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm font-semibold">${pw.price}</span>
                <span className="text-sm text-muted-foreground">{pw.currency}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(pw.effectiveFrom).toLocaleDateString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  {pw.effectiveTo ? new Date(pw.effectiveTo).toLocaleDateString() : "—"}
                </span>
                {pw.isActive
                  ? <Badge className="bg-green-100 text-green-600 hover:bg-green-100">Active</Badge>
                  : <Badge variant="secondary">Inactive</Badge>
                }
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleEdit(pw)}>
                    <Pencil size={15} />
                  </Button>
                </div>
              </div>
            ))
          )}

          <div className="px-6 py-3 flex justify-end">
            <Button
              type="button"
              variant="outline" size="sm" className="gap-2"
              onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
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
            <h3 className="font-semibold text-sm mb-4">Current Price</h3>
            {activePrice ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DollarSign size={22} className="text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold">${activePrice.price}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activePrice.currency} · Since {new Date(activePrice.effectiveFrom).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active price set</p>
            )}
          </div>

          {/* Form */}
          {showForm && (
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  {editingId ? "Edit Pricing Window" : "New Pricing Window"}
                </h3>
                <Button type="button" variant="ghost" size="icon" onClick={handleCancel}>
                  <X size={16} />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      placeholder="0.00"
                      className="pl-7"
                      value={form.price}
                      onChange={(e) => set("price", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Input
                    placeholder="USD"
                    value={form.currency}
                    onChange={(e) => set("currency", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Effective From</Label>
                  <Input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => set("effectiveFrom", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Effective To
                    <span className="text-muted-foreground font-normal ml-1 text-xs">(optional)</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.effectiveTo}
                    onChange={(e) => set("effectiveTo", e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="button"
                className="w-full gap-2"
                disabled={isPending || !form.price || !form.effectiveFrom}
                onClick={handleSubmit}
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