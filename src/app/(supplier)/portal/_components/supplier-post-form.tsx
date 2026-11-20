"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SupplierPost } from "@/lib/suppliers/supplier-posts";
import { OLDEST_LISTED_YEAR } from "@/lib/vehicles/catalog";

const MAX_PHOTOS = 8;

/** The details of a supplier post; photos only when creating (an edit changes the details). */
export function SupplierPostForm({
  initial,
  withPhotos = false,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  readonly initial?: SupplierPost;
  readonly withPhotos?: boolean;
  readonly submitLabel: string;
  /** Resolves true when saved, so the form can clear itself. */
  readonly onSubmit: (formData: FormData) => Promise<boolean>;
  readonly onCancel?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [formKey, setFormKey] = useState(0);
  const maxYear = new Date().getFullYear() + 1;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.delete("photos");
    for (const photo of photos) formData.append("photos", photo);
    setBusy(true);
    const saved = await onSubmit(formData);
    setBusy(false);
    if (saved && !initial) {
      setPhotos([]);
      setFormKey((key) => key + 1);
    }
  }

  const id = (name: string) => `supplier-${initial?.id ?? "new"}-${name}`;
  return (
    <form key={formKey} onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("make")}>Make *</Label>
          <Input id={id("make")} name="make" required maxLength={80} defaultValue={initial?.make} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("model")}>Model *</Label>
          <Input id={id("model")} name="model" required maxLength={80} defaultValue={initial?.model} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("year")}>Year *</Label>
          <Input
            id={id("year")}
            name="year"
            type="number"
            required
            min={OLDEST_LISTED_YEAR}
            max={maxYear}
            defaultValue={initial?.year}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("mileage")}>Mileage (km) *</Label>
          <Input id={id("mileage")} name="mileage" type="number" required min={0} defaultValue={initial?.mileage} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("price")}>Asking price (₱) *</Label>
          <Input
            id={id("price")}
            name="asking_price"
            type="number"
            required
            min={1}
            defaultValue={initial?.asking_price}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("description")}>Details</Label>
        <Textarea
          id={id("description")}
          name="description"
          maxLength={2000}
          rows={3}
          placeholder="Condition, service history, known issues"
          defaultValue={initial?.description ?? ""}
        />
      </div>
      {withPhotos ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("photos")}>Photos * (up to {MAX_PHOTOS}, JPEG/PNG/WebP)</Label>
          <Input
            id={id("photos")}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || (withPhotos && photos.length === 0)}>
          {busy ? "Saving..." : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
