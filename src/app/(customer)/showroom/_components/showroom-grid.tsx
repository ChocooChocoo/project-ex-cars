"use client";
"use no memo";

import { useState } from "react";

import Link from "next/link";

import { Car, Filter, Heart, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ShowroomGrid({ vehicles }: { readonly vehicles: Record<string, unknown>[] }) {
  const [search, setSearch] = useState("");
  const [makeFilter, setMakeFilter] = useState("all");
  const [priceSort, setPriceSort] = useState("newest");

  const makes = [...new Set(vehicles.map((v) => v.make as string).filter(Boolean))];

  const filtered = vehicles.filter((v) => {
    if (makeFilter !== "all" && v.make !== makeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const make = ((v.make as string) ?? "").toLowerCase();
      const model = ((v.model as string) ?? "").toLowerCase();
      const stock = ((v.stock_code as string) ?? "").toLowerCase();
      if (!make.includes(q) && !model.includes(q) && !stock.includes(q)) return false;
    }
    return true;
  });

  if (priceSort === "price-asc")
    filtered.sort((a, b) => ((a.current_price as number) ?? 0) - ((b.current_price as number) ?? 0));
  else if (priceSort === "price-desc")
    filtered.sort((a, b) => ((b.current_price as number) ?? 0) - ((a.current_price as number) ?? 0));
  else
    filtered.sort(
      (a, b) => new Date((b.posted_at as string) ?? 0).getTime() - new Date((a.posted_at as string) ?? 0).getTime(),
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-8 w-full md:w-72">
          <InputGroupAddon align="inline-start">
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search vehicles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <Kbd className="h-4 text-[10px]">⌘K</Kbd>
          </InputGroupAddon>
        </InputGroup>
        <Select value={makeFilter} onValueChange={setMakeFilter}>
          <SelectTrigger size="sm" className="w-40">
            <span className="text-muted-foreground">Make:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectGroup>
              <SelectItem value="all">All Makes</SelectItem>
              {makes.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={priceSort} onValueChange={setPriceSort}>
          <SelectTrigger size="sm" className="w-44">
            <Filter className="size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectGroup>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="ml-auto text-muted-foreground text-sm">{filtered.length} vehicles</span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Car className="size-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No vehicles match your search.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v) => {
            const id = v.id as string;
            const make = v.make as string;
            const model = v.model as string;
            const year = v.year as number;
            const price = v.current_price as number | null;
            const mileage = v.mileage as number | null;
            const fuel = v.fuel_type as string | null;
            const transmission = v.transmission as string | null;
            const pricingType = v.pricing_type as string;
            const offer = v.offer_details as string | null;

            return (
              <Link key={id} href={`/showroom/${id}`} className="group">
                <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                  <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                    <Car className="size-16 text-muted-foreground/40" />
                  </div>
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold group-hover:text-primary">
                          {make} {model}
                        </h3>
                        <p className="text-muted-foreground text-xs">{year}</p>
                      </div>
                      <Badge variant={pricingType === "fixed" ? "default" : "secondary"} className="text-xs capitalize">
                        {pricingType}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg">{price ? `₱${price.toLocaleString()}` : "Price TBA"}</span>
                      <Heart className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex flex-wrap gap-1 text-muted-foreground text-xs">
                      {mileage && <span>{mileage.toLocaleString()} km</span>}
                      {mileage && fuel && <span>·</span>}
                      {fuel && <span>{fuel}</span>}
                      {fuel && transmission && <span>·</span>}
                      {transmission && <span>{transmission}</span>}
                    </div>
                    {offer && (
                      <Badge variant="outline" className="w-fit text-xs">
                        {offer}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
