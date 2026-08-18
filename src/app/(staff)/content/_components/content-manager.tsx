"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createContentItem,
  deleteContentItem,
  publishContent,
  updateContentItem,
} from "@/app/(staff)/vehicles/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface ContentManagerProps {
  items: Record<string, unknown>[];
  vehicles: Record<string, unknown>[];
  canManage: boolean;
}

const kindLabels: Record<string, string> = {
  hero: "Hero",
  promotion: "Promotion",
  featured_vehicle: "Featured Vehicle",
};

export function ContentManager({ items, vehicles, canManage }: ContentManagerProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("promotion");
  const [vehicleId, setVehicleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleSave() {
    if (!title) return;
    setLoading(true);
    const fd = new FormData();
    if (editingId) fd.set("id", editingId);
    fd.set("title", title);
    fd.set("content_kind", kind);
    if (body) fd.set("body", body);
    if (vehicleId && kind === "featured_vehicle") fd.set("vehicle_id", vehicleId);
    const result = editingId ? await updateContentItem(fd) : await createContentItem(fd);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(editingId ? "Content updated." : "Content created.");
      setTitle("");
      setBody("");
      setKind("promotion");
      setVehicleId("");
      setEditingId(null);
      router.refresh();
    }
  }

  function startEditing(item: Record<string, unknown>) {
    setEditingId(item.id as string);
    setTitle((item.title as string) ?? "");
    setBody((item.body as string) ?? "");
    setKind((item.content_kind as string) ?? "promotion");
    setVehicleId((item.vehicle_id as string) ?? "");
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this content item?")) return;
    setLoading(true);
    const result = await deleteContentItem(id);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Content deleted.");
    if (editingId === id) {
      setEditingId(null);
      setTitle("");
      setBody("");
      setVehicleId("");
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl leading-none tracking-tight">Content Management</h1>
        <p className="text-muted-foreground text-sm">Manage landing page content, promotions, and featured vehicles.</p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Content Item" : "New Content Item"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(kindLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {kind === "featured_vehicle" && (
                <Field>
                  <FieldLabel>Vehicle</FieldLabel>
                  <Select value={vehicleId} onValueChange={setVehicleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id as string} value={v.id as string}>
                            {v.make as string} {v.model as string} ({v.year as number})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field>
                <FieldLabel>Title</FieldLabel>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer Sale" />
              </Field>
            </div>
            <Field>
              <FieldLabel>Body</FieldLabel>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Content description..."
              />
            </Field>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading || !title}>
                {loading ? "Saving..." : editingId ? "Save Changes" : "Create"}
              </Button>
              {editingId ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setTitle("");
                    setBody("");
                    setKind("promotion");
                    setVehicleId("");
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Separator />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id as string} className="h-full shadow-xs">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="wrap-break-word text-base">{(item.title as string) ?? ""}</CardTitle>
                <CardDescription className="mt-1">
                  <Badge variant="outline">{kindLabels[item.content_kind as string] ?? item.content_kind}</Badge>
                </CardDescription>
              </div>
              <CardAction>
                <div className="flex items-center gap-1">
                  <Badge variant={(item.publication_state as string) === "published" ? "default" : "secondary"}>
                    {item.publication_state as string}
                  </Badge>
                  {canManage ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit content"
                        onClick={() => startEditing(item)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete content"
                        onClick={() => handleDelete(item.id as string)}
                        disabled={loading}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2">
              {item.body ? (
                <p className="wrap-break-word text-muted-foreground text-sm">{item.body as string}</p>
              ) : null}
              {canManage && item.publication_state !== "published" && (
                <Button
                  className="mt-auto"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const result = await publishContent(item.id as string);
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success("Published.");
                      router.refresh();
                    }
                  }}
                >
                  Publish
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
