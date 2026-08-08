"use client";
"use no memo";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { createRoadmapItem, updateRoadmapItem } from "@/app/(staff)/roadmap/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  ROADMAP_PRIORITIES,
  ROADMAP_QUARTERS,
  ROADMAP_STATUSES,
  type RoadmapItemFormData,
  roadmapItemSchema,
} from "@/lib/validation/roadmap";

import { ROADMAP_KIND_LABELS, ROADMAP_PRIORITY_LABELS, ROADMAP_STATUS_LABELS } from "./roadmap-config";
import { ROADMAP_TEAMS, type RoadmapItem } from "./roadmap-types";

interface RoadmapItemFormProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  items: RoadmapItem[];
  editingItem: RoadmapItem | null;
  variant?: "sheet" | "page";
}

const emptyValues: RoadmapItemFormData = {
  parent_id: "",
  kind: "initiative",
  title: "",
  description: "",
  status: "planned",
  priority: "medium",
  quarter: "",
  year: new Date().getFullYear(),
  team: "",
  start_date: "",
  end_date: "",
};

export function RoadmapItemForm({ open, onOpenChange, items, editingItem, variant = "sheet" }: RoadmapItemFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = editingItem !== null;

  const form = useForm<z.infer<typeof roadmapItemSchema>>({
    // biome-ignore lint/suspicious/noExplicitAny: zod coerce fields cause resolver type mismatch
    resolver: zodResolver(roadmapItemSchema) as any,
    defaultValues: emptyValues as never,
  });

  const watchedKind = form.watch("kind");

  useEffect(() => {
    if (variant === "sheet" && !open) return;
    if (editingItem) {
      form.reset({
        parent_id: editingItem.parent_id ?? "",
        kind: editingItem.kind,
        title: editingItem.title,
        description: editingItem.description ?? "",
        status: editingItem.status,
        priority: editingItem.priority,
        quarter: editingItem.quarter ?? "",
        year: editingItem.year ?? new Date().getFullYear(),
        team: editingItem.team ?? "",
        start_date: editingItem.start_date ?? "",
        end_date: editingItem.end_date ?? "",
      });
    } else {
      form.reset(emptyValues as never);
    }
  }, [open, editingItem, variant, form]);

  const parentOptions = items.filter(
    (item) =>
      (watchedKind === "epic" ? item.kind === "initiative" : item.kind === "epic") && item.id !== editingItem?.id,
  );

  async function onSubmit(data: z.infer<typeof roadmapItemSchema>) {
    setLoading(true);
    const fd = new FormData();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== "") {
        fd.set(key, String(value));
      }
    }
    if (isEdit && editingItem) {
      fd.set("id", editingItem.id);
    }

    const result = isEdit ? await updateRoadmapItem(fd) : await createRoadmapItem(fd);
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(isEdit ? "Roadmap item updated." : "Roadmap item created.");
      if (variant === "sheet" && onOpenChange) {
        onOpenChange(false);
      } else {
        router.push("/dashboard/roadmap");
      }
      router.refresh();
    }
  }

  const content = (
    <FieldGroup className="gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={form.control}
          name="kind"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Type</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(["initiative", "epic", "feature"] as const).map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {ROADMAP_KIND_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="status"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Status</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ROADMAP_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {ROADMAP_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      {watchedKind !== "initiative" ? (
        <Controller
          control={form.control}
          name="parent_id"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>{watchedKind === "epic" ? "Parent Initiative" : "Parent Epic"}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {parentOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      ) : null}

      <Controller
        control={form.control}
        name="title"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Title</FieldLabel>
            <Input {...field} placeholder="e.g. Digital Showroom" />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        control={form.control}
        name="description"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Description</FieldLabel>
            <Textarea {...field} rows={4} placeholder="Describe the item and its expected outcome..." />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={form.control}
          name="priority"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Priority</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ROADMAP_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {ROADMAP_PRIORITY_LABELS[priority]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="team"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Team</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ROADMAP_TEAMS.map((team) => (
                      <SelectItem key={team} value={team}>
                        {team}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={form.control}
          name="quarter"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Quarter</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ROADMAP_QUARTERS.map((quarter) => (
                      <SelectItem key={quarter} value={quarter}>
                        {quarter}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="year"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Year</FieldLabel>
              <Input {...field} type="number" />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={form.control}
          name="start_date"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Start Date</FieldLabel>
              <Input {...field} type="date" />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="end_date"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>End Date</FieldLabel>
              <Input {...field} type="date" />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>
    </FieldGroup>
  );

  if (variant === "page") {
    return (
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl leading-none tracking-tight">
              {isEdit ? "Edit Roadmap Item" : "Add Roadmap Item"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isEdit ? "Update the item details." : "Create a new initiative, epic, or feature."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update Item" : "Create Item"}
            </Button>
          </div>
        </div>
        <div className="rounded-lg border p-5">{content}</div>
      </form>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "Edit Roadmap Item" : "Add Roadmap Item"}</SheetTitle>
          <p className="text-muted-foreground text-sm">
            {isEdit ? "Update the item details." : "Create a new initiative, epic, or feature."}
          </p>
        </SheetHeader>

        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{content}</div>

          <SheetFooter className="border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update Item" : "Create Item"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
