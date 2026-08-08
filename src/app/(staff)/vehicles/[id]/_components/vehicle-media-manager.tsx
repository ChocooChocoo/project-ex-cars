"use client";
"use no memo";

import { useState } from "react";

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

const PUBLIC_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/showroom-media`;

export interface StaffMediaRow {
  id: string;
  media_kind: "photo" | "360_view";
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
  const [kind, setKind] = useState<"photo" | "360_view">("photo");
  const [file, setFile] = useState<File | null>(null);
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
    toast.success(kind === "360_view" ? "360° frame uploaded." : "Photo uploaded.");
    setFile(null);
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
            <FieldLabel>Kind</FieldLabel>
            <Select value={kind} onValueChange={(v) => setKind(v as "photo" | "360_view")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="360_view">360° Frame</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <input
            type="file"
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
          Upload consecutive 360° frames in order — customers drag to rotate through them on the showroom. 3 or more
          frames enable the 360° viewer; photos appear in the gallery.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {media.length === 0 ? (
            <p className="text-muted-foreground text-sm">No media uploaded yet.</p>
          ) : (
            media.map((m) => (
              <div key={m.id} className="relative overflow-hidden rounded-lg border">
                <Image
                  src={`${PUBLIC_BUCKET_BASE}/${m.storage_path}`}
                  alt=""
                  unoptimized
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="absolute top-1 left-1">
                  <Badge variant={m.media_kind === "360_view" ? "default" : "secondary"} className="text-[10px]">
                    {m.media_kind === "360_view" ? <RotateCw className="size-3" /> : <ImagePlus className="size-3" />}
                    {m.media_kind === "360_view" ? `360° #${m.display_order + 1}` : `Photo #${m.display_order + 1}`}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
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
          {spinFrames.length} 360° frame(s) · {photos.length} photo(s). 360° frames must be uploaded in rotating order
          (front, side, back, other side, ...).
        </p>
      </CardContent>
    </Card>
  );
}
