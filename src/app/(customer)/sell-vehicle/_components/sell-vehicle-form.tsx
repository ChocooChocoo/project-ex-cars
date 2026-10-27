"use client";

import { useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { Controller, type Resolver, useController, useForm } from "react-hook-form";
import { toast } from "sonner";

import { prepareSellUploads, submitSellVehicle } from "@/app/(customer)/my-transactions/actions";
import { BrandModelCombobox } from "@/components/brand-model-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPTED_ID_TYPES, ID_LABELS } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { SELL_MEETUP_METHOD_LABELS, SELL_MEETUP_METHODS } from "@/lib/transactions/sell-flow";
import { type SellVehicleFormData, sellVehicleSchema } from "@/lib/validation/transactions";
import { listedYears, OWNER_NUMBERS, SELL_CONDITIONS } from "@/lib/vehicles/catalog";

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

/** Issue photos are optional; when given they follow the vehicle photo rules. */
export function validateIssuePhotos(files: File[]): string | null {
  return files.length === 0 ? null : validateSellPhotos(files);
}

/** C12: the ticked checklist names, plus the "Others" text, as the declared issues sentence. */
export function composeDeclaredIssues(tickedNames: string[], othersText: string | null): string {
  const others = othersText?.trim();
  return [...tickedNames, ...(others ? [`Others: ${others}`] : [])].join("; ");
}

const YEARS = listedYears();

export const SELL_PAPER_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

const PAPER_FIELDS = [
  { key: "id_file_1", label: "Valid ID #1 *", kind: "valid_id", pathKey: "id_path_1" },
  { key: "id_file_2", label: "Valid ID #2 *", kind: "valid_id", pathKey: "id_path_2" },
  { key: "orcr_file", label: "ORCR *", kind: "orcr", pathKey: "orcr_path" },
  { key: "deed_of_sale_file", label: "Deed of Sale *", kind: "deed_of_sale", pathKey: "deed_of_sale_path" },
] as const;

export function SellVehicleForm({ checklistNodes = [] }: { readonly checklistNodes?: ConditionChecklistNode[] }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<SellVehicleFormData>({
    resolver: zodResolver(sellVehicleSchema) as unknown as Resolver<SellVehicleFormData>,
    defaultValues: { make: "", model: "" },
  });

  const hasKnownIssues = watch("has_known_issues");
  const { field: makeField } = useController({ control, name: "make" });
  const { field: modelField } = useController({ control, name: "model" });

  const [papers, setPapers] = useState<Record<string, File | null>>({});
  const [idTypes, setIdTypes] = useState<Record<string, string>>({});
  const [paperError, setPaperError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [selectedConditionItems, setSelectedConditionItems] = useState<string[]>([]);
  const [othersChecked, setOthersChecked] = useState(false);
  const [othersText, setOthersText] = useState("");
  const [othersError, setOthersError] = useState<string | null>(null);
  const [issuePhotos, setIssuePhotos] = useState<File[]>([]);
  const [issuePhotoError, setIssuePhotoError] = useState<string | null>(null);
  const nameById = useMemo(() => new Map(checklistNodes.map((node) => [node.id, node.name])), [checklistNodes]);

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

  // The declared issues text follows the ticks, so the schema checks one field.
  function syncDeclaredIssues(items: string[], others: boolean, text: string) {
    const names = items.map((id) => nameById.get(id) ?? id);
    setValue("declared_issues", composeDeclaredIssues(names, others ? text : null), {
      shouldValidate: isSubmitted,
    });
  }

  function toggleConditionItem(nodeId: string, checked: boolean) {
    const without = selectedConditionItems.filter((id) => id !== nodeId);
    const next = checked ? [...without, nodeId] : without;
    setSelectedConditionItems(next);
    syncDeclaredIssues(next, othersChecked, othersText);
  }

  function handleIssuePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...issuePhotos, ...Array.from(event.target.files ?? [])];
    const next = picked.slice(0, SELL_PHOTO_MAX_COUNT);
    setIssuePhotos(next);
    setIssuePhotoError(
      picked.length > SELL_PHOTO_MAX_COUNT
        ? `You can add at most ${SELL_PHOTO_MAX_COUNT} issue photos.`
        : validateIssuePhotos(next),
    );
    event.target.value = "";
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
    const hasIssues = data.has_known_issues === "yes";
    if (hasIssues && othersChecked && !othersText.trim()) {
      setOthersError("Describe the other issues.");
      return;
    }
    const issuePhotoValidationError = hasIssues ? validateIssuePhotos(issuePhotos) : null;
    if (issuePhotoValidationError) {
      setIssuePhotoError(issuePhotoValidationError);
      toast.error(issuePhotoValidationError);
      return;
    }
    const fd = new FormData();
    fd.set("make", data.make);
    fd.set("model", data.model);
    fd.set("year", String(data.year));
    fd.set("mileage", String(data.mileage));
    fd.set("condition", data.condition);
    fd.set("owner_number", String(data.owner_number));
    fd.set("offered_amount", String(data.offered_amount));
    if (data.description) fd.set("description", data.description);
    fd.set("has_known_issues", data.has_known_issues);
    if (hasIssues && data.declared_issues) fd.set("declared_issues", data.declared_issues);
    fd.set("meetup_method", data.meetup_method);
    fd.set("id_type_1", idTypes.id_type_1);
    fd.set("id_type_2", idTypes.id_type_2);
    if (hasIssues && selectedConditionItems.length > 0) {
      fd.set("condition_items", JSON.stringify(selectedConditionItems));
    }

    // The files go straight to storage: a Vercel function rejects request bodies over 4.5 MB.
    const files = [
      ...photos.map((file) => ({ file, kind: "sell_photo" as const, pathKey: "photo_paths" })),
      ...PAPER_FIELDS.map((field) => ({ file: papers[field.key] as File, kind: field.kind, pathKey: field.pathKey })),
      ...(hasIssues ? issuePhotos : []).map((file) => ({
        file,
        kind: "issue_photo" as const,
        pathKey: "issue_photo_paths",
      })),
    ];
    try {
      const prepared = await prepareSellUploads(
        files.map(({ file, kind }) => ({ kind, type: file.type, size: file.size })),
      );
      if ("error" in prepared) {
        toast.error(prepared.error);
        return;
      }
      const bucket = createClient().storage.from("transaction-documents");
      for (const [index, { file, pathKey }] of files.entries()) {
        const { path, token } = prepared.uploads[index];
        const { error: uploadError } = await bucket.uploadToSignedUrl(path, token, file);
        if (uploadError) {
          toast.error(`${uploadError.message} Your sell request was not created — please try again.`);
          return;
        }
        fd.append(pathKey, path);
      }
      fd.set("transaction_id", prepared.transactionId);

      const result = await submitSellVehicle(fd);
      if (result.error) {
        toast.error(result.error);
      } else if (result.id) {
        toast.success("Vehicle submitted for evaluation!");
        router.push(`/my-transactions/${result.id}`);
      }
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <BrandModelCombobox
            idPrefix="sell"
            brand={makeField.value ?? ""}
            model={modelField.value ?? ""}
            onBrandChange={makeField.onChange}
            onModelChange={modelField.onChange}
            brandError={errors.make?.message}
            modelError={errors.model?.message}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.year}>
              <FieldLabel htmlFor="sell-year">Year *</FieldLabel>
              <Controller
                control={control}
                name="year"
                render={({ field }) => (
                  <Select value={field.value ? String(field.value) : ""} onValueChange={field.onChange}>
                    <SelectTrigger id="sell-year" className="w-full" aria-invalid={!!errors.year}>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {YEARS.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.year && <FieldError errors={[{ message: errors.year.message }]} />}
            </Field>
            <Field data-invalid={!!errors.mileage}>
              <FieldLabel htmlFor="sell-mileage">Mileage (km) *</FieldLabel>
              <Input id="sell-mileage" {...register("mileage")} type="number" inputMode="numeric" placeholder="50000" />
              {errors.mileage && <FieldError errors={[{ message: errors.mileage.message }]} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.condition}>
              <FieldLabel htmlFor="sell-condition">Condition *</FieldLabel>
              <Controller
                control={control}
                name="condition"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="sell-condition" className="w-full" aria-invalid={!!errors.condition}>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      {SELL_CONDITIONS.map((condition) => (
                        <SelectItem key={condition} value={condition}>
                          {condition}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.condition && <FieldError errors={[{ message: errors.condition.message }]} />}
            </Field>
            <Field data-invalid={!!errors.owner_number}>
              <FieldLabel htmlFor="sell-owner-number">Owner number *</FieldLabel>
              <Controller
                control={control}
                name="owner_number"
                render={({ field }) => (
                  <Select value={field.value ? String(field.value) : ""} onValueChange={field.onChange}>
                    <SelectTrigger id="sell-owner-number" className="w-full" aria-invalid={!!errors.owner_number}>
                      <SelectValue placeholder="Which owner are you?" />
                    </SelectTrigger>
                    <SelectContent>
                      {OWNER_NUMBERS.map((owner) => (
                        <SelectItem key={owner.value} value={owner.value}>
                          {owner.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.owner_number && <FieldError errors={[{ message: errors.owner_number.message }]} />}
            </Field>
          </div>
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
            <fieldset className="flex flex-col gap-3 rounded-md border p-3" aria-describedby="sell-issues-help">
              <legend className="px-1 font-medium text-sm">Which parts have issues? *</legend>
              <p id="sell-issues-help" className="text-muted-foreground text-xs">
                Tick every part with damage or a known problem. This helps our mechanic plan the inspection.
                {selectedConditionItems.length > 0 ? ` ${selectedConditionItems.length} ticked.` : ""}
              </p>
              {checklistTree.length > 0 ? (
                <div className="flex max-h-80 flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
                  {checklistTree.map(({ system, components }) => (
                    <div key={system.id} className="flex flex-col gap-1.5 rounded-md border bg-muted/20 p-2.5">
                      <span className="font-medium text-sm">{system.name}</span>
                      {components.map(({ component, parts }) => (
                        <div key={component.id} className="ml-1 flex flex-col gap-1.5 sm:ml-3">
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
              ) : null}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="sell-issues-others"
                    checked={othersChecked}
                    onCheckedChange={(checked) => {
                      const on = checked === true;
                      setOthersChecked(on);
                      setOthersError(null);
                      syncDeclaredIssues(selectedConditionItems, on, othersText);
                    }}
                  />
                  <label htmlFor="sell-issues-others">Others</label>
                </div>
                {othersChecked ? (
                  <Field data-invalid={!!othersError}>
                    <FieldLabel htmlFor="sell-issues-others-text">Describe the other issues *</FieldLabel>
                    <Textarea
                      id="sell-issues-others-text"
                      value={othersText}
                      onChange={(event) => {
                        setOthersText(event.target.value);
                        setOthersError(null);
                        syncDeclaredIssues(selectedConditionItems, true, event.target.value);
                      }}
                      placeholder="e.g. Aircon not cooling, dent on rear bumper"
                      rows={3}
                      aria-invalid={!!othersError}
                    />
                    {othersError && <FieldError errors={[{ message: othersError }]} />}
                  </Field>
                ) : null}
              </div>
              {errors.declared_issues && <FieldError errors={[{ message: errors.declared_issues.message }]} />}
              <Field data-invalid={!!issuePhotoError}>
                <FieldLabel htmlFor="sell-issue-photos">Photos of the issues (optional, up to 6)</FieldLabel>
                <Input
                  id="sell-issue-photos"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleIssuePhotoChange}
                />
                <FieldDescription>JPEG, PNG or WebP, max 5MB each.</FieldDescription>
                {issuePhotoError && <FieldError errors={[{ message: issuePhotoError }]} />}
                {issuePhotos.length > 0 ? (
                  <ul className="flex flex-wrap gap-2" aria-label="Issue photos to upload">
                    {issuePhotos.map((file, index) => (
                      <li
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex max-w-full items-center gap-1 rounded-md border bg-muted/30 py-1 pr-1 pl-2 text-xs"
                      >
                        <span className="max-w-48 truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => {
                            const next = issuePhotos.filter((_, i) => i !== index);
                            setIssuePhotos(next);
                            setIssuePhotoError(validateIssuePhotos(next));
                          }}
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="size-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Field>
            </fieldset>
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
