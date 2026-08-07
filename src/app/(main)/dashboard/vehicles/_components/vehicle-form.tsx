"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { createVehicle, updateVehicle } from "@/app/(main)/dashboard/vehicles/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type VehicleFormData, vehicleSchema } from "@/lib/validation/vehicles";

interface VehicleFormProps {
  defaultValues?: VehicleFormData & { id?: string };
}

const fuelTypes = ["Gasoline", "Diesel", "Hybrid", "Electric", "LPG"];
const transmissions = ["Manual", "Automatic", "CVT", "DCT"];
const bodyTypes = ["Sedan", "SUV", "Hatchback", "Coupe", "MPV", "Pickup", "Van", "Wagon", "Convertible"];

export function VehicleForm({ defaultValues }: VehicleFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!defaultValues?.id;

  const form = useForm<z.infer<typeof vehicleSchema>>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: defaultValues ?? {
      stock_code: "",
      make: "",
      model: "",
      year: new Date().getFullYear(),
      condition: "used",
      pricing_type: "negotiable",
    },
  });

  async function onSubmit(data: z.infer<typeof vehicleSchema>) {
    setLoading(true);
    const fd = new FormData();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== "") {
        fd.set(key, String(value));
      }
    }
    if (isEdit && defaultValues?.id) {
      fd.set("id", defaultValues.id);
    }

    const result = isEdit ? await updateVehicle(fd) : await createVehicle(fd);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(isEdit ? "Vehicle updated." : "Vehicle created.");
      router.push("/dashboard/vehicles");
      router.refresh();
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl leading-none tracking-tight">{isEdit ? "Edit Vehicle" : "Add Vehicle"}</h1>
          <p className="text-muted-foreground text-sm">
            {isEdit ? "Update vehicle details." : "Add a new vehicle to inventory."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Update Vehicle" : "Create Vehicle"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border p-5">
            <h2 className="mb-4 font-semibold text-sm">Basic Information</h2>
            <FieldGroup className="gap-4">
              <Controller
                control={form.control}
                name="stock_code"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Stock Code</FieldLabel>
                    <Input {...field} placeholder="GCE-001" />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="vin"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>VIN (optional)</FieldLabel>
                    <Input {...field} placeholder="Vehicle Identification Number" />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <Controller
                  control={form.control}
                  name="make"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Make</FieldLabel>
                      <Input {...field} placeholder="Toyota" />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="model"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Model</FieldLabel>
                      <Input {...field} placeholder="Vios" />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <Controller
                  control={form.control}
                  name="condition"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Condition</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="used">Used</SelectItem>
                            <SelectItem value="certified">Certified Pre-Owned</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>
            </FieldGroup>
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="mb-4 font-semibold text-sm">Specifications</h2>
            <FieldGroup className="gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Controller
                  control={form.control}
                  name="mileage"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Mileage (km)</FieldLabel>
                      <InputGroup>
                        <InputGroupInput {...field} type="number" placeholder="50000" />
                        <InputGroupAddon align="inline-end">km</InputGroupAddon>
                      </InputGroup>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="fuel_type"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Fuel Type</FieldLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {fuelTypes.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
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
                  name="transmission"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Transmission</FieldLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {transmissions.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
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
                  name="body_type"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Body Type</FieldLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {bodyTypes.map((b) => (
                              <SelectItem key={b} value={b}>
                                {b}
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
              <Controller
                control={form.control}
                name="engine"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Engine</FieldLabel>
                    <Input {...field} placeholder="1.5L 4-cylinder" />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <Controller
                  control={form.control}
                  name="exterior_color"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Exterior Color</FieldLabel>
                      <Input {...field} placeholder="White" />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="interior_color"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Interior Color</FieldLabel>
                      <Input {...field} placeholder="Black" />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>
            </FieldGroup>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-lg border p-5">
            <h2 className="mb-4 font-semibold text-sm">Pricing & Listing</h2>
            <FieldGroup className="gap-4">
              <Controller
                control={form.control}
                name="current_price"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Price</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon align="inline-start">₱</InputGroupAddon>
                      <InputGroupInput {...field} type="number" placeholder="500000" />
                    </InputGroup>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="pricing_type"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Pricing Type</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="negotiable">Negotiable Price</SelectItem>
                          <SelectItem value="fixed">Fixed Price</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="warranty_details"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Warranty Details</FieldLabel>
                    <Input {...field} placeholder="1 year engine warranty" />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="offer_details"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Promotional Offer</FieldLabel>
                    <Input {...field} placeholder="Free registration for first 10 buyers" />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </FieldGroup>
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="mb-4 font-semibold text-sm">Description</h2>
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Textarea
                    {...field}
                    rows={6}
                    placeholder="Describe the vehicle condition, features, and other details..."
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
