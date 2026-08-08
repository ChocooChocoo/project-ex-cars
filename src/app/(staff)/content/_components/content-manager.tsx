"use client";
"use no memo";

import { useState } from "react";

import { toast } from "sonner";

import { createContentItem, publishContent } from "@/app/(staff)/vehicles/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface ContentManagerProps {
  items: Record<string, unknown>[];
  vehicles: Record<string, unknown>[];
}

const kindLabels: Record<string, string> = {
  hero: "Hero",
  promotion: "Promotion",
  featured_vehicle: "Featured Vehicle",
};

export function ContentManager({ items, vehicles }: ContentManagerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("promotion");
  const [vehicleId, setVehicleId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!title) return;
    setLoading(true);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("content_kind", kind);
    if (body) fd.set("body", body);
    if (vehicleId && kind === "featured_vehicle") fd.set("vehicle_id", vehicleId);
    const result = await createContentItem(fd);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Content created.");
      setTitle("");
      setBody("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl leading-none tracking-tight">Content Management</h1>
        <p className="text-muted-foreground text-sm">Manage landing page content, promotions, and featured vehicles.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Content Item</CardTitle>
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
          <div>
            <Button onClick={handleCreate} disabled={loading || !title}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id as string}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{(item.title as string) ?? ""}</CardTitle>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline">{kindLabels[item.content_kind as string] ?? item.content_kind}</Badge>
                  <Badge variant={(item.publication_state as string) === "published" ? "default" : "secondary"}>
                    {item.publication_state as string}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            {(item.body || item.publication_state !== "published") && (
              <CardContent className="flex flex-col gap-2">
                {item.body ? <p className="text-muted-foreground text-sm">{item.body as string}</p> : null}
                {item.publication_state !== "published" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const result = await publishContent(item.id as string);
                      if (result.error) toast.error(result.error);
                      else toast.success("Published.");
                    }}
                  >
                    Publish
                  </Button>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
