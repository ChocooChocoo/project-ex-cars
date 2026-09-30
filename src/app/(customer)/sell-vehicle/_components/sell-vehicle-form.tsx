"use client";

import { useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, X } from "lucide-react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";

import { submitSellVehicle } from "@/app/(customer)/my-transactions/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPTED_ID_TYPES, ID_LABELS } from "@/lib/auth/roles";
import { SELL_MEETUP_METHOD_LABELS, SELL_MEETUP_METHODS } from "@/lib/transactions/sell-flow";
import { type SellVehicleFormData, sellVehicleSchema } from "@/lib/validation/transactions";

export interface ConditionChecklistNode {
  id: string;
  parent_id: string | null;
  level: "system" | "component" | "part";
  name: string;
}

export const SELL_PHOTO_MAX_COUNT = 6;
export const SELL_PHOTO_MAX_SIZE = 5 * 1024 * 1024;
export const SELL_PHOTO_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateSellPhotos(files: File[]): string | null {
  if (files.length === 0) return "At least one vehicle photo is required.";
  if (files.length > SELL_PHOTO_MAX_COUNT) return `You can upload at most ${SELL_PHOTO_MAX_COUNT} photos.`;
  for (const file of files) {
    if (!(SELL_PHOTO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      return "Photos must be JPEG, PNG, or WebP images.";
    }
    if (file.size > SELL_PHOTO_MAX_SIZE) return "Each photo must be 5MB or smaller.";
  }
  return null;
}

export const SELL_PAPER_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

const PAPER_FIELDS = [
  { key: "id_file_1", label: "Valid ID #1 *" },
  { key: "id_file_2", label: "Valid ID #2 *" },
  { key: "orcr_file", label: "ORCR *" },
  { key: "deed_of_sale_file", label: "Deed of Sale *" },
] as const;

export function SellVehicleForm({ checklistNodes = [] }: { readonly checklistNodes?: ConditionChecklistNode[] }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SellVehicleFormData>({
    resolver: zodResolver(sellVehicleSchema) as unknown as Resolver<SellVehicleFormData>,
  });

  const conditionValue = watch("condition");
  const hasKnownIssues = watch("has_known_issues");

  const [papers, setPapers] = useState<Record<string, File | null>>({});
  const [idTypes, setIdTypes] = useState<Record<string, string>>({});
  const [paperError, setPaperError] = useState<string | null>(null);
  const showDetail = typeof conditionValue === "string" && conditionValue.toLowerCase() === "other";

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [selectedConditionItems, setSelectedConditionItems] = useState<string[]>([]);
  const [checklistOpen, setChecklistOpen] = useState(false);

  const checklistTree = useMemo(() => {
    const systems = checklistNodes.filter((n) => n.level === "system");
    const childrenOf = (parentId: string) => checklistNodes.filter((n) => n.parent_id === parentId);
    return systems.map((system) => ({
      system,
      components: childrenOf(system.id).map((component) => ({
        component,
        parts: childrenOf(component.id),
      })),
    }));
  }, [checklistNodes]);

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    const combined = [...photos, ...picked];
    const overLimit = combined.length > SELL_PHOTO_MAX_COUNT;
    const next = combined.slice(0, SELL_PHOTO_MAX_COUNT);
    const error = overLimit ? `You can upload at most ${SELL_PHOTO_MAX_COUNT} photos.` : validateSellPhotos(next);
    setPhotoError(error);
    if (overLimit) toast.error(error);
    setPhotos(next);
    for (const url of previews) URL.revokeObjectURL(url);
    setPreviews(next.map((file) => URL.createObjectURL(file)));
    event.target.value = "";
  }

  function removePhoto(index: number) {
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    setPhotoError(next.length === 0 ? "At least one vehicle photo is required." : null);
    const removedUrl = previews[index];
    if (removedUrl) URL.revokeObjectURL(removedUrl);
    setPreviews(previews.filter((_, i) => i !== index));
  }

  function toggleConditionItem(nodeId: string, checked: boolean) {
    setSelectedConditionItems((prev) =>
      checked ? (prev.includes(nodeId) ? prev : [...prev, nodeId]) : prev.filter((id) => id !== nodeId),
    );
  }

  async function onSubmit(data: SellVehicleFormData) {
    const photoValidationError = validateSellPhotos(photos);
    if (photoValidationError) {
      setPhotoError(photoValidationError);
      toast.error(photoValidationError);
      return;
    }
    const missingPaper = PAPER_FIELDS.find((field) => !papers[field.key]);
    if (missingPaper || !idTypes.id_type_1 || !idTypes.id_type_2) {
      const message = "Attach two valid IDs with their ID types, the ORCR and the deed of sale.";
      setPaperError(message);
      toast.error(message);
      return;
    }
    let finalCondition = data.condition;
    const detail = data.condition_detail;
    if (typeof finalCondition === "string" && finalCondition.toLowerCase() === "other" && detail?.trim()) {
      finalCondition = detail.trim();
    }
    const fd = new FormData();
    fd.set("make", data.make);
    fd.set("model", data.model);
    fd.set("year", String(data.year));
    fd.set("mileage", String(data.mileage));
    fd.set("condition", finalCondition);
    fd.set("offered_amount", String(data.offered_amount));
    if (data.description) fd.set("description", data.description);
    fd.set("has_known_issues", data.has_known_issues);
    if (data.declared_issues) fd.set("declared_issues", data.declared_issues);
    fd.set("meetup_method", data.meetup_method);
    for (const field of PAPER_FIELDS) fd.set(field.key, papers[field.key] as File);
    fd.set("id_type_1", idTypes.id_type_1);
    fd.set("id_type_2", idTypes.id_type_2);
    if (detail?.trim() && finalCondition !== detail.trim()) {
      fd.set("condition_detail", detail.trim());
    }
    for (const photo of photos) fd.append("photos", photo);
    if (selectedConditionItems.length > 0) fd.set("condition_items", JSON.stringify(selectedConditionItems));

    const result = await submitSellVehicle(fd);
    if (result.error) {
      toast.error(result.error);
    } else if (result.id) {
      toast.success("Vehicle submitted for evaluation!");
      router.push(`/my-transactions/${result.id}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.make}>
              <FieldLabel htmlFor="sell-make">Make *</FieldLabel>
              <Input id="sell-make" {...register("make")} placeholder="e.g. Honda" />
              {errors.make && <FieldError errors={[{ message: errors.make.message }]} />}
            </Field>
            <Field data-invalid={!!errors.model}>
              <FieldLabel htmlFor="sell-model">Model *</FieldLabel>
              <Input id="sell-model" {...register("model")} placeholder="e.g. Civic" />
              {errors.model && <FieldError errors={[{ message: errors.model.message }]} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.year}>
              <FieldLabel htmlFor="sell-year">Year *</FieldLabel>
              <Input id="sell-year" {...register("year")} type="number" placeholder="2020" />
              {errors.year && <FieldError errors={[{ message: errors.year.message }]} />}
            </Field>
            <Field data-invalid={!!errors.mileage}>
              <FieldLabel htmlFor="sell-mileage">Mileage (km) *</FieldLabel>
              <Input id="sell-mileage" {...register("mileage")} type="number" placeholder="50000" />
              {errors.mileage && <FieldError errors={[{ message: errors.mileage.message }]} />}
            </Field>
          </div>
          <Field data-invalid={!!errors.condition}>
            <FieldLabel htmlFor="sell-condition">Condition *</FieldLabel>
            <Controller
              control={control}
              name="condition"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="sell-condition">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="needs_repair">Needs Repair</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.condition && <FieldError errors={[{ message: errors.condition.message }]} />}
          </Field>
          {showDetail ? (
            <Field data-invalid={!!errors.condition_detail}>
              <FieldLabel htmlFor="sell-condition-detail">Condition Detail</FieldLabel>
              <Textarea
                id="sell-condition-detail"
                {...register("condition_detail")}
                placeholder="Describe the condition..."
                rows={3}
              />
              {errors.condition_detail && <FieldError errors={[{ message: errors.condition_detail.message }]} />}
            </Field>
          ) : null}
          <Field data-invalid={!!errors.offered_amount}>
            <FieldLabel htmlFor="sell-offered-amount">Offered Amount (₱) *</FieldLabel>
            <Input
              id="sell-offered-amount"
              {...register("offered_amount")}
              type="number"
              min="0"
              placeholder="Your asking price"
            />
            {errors.offered_amount && <FieldError errors={[{ message: errors.offered_amount.message }]} />}
          </Field>
          <Field>
            <FieldLabel htmlFor="sell-description">Description</FieldLabel>
            <Textarea
              id="sell-description"
              {...register("description")}
              placeholder="Any additional details about the vehicle..."
              rows={3}
            />
          </Field>
          <Field data-invalid={!!errors.has_known_issues}>
            <FieldLabel>Existing vehicle issues *</FieldLabel>
            <Controller
              control={control}
              name="has_known_issues"
              render={({ field }) => (
                <RadioGroup
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  aria-label="Existing vehicle issues"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <RadioGroupItem id="sell-issues-yes" value="yes" />
                    <label htmlFor="sell-issues-yes">The vehicle has known issues</label>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <RadioGroupItem id="sell-issues-no" value="no" />
                    <label htmlFor="sell-issues-no">There is no known issue</label>
                  </div>
                </RadioGroup>
              )}
            />
            {errors.has_known_issues && <FieldError errors={[{ message: errors.has_known_issues.message }]} />}
          </Field>
          {hasKnownIssues === "yes" ? (
            <Field data-invalid={!!errors.declared_issues}>
              <FieldLabel htmlFor="sell-declared-issues">Describe the issues *</FieldLabel>
              <Textarea
                id="sell-declared-issues"
                {...register("declared_issues")}
                placeholder="e.g. Aircon not cooling, dent on rear bumper"
                rows={3}
              />
              {errors.declared_issues && <FieldError errors={[{ message: errors.declared_issues.message }]} />}
            </Field>
          ) : null}
          <Field data-invalid={!!errors.meetup_method}>
            <FieldLabel htmlFor="sell-meetup-method">Meet-up method *</FieldLabel>
            <Controller
              control={control}
              name="meetup_method"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="sell-meetup-method">
                    <SelectValue placeholder="Select meet-up method" />
                  </SelectTrigger>
                  <SelectContent>
                    {SELL_MEETUP_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {SELL_MEETUP_METHOD_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.meetup_method && <FieldError errors={[{ message: errors.meetup_method.message }]} />}
          </Field>
          <Field data-invalid={!!paperError}>
            <FieldLabel>Required papers (JPEG/PNG/WebP/PDF, max 5MB each)</FieldLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {PAPER_FIELDS.map((paper, index) => (
                <div key={paper.key} className="flex flex-col gap-1.5">
                  <label htmlFor={`sell-${paper.key}`} className="text-sm">
                    {paper.label}
                  </label>
                  <Input
                    id={`sell-${paper.key}`}
                    type="file"
                    accept={SELL_PAPER_ACCEPT}
                    onChange={(event) => {
                      setPapers((prev) => ({ ...prev, [paper.key]: event.target.files?.[0] ?? null }));
                      setPaperError(null);
                    }}
                  />
                  {index < 2 ? (
                    <Select
                      value={idTypes[`id_type_${index + 1}`] ?? ""}
                      onValueChange={(value) => setIdTypes((prev) => ({ ...prev, [`id_type_${index + 1}`]: value }))}
                    >
                      <SelectTrigger aria-label={`ID type #${index + 1}`}>
                        <SelectValue placeholder="ID type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCEPTED_ID_TYPES.map((idType) => (
                          <SelectItem key={idType} value={idType}>
                            {ID_LABELS[idType]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              ))}
            </div>
            {paperError && <FieldError errors={[{ message: paperError }]} />}
          </Field>
          <Field data-invalid={!!photoError}>
            <FieldLabel htmlFor="sell-photos">Vehicle Photos * (1–6 photos, JPEG/PNG/WebP, max 5MB each)</FieldLabel>
            <Input
              ref={photoInputRef}
              id="sell-photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handlePhotoChange}
              aria-label="Vehicle photos"
            />
            {photoError && <FieldError errors={[{ message: photoError }]} />}
            {previews.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {previews.map((url, index) => (
                  <div key={url} className="relative overflow-hidden rounded-md border">
                    {/* biome-ignore lint/performance/noImgElement: local object-URL preview, next/image cannot load blob URLs */}
                    <img src={url} alt="" className="h-24 w-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 size-6 p-0"
                      onClick={() => removePhoto(index)}
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </Field>
          {checklistTree.length > 0 ? (
            <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="justify-between">
                  Known issues checklist (optional)
                  <ChevronDown className="size-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <p className="text-muted-foreground text-xs">
                  Tick any parts with known damage or issues. This is optional and helps our mechanics prioritize the
                  inspection.
                  {selectedConditionItems.length > 0 ? ` ${selectedConditionItems.length} selected.` : ""}
                </p>
                <div className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto">
                  {checklistTree.map(({ system, components }) => (
                    <div key={system.id} className="flex flex-col gap-1.5 rounded-md border p-2.5">
                      <span className="font-medium text-sm">{system.name}</span>
                      {components.map(({ component, parts }) => (
                        <div key={component.id} className="ml-3 flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <Checkbox
                              id={`condition-${component.id}`}
                              checked={selectedConditionItems.includes(component.id)}
                              onCheckedChange={(checked) => toggleConditionItem(component.id, checked === true)}
                            />
                            <label htmlFor={`condition-${component.id}`}>{component.name}</label>
                          </div>
                          {parts.map((part) => (
                            <div key={part.id} className="ml-6 flex items-center gap-2 text-sm">
                              <Checkbox
                                id={`condition-${part.id}`}
                                checked={selectedConditionItems.includes(part.id)}
                                onCheckedChange={(checked) => toggleConditionItem(part.id, checked === true)}
                              />
                              <label htmlFor={`condition-${part.id}`}>{part.name}</label>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Vehicle"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
