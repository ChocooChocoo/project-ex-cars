"use client";

import { useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { Controller, type Resolver, useController, useForm } from "react-hook-form";
import { toast } from "sonner";

import { prepareSellUploads, submitSellVehicle } from "@/app/(customer)/my-transactions/actions";
import { BrandModelCombobox } from "@/components/brand-model-combobox";
import { GceLocationMap, MeetupMap } from "@/components/maps/lazy-maps";
import { MeetupAddressFields } from "@/components/maps/meetup-address-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/api/storage-client";
import { ACCEPTED_ID_TYPES, ID_LABELS } from "@/lib/auth/roles";
import { composeMeetupAddress, emptyMeetupAddress, type MeetupAddressParts } from "@/lib/transactions/meetup-area";
import { SELL_MEETUP_METHOD_LABELS, SELL_MEETUP_METHODS } from "@/lib/transactions/sell-flow";
import { compressImage, MAX_UPLOAD_BYTES } from "@/lib/uploads/compress-image";
import { type SellVehicleFormData, sellVehicleSchema } from "@/lib/validation/transactions";
import {
  OLDEST_LISTED_YEAR,
  OWNER_NUMBERS,
  SELL_CONDITIONS,
  SELL_PAPER_FIELDS,
  SELL_PAPER_STATUS_LABELS,
} from "@/lib/vehicles/catalog";

export interface ConditionChecklistNode {
  id: string;
  parent_id: string | null;
  level: "system" | "component" | "part";
  name: string;
}

export const SELL_PHOTO_MAX_COUNT = 6;
export const SELL_PHOTO_MAX_SIZE = MAX_UPLOAD_BYTES;
export const SELL_PHOTO_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateSellPhotos(files: File[]): string | null {
  if (files.length === 0) return "At least one vehicle photo is required.";
  if (files.length > SELL_PHOTO_MAX_COUNT) return `You can upload at most ${SELL_PHOTO_MAX_COUNT} photos.`;
  for (const file of files) {
    if (!(SELL_PHOTO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      return "Photos must be JPEG, PNG, or WebP images.";
    }
    if (file.size > SELL_PHOTO_MAX_SIZE) return "Each photo must be 2 MB or smaller.";
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

const LATEST_YEAR = new Date().getFullYear() + 1;

// T12: the year is typed, so keys that make a negative, decimal or exponent number are blocked.
const BLOCKED_YEAR_KEYS = new Set(["-", "+", ".", ",", "e", "E"]);

export const SELL_PAPER_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

// SN-13: the three papers are declared, not photographed. The seller keeps the originals and brings them to the
// meet-up, so the form asks one question per paper.
export const SELL_PAPERS_NOTICE =
  "GCE respects the privacy of your vehicle papers. Answer this checklist now and bring the originals to the meet-up.";

export const SELL_PAPERS_MESSAGE = "Answer the papers checklist for the OR, the CR and the deed of sale.";

// T10: each valid ID is sent front and back, like the buyer's.
const ID_FIELDS = [1, 2].flatMap((n) =>
  (["front", "back"] as const).map((side) => ({
    key: `id_${side}_${n}`,
    n,
    side,
    label: side === "front" ? "Front" : "Back",
    kind: "valid_id" as const,
    pathKey: `id_${side}_path_${n}`,
  })),
);
const PAPER_FIELDS = ID_FIELDS;
const PAPERS_MESSAGE = "Attach both valid IDs (front and back) with their ID types.";

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
  const meetupMethod = watch("meetup_method");
  const meetupLat = watch("meetup_lat");
  const meetupLng = watch("meetup_lng");
  const condition = watch("condition");
  const { field: makeField } = useController({ control, name: "make" });
  const { field: modelField } = useController({ control, name: "model" });

  const [papers, setPapers] = useState<Record<string, File | null>>({});
  const [idTypes, setIdTypes] = useState<Record<string, string>>({});
  const [paperError, setPaperError] = useState<string | null>(null);
  const [idFilesError, setIdFilesError] = useState<string | null>(null);
  // SN-13: the seller's answers about the OR, the CR and the deed of sale, keyed by document kind.
  const [papersChecklist, setPapersChecklist] = useState<Record<string, string>>({});

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
  // BH-8: Region / Province / City / Barangay come from the pin; the block and lot are typed.
  const [meetupAddress, setMeetupAddress] = useState<MeetupAddressParts>(emptyMeetupAddress());
  // The suggested midpoint the pin must stay near; sent so Laravel enforces the same radius.
  const [meetupOrigin, setMeetupOrigin] = useState<{ lat: number; lng: number } | null>(null);
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

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    const picked = await Promise.all(chosen.map(compressImage));
    const combined = [...photos, ...picked];
    const overLimit = combined.length > SELL_PHOTO_MAX_COUNT;
    const next = combined.slice(0, SELL_PHOTO_MAX_COUNT);
    const error = overLimit ? `You can upload at most ${SELL_PHOTO_MAX_COUNT} photos.` : validateSellPhotos(next);
    setPhotoError(error);
    if (overLimit) toast.error(error);
    setPhotos(next);
    for (const url of previews) URL.revokeObjectURL(url);
    setPreviews(next.map((file) => URL.createObjectURL(file)));
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

  async function handleIssuePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    const picked = [...issuePhotos, ...(await Promise.all(chosen.map(compressImage)))];
    const next = picked.slice(0, SELL_PHOTO_MAX_COUNT);
    setIssuePhotos(next);
    setIssuePhotoError(
      picked.length > SELL_PHOTO_MAX_COUNT
        ? `You can add at most ${SELL_PHOTO_MAX_COUNT} issue photos.`
        : validateIssuePhotos(next),
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
      setIdFilesError(PAPERS_MESSAGE);
      toast.error(PAPERS_MESSAGE);
      return;
    }
    // SN-13: every paper must be declared; the papers themselves are checked against the originals.
    if (SELL_PAPER_FIELDS.some((paper) => !papersChecklist[paper.key])) {
      setPaperError(SELL_PAPERS_MESSAGE);
      toast.error(SELL_PAPERS_MESSAGE);
      return;
    }
    if (idTypes.id_type_1 === idTypes.id_type_2) {
      setIdFilesError("Use two different valid IDs.");
      toast.error("Use two different valid IDs.");
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
    if (data.meetup_method === "meet_halfway" && data.meetup_lat != null && data.meetup_lng != null) {
      fd.set("meetup_lat", String(data.meetup_lat));
      fd.set("meetup_lng", String(data.meetup_lng));
      const composed = composeMeetupAddress(meetupAddress);
      if (composed) fd.set("meetup_address", composed);
      if (meetupOrigin) {
        fd.set("meetup_origin_lat", String(meetupOrigin.lat));
        fd.set("meetup_origin_lng", String(meetupOrigin.lng));
      }
    }
    fd.set("id_type_1", idTypes.id_type_1);
    fd.set("id_type_2", idTypes.id_type_2);
    // SN-13: one JSON field, like condition_items, so the three answers travel together.
    fd.set("papers_checklist", JSON.stringify(papersChecklist));
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
              <Input
                id="sell-year"
                {...register("year")}
                type="number"
                inputMode="numeric"
                min={OLDEST_LISTED_YEAR}
                max={LATEST_YEAR}
                step={1}
                placeholder={`${OLDEST_LISTED_YEAR}–${LATEST_YEAR}`}
                aria-invalid={!!errors.year}
                onKeyDown={(event) => {
                  if (BLOCKED_YEAR_KEYS.has(event.key)) event.preventDefault();
                }}
                onPaste={(event) => {
                  if (!/^\d+$/.test(event.clipboardData.getData("text").trim())) event.preventDefault();
                }}
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
                      <SelectValue placeholder="Select condition">{field.value}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SELL_CONDITIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} textValue={option.value}>
                          <span className="flex flex-col">
                            <span>{option.value}</span>
                            <span className="text-muted-foreground text-xs">{option.description}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {condition ? (
                <FieldDescription>
                  {SELL_CONDITIONS.find((option) => option.value === condition)?.description}
                </FieldDescription>
              ) : null}
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
                <FieldDescription>JPEG, PNG or WebP, max 2 MB each.</FieldDescription>
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
          {meetupMethod === "meet_halfway" ? (
            <Field data-invalid={!!errors.meetup_lat}>
              <FieldLabel>Meet-up point *</FieldLabel>
              <FieldDescription>
                We suggest the halfway point between GCE and your location. Drag the pin to adjust it, within 5 km of
                it, inside CALABARZON. The address fills in once you drop the pin, and you type the block and lot.
              </FieldDescription>
              <MeetupMap
                value={
                  meetupLat != null && meetupLng != null ? { lat: Number(meetupLat), lng: Number(meetupLng) } : null
                }
                onChange={(point) => {
                  setValue("meetup_lat", point.lat, { shouldValidate: isSubmitted });
                  setValue("meetup_lng", point.lng, { shouldValidate: isSubmitted });
                }}
                onAddress={(next) => next && setMeetupAddress((current) => ({ ...next, block_lot: current.block_lot }))}
                origin={meetupOrigin}
                onOrigin={setMeetupOrigin}
              />
              <MeetupAddressFields value={meetupAddress} onChange={setMeetupAddress} />
              {errors.meetup_lat && <FieldError errors={[{ message: errors.meetup_lat.message }]} />}
            </Field>
          ) : meetupMethod === "gce_visit" ? (
            <Field>
              <FieldLabel>Where to meet</FieldLabel>
              <FieldDescription>
                Bring the car and the original papers to GCE. The pin shows the office so you know where to go.
              </FieldDescription>
              <GceLocationMap />
            </Field>
          ) : null}
          {/* SN-13: the OR, the CR and the deed of sale are declared, not uploaded. The originals are checked at
              the meet-up, and GCE never stores a copy. */}
          <Field data-invalid={!!paperError || !!errors.papers_checklist}>
            <FieldLabel>Vehicle papers *</FieldLabel>
            <FieldDescription>{SELL_PAPERS_NOTICE}</FieldDescription>
            <ul className="grid gap-3 sm:grid-cols-3">
              {SELL_PAPER_FIELDS.map((paper) => (
                <li key={paper.key} className="flex flex-col gap-3 rounded-lg border p-3">
                  <Field data-invalid={!papersChecklist[paper.key] && isSubmitted}>
                    <FieldLabel htmlFor={`sell-${paper.key}`}>{paper.label} *</FieldLabel>
                    <Select
                      value={papersChecklist[paper.key] ?? ""}
                      onValueChange={(value) => {
                        const next = { ...papersChecklist, [paper.key]: value };
                        setPapersChecklist(next);
                        // The schema checks the answers too, so the form state must carry them or submit stalls.
                        setValue("papers_checklist", next as SellVehicleFormData["papers_checklist"], {
                          shouldValidate: isSubmitted,
                        });
                        setPaperError(null);
                      }}
                    >
                      <SelectTrigger id={`sell-${paper.key}`} className="w-full">
                        <SelectValue placeholder="Select an answer" />
                      </SelectTrigger>
                      <SelectContent>
                        {paper.statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {SELL_PAPER_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </li>
              ))}
            </ul>
            {paperError ? (
              <FieldError errors={[{ message: paperError }]} />
            ) : errors.papers_checklist ? (
              <FieldError errors={[{ message: SELL_PAPERS_MESSAGE }]} />
            ) : null}
          </Field>
          <Field data-invalid={!!idFilesError}>
            <FieldLabel>Your valid IDs (JPEG/PNG/WebP/PDF, max 2 MB each)</FieldLabel>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[1, 2].map((n) => {
                const idType = idTypes[`id_type_${n}`] ?? "";
                const otherType = idTypes[`id_type_${n === 1 ? 2 : 1}`];
                return (
                  <li key={n} className="flex flex-col gap-3 rounded-lg border p-3">
                    <p className="font-medium text-sm">Valid ID #{n} *</p>
                    <Select
                      value={idType}
                      onValueChange={(value) => setIdTypes((prev) => ({ ...prev, [`id_type_${n}`]: value }))}
                    >
                      <SelectTrigger aria-label={`ID type #${n}`}>
                        <SelectValue placeholder="ID type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCEPTED_ID_TYPES.filter((type) => type !== otherType).map((type) => (
                          <SelectItem key={type} value={type}>
                            {ID_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {ID_FIELDS.filter((field) => field.n === n).map((field) => (
                      <PaperInput
                        key={field.key}
                        id={`sell-${field.key}`}
                        label={`${field.label} of ID #${n}`}
                        disabled={!idType}
                        onFile={(file) => {
                          setPapers((prev) => ({ ...prev, [field.key]: file }));
                          setIdFilesError(null);
                        }}
                      />
                    ))}
                    {idType ? null : <p className="text-muted-foreground text-xs">Choose the ID type first.</p>}
                  </li>
                );
              })}
            </ul>
            {idFilesError && <FieldError errors={[{ message: idFilesError }]} />}
          </Field>
          <Field data-invalid={!!photoError}>
            <FieldLabel htmlFor="sell-photos">Vehicle Photos * (1–6 photos, JPEG/PNG/WebP, max 2 MB each)</FieldLabel>
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

// One paper upload, shrunk in the browser like every upload (2 MB cap).
function PaperInput({
  id,
  label,
  disabled = false,
  onFile,
}: {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onFile: (file: File | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <Input
        id={id}
        type="file"
        accept={SELL_PAPER_ACCEPT}
        disabled={disabled}
        onChange={async (event) => {
          const chosen = event.target.files?.[0];
          onFile(chosen ? await compressImage(chosen) : null);
        }}
      />
    </div>
  );
}
