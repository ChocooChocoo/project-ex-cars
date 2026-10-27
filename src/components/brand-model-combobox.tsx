"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { BRANDS, modelsFor } from "@/lib/vehicles/catalog";

interface SuggestFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly items: readonly string[];
  readonly placeholder: string;
  readonly error?: string;
  readonly onChange: (value: string) => void;
}

// The input text is the value: picking a suggestion fills it, and anything typed stays as typed.
function SuggestField({ id, label, value, items, placeholder, error, onChange }: SuggestFieldProps) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox
        items={items}
        inputValue={value}
        // Only typing changes the text; base-ui would otherwise clear unlisted text when the popup closes.
        onInputValueChange={(text, details) => {
          if (details.reason === "input-change" || details.reason === "clear-press") onChange(text);
        }}
        value={items.includes(value) ? value : null}
        onValueChange={(picked) => {
          if (typeof picked === "string") onChange(picked);
        }}
      >
        <ComboboxInput id={id} placeholder={placeholder} aria-invalid={!!error} className="w-full" />
        <ComboboxContent>
          <ComboboxEmpty>No suggestion. What you typed is kept.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error ? <FieldError errors={[{ message: error }]} /> : null}
    </Field>
  );
}

export function BrandModelCombobox({
  idPrefix,
  brand,
  model,
  onBrandChange,
  onModelChange,
  brandError,
  modelError,
}: {
  readonly idPrefix: string;
  readonly brand: string;
  readonly model: string;
  readonly onBrandChange: (value: string) => void;
  readonly onModelChange: (value: string) => void;
  readonly brandError?: string;
  readonly modelError?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SuggestField
        id={`${idPrefix}-brand`}
        label="Brand *"
        value={brand}
        items={BRANDS}
        placeholder="e.g. Toyota"
        error={brandError}
        onChange={onBrandChange}
      />
      <SuggestField
        id={`${idPrefix}-model`}
        label="Model *"
        value={model}
        items={modelsFor(brand)}
        placeholder="e.g. Vios"
        error={modelError}
        onChange={onModelChange}
      />
    </div>
  );
}
