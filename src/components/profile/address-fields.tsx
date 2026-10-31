"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type AddressValue,
  citiesOfRegion,
  composeAddress,
  type PsgcBarangay,
  type PsgcCity,
  type PsgcProvince,
  type PsgcRegion,
  provinceNameFor,
  provincesOfRegion,
  selectBarangay,
  selectCity,
  selectProvince,
  selectRegion,
} from "@/lib/psgc/address";

const LISTS_ERROR = "We could not load the address lists. Check your connection, then try again.";
const BARANGAYS_ERROR = "We could not load the barangays for this city. Try again.";

// One cache for the session: the files never change, and a failed load is evicted so Retry refetches.
const jsonCache = new Map<string, Promise<unknown>>();

function loadJson<T>(url: string, bypassCache = false): Promise<T> {
  if (bypassCache) jsonCache.delete(url);
  const cached = jsonCache.get(url);
  if (cached) return cached as Promise<T>;

  const request = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url} responded ${response.status}`);
    return response.json() as Promise<T>;
  });
  void request.catch(() => jsonCache.delete(url));
  jsonCache.set(url, request);
  return request;
}

// A stored row has codes only, so the name starts empty and must be filled from the list. Only an empty
// *list* name is treated as nothing to apply, which keeps a name already on screen.
function matchesName(current: string, next: string) {
  return next === "" || current === next;
}

interface AddressSelectProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly options: ReadonlyArray<{ code: string; name: string }>;
  readonly disabled: boolean;
  readonly required?: boolean;
  readonly description?: string;
  readonly onValueChange: (code: string) => void;
}

function AddressSelect({
  id,
  label,
  value,
  placeholder,
  options,
  disabled,
  required = false,
  description,
  onValueChange,
}: AddressSelectProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id} id={`${id}-label`}>
        {label}
      </FieldLabel>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className="w-full"
          aria-required={required ? true : undefined}
          aria-labelledby={`${id}-label ${id}-value`}
          aria-describedby={description ? `${id}-description` : undefined}
        >
          <SelectValue id={`${id}-value`} placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? <FieldDescription id={`${id}-description`}>{description}</FieldDescription> : null}
    </Field>
  );
}

interface AddressFieldsProps {
  readonly value: AddressValue;
  readonly onChange: (next: AddressValue) => void;
  /** The composed address already on the row, shown when it predates the dropdowns. */
  readonly storedAddress?: string;
}

export function AddressFields({ value, onChange, storedAddress }: AddressFieldsProps) {
  const [regions, setRegions] = useState<PsgcRegion[]>([]);
  const [provinces, setProvinces] = useState<PsgcProvince[]>([]);
  const [cities, setCities] = useState<PsgcCity[]>([]);
  const [barangays, setBarangays] = useState<PsgcBarangay[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);
  const [barangaysLoading, setBarangaysLoading] = useState(false);
  const [barangaysError, setBarangaysError] = useState<string | null>(null);
  const [listsAttempt, setListsAttempt] = useState(0);
  const [barangaysAttempt, setBarangaysAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const retry = listsAttempt > 0;
    setListsLoading(true);

    void Promise.all([
      loadJson<PsgcRegion[]>("/psgc/regions.json", retry),
      loadJson<PsgcProvince[]>("/psgc/provinces.json", retry),
      loadJson<PsgcCity[]>("/psgc/cities.json", retry),
    ])
      .then(([loadedRegions, loadedProvinces, loadedCities]) => {
        if (!active) return;
        setRegions(loadedRegions);
        setProvinces(loadedProvinces);
        setCities(loadedCities);
        setListsError(null);
        setListsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setListsError(LISTS_ERROR);
        setListsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [listsAttempt]);

  useEffect(() => {
    if (!value.city_code) {
      setBarangays([]);
      setBarangaysError(null);
      setBarangaysLoading(false);
      return;
    }

    let active = true;
    setBarangaysLoading(true);

    void loadJson<PsgcBarangay[]>(`/psgc/barangays/${value.city_code}.json`, barangaysAttempt > 0)
      .then((loaded) => {
        if (!active) return;
        setBarangays(loaded);
        setBarangaysError(null);
        setBarangaysLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setBarangaysError(BARANGAYS_ERROR);
        setBarangaysLoading(false);
      });

    return () => {
      active = false;
    };
  }, [value.city_code, barangaysAttempt]);

  // The rows store codes only, so the names that build `profiles.address` come from these lists.
  useEffect(() => {
    if (regions.length === 0 && provinces.length === 0 && cities.length === 0) return;

    const next: AddressValue = {
      ...value,
      region_name: regions.find((row) => row.code === value.region_code)?.name ?? value.region_name,
      province_name: provinces.find((row) => row.code === value.province_code)?.name ?? value.province_name,
      city_name: cities.find((row) => row.code === value.city_code)?.name ?? value.city_name,
      barangay_name: barangays.find((row) => row.code === value.barangay_code)?.name ?? value.barangay_name,
    };

    if (
      matchesName(value.region_name, next.region_name) &&
      matchesName(value.province_name, next.province_name) &&
      matchesName(value.city_name, next.city_name) &&
      matchesName(value.barangay_name, next.barangay_name)
    ) {
      return;
    }
    onChange(next);
  }, [regions, provinces, cities, barangays, value, onChange]);

  const provinceOptions = useMemo(
    () => provincesOfRegion(provinces, value.region_code),
    [provinces, value.region_code],
  );
  const cityOptions = useMemo(
    () => citiesOfRegion(cities, value.region_code, value.province_code),
    [cities, value.region_code, value.province_code],
  );

  const listsReady = !listsLoading && !listsError;
  const provinceBlocked = listsLoading || provinceOptions.length === 0;
  const cityBlocked = listsLoading || !value.region_code || (provinceOptions.length > 0 && cityOptions.length === 0);

  function pickRegion(code: string) {
    const region = regions.find((row) => row.code === code);
    if (region) onChange(selectRegion(value, region));
  }

  function pickProvince(code: string) {
    const province = provinces.find((row) => row.code === code);
    if (province) onChange(selectProvince(value, province));
  }

  function pickCity(code: string) {
    const city = cities.find((row) => row.code === code);
    if (city) onChange(selectCity(value, city));
  }

  function pickBarangay(code: string) {
    const barangay = barangays.find((row) => row.code === code);
    if (barangay) onChange(selectBarangay(value, barangay));
  }

  function retryBarangays() {
    setBarangaysAttempt((attempt) => attempt + 1);
  }

  const provincePlaceholder = !value.region_code
    ? "Choose a region first"
    : provinceOptions.length === 0 && listsReady
      ? "No provinces in this region"
      : "Choose a province";
  const cityPlaceholder = !value.region_code
    ? "Choose a region first"
    : cityBlocked && listsReady
      ? "Choose a province first"
      : "Choose a city or municipality";
  const barangayPlaceholder = !value.city_code
    ? "Choose a city first"
    : barangaysLoading
      ? "Loading barangays..."
      : "Choose a barangay";
  const complete = value.region_code !== "" && value.city_code !== "" && value.barangay_code !== "";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <AddressSelect
          id="profile-region"
          label="Region *"
          value={value.region_code}
          placeholder={listsLoading ? "Loading regions..." : "Choose a region"}
          options={regions}
          disabled={!listsReady}
          required
          onValueChange={pickRegion}
        />
        <AddressSelect
          id="profile-province"
          label="Province"
          value={value.province_code}
          placeholder={listsLoading ? "Loading provinces..." : provincePlaceholder}
          options={provinceOptions}
          disabled={provinceBlocked || !!listsError}
          description={
            !listsReady || !value.region_code || provinceOptions.length > 0
              ? undefined
              : "This region has no provinces."
          }
          onValueChange={pickProvince}
        />
        <AddressSelect
          id="profile-city"
          label="City or municipality *"
          value={value.city_code}
          placeholder={listsLoading ? "Loading cities..." : cityPlaceholder}
          options={cityOptions}
          disabled={cityBlocked || !!listsError}
          required
          onValueChange={pickCity}
        />
        <AddressSelect
          id="profile-barangay"
          label="Barangay *"
          value={value.barangay_code}
          placeholder={barangayPlaceholder}
          options={barangays}
          disabled={!value.city_code || barangaysLoading}
          required
          onValueChange={pickBarangay}
        />
      </div>

      <Field>
        <FieldLabel htmlFor="profile-address-line">Block and lot</FieldLabel>
        <Input
          id="profile-address-line"
          value={value.address_line}
          onChange={(event) => onChange({ ...value, address_line: event.target.value })}
          maxLength={200}
          placeholder="Block 4 Lot 5, Purok 2"
        />
        <FieldDescription>House, block and lot, or street. Up to 200 characters.</FieldDescription>
      </Field>

      {barangaysError ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-destructive text-sm">
          <p>{barangaysError}</p>
          <Button type="button" size="sm" variant="outline" onClick={retryBarangays}>
            Try again
          </Button>
        </div>
      ) : null}

      {listsError ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-destructive text-sm">
          <p>{listsError}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setListsAttempt((attempt) => attempt + 1)}>
            Try again
          </Button>
        </div>
      ) : null}

      {complete ? (
        <FieldDescription>
          Saved as: {composeAddress({ ...value, province_name: provinceNameFor(value) })}
        </FieldDescription>
      ) : storedAddress && !value.region_code ? (
        <FieldDescription>
          Saved before this update: {storedAddress}. Choose the dropdowns to replace it.
        </FieldDescription>
      ) : null}
    </div>
  );
}
