"use client";
"use no memo";

import { useRef, useState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { ImagePlus, Loader2, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteVehicleMedia, uploadVehicleMedia } from "@/app/(staff)/vehicles/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { VehicleMediaKind } from "@/lib/vehicles/media-kinds";

const PUBLIC_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/showroom-media`;

const UPLOADED_MESSAGE: Record<VehicleMediaKind, string> = {
  photo: "Photo uploaded.",
  "360_view": "360° frame uploaded.",
  interior: "Interior photo uploaded.",
};
const BADGE_LABEL: Record<VehicleMediaKind, string> = { photo: "Photo", "360_view": "360°", interior: "Interior" };

// S4: a fixed, free shot list so every listing shows the same interior views.
const INTERIOR_SHOTS = ["Dashboard", "Front seats", "Rear seats", "Odometer", "Trunk", "Roof lining"];

export interface StaffMediaRow {
  id: string;
  media_kind: VehicleMediaKind;
  storage_path: string;
  display_order: number;
}

export function VehicleMediaManager({
  vehicleId,
  media,
}: {
  readonly vehicleId: string;
  readonly media: StaffMediaRow[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<VehicleMediaKind>("photo");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("vehicle_id", vehicleId);
    fd.set("media_kind", kind);
    fd.set("file", file);
    const result = await uploadVehicleMedia(fd);
    setUploading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(UPLOADED_MESSAGE[kind]);
    setFile(null);
    // Clear the picker so choosing the same file again still fires onChange.
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteVehicleMedia(id);
    setDeletingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Media deleted.");
    router.refresh();
  }

  const spinFrames = media.filter((m) => m.media_kind === "360_view");
  const photos = media.filter((m) => m.media_kind === "photo");
  const interiors = media.filter((m) => m.media_kind === "interior");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <ImagePlus className="size-5 text-muted-foreground" />
            Vehicle Media
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field>
            <FieldLabel htmlFor="media-kind">Kind</FieldLabel>
            <Select value={kind} onValueChange={(v) => setKind(v as VehicleMediaKind)}>
              <SelectTrigger id="media-kind" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="360_view">360° Frame</SelectItem>
                  <SelectItem value="interior">Interior</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <input
            ref={fileInput}
            type="file"
            aria-label="Media file"
            accept="image/jpeg,image/png,image/webp"
            className="flex h-9 w-full max-w-60 text-sm file:mr-3 file:h-full file:cursor-pointer file:border-0 file:bg-muted file:px-3"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          Upload consecutive 360° frames in order: customers drag to rotate through them on the showroom. 3 or more
          frames enable the 360° viewer; photos appear in the gallery; interior photos get their own Interior tab.
        </p>

        {kind === "interior" ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Interior shot list</p>
            <ol className="mt-1.5 grid list-inside list-decimal gap-x-6 gap-y-0.5 text-muted-foreground sm:grid-cols-2">
              {INTERIOR_SHOTS.map((shot) => (
                <li key={shot}>{shot}</li>
              ))}
            </ol>
            <p className="mt-2 text-muted-foreground text-xs">
              Use a phone camera held in landscape. Panorama mode on the phone also works and costs nothing. Upload the
              shots in the order above.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {media.length === 0 ? (
            <p className="text-muted-foreground text-sm">No media uploaded yet.</p>
          ) : (
            media.map((m) => (
              <div key={m.id} className="relative aspect-[4/3] overflow-hidden rounded-lg border">
                <Image
                  src={`${PUBLIC_BUCKET_BASE}/${m.storage_path}`}
                  alt=""
                  unoptimized
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />
                <div className="absolute top-1 left-1">
                  <Badge variant={m.media_kind === "360_view" ? "default" : "secondary"} className="text-[10px]">
                    {m.media_kind === "360_view" ? <RotateCw className="size-3" /> : <ImagePlus className="size-3" />}
                    {`${BADGE_LABEL[m.media_kind]} #${m.display_order + 1}`}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${BADGE_LABEL[m.media_kind]} #${m.display_order + 1}`}
                  className="absolute top-1 right-1 size-7 bg-background/80 backdrop-blur"
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        <p className="text-muted-foreground text-xs">
          {spinFrames.length} 360° frame(s) · {photos.length} photo(s) · {interiors.length} interior photo(s). 360°
          frames must be uploaded in rotating order (front, side, back, other side, ...).
        </p>
      </CardContent>
    </Card>
  );
}
