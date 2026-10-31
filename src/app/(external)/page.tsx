import Image from "next/image";
import Link from "next/link";

import { ArrowRight, Building2, Car, MapPin, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn, formatCurrency } from "@/lib/utils";

import { FinancingEstimator } from "./_components/financing-estimator";
import { HeroCopy, HeroLine, HeroPhoto } from "./_components/hero-entrance";
import { PromoStrip } from "./_components/promo-strip";
import { Reveal } from "./_components/reveal";

// The admin client reads no cookies, so without this the page would be frozen at build time.
// ponytail: a sold car can show for up to a minute; switch to force-dynamic if that matters.
export const revalidate = 60;

// Stock photos (Unsplash), used only where no specific GCE car is named, so a caption never pairs one car's
// name with another car's photo. Replace with GCE's own photos.
const STOCK = {
  hero: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1600&q=80",
  route: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1600&q=80",
};

const mediaUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/showroom-media/${path}`;

const peso = (amount: unknown) => formatCurrency(Number(amount ?? 0), { noDecimals: true });

const ROUTES = [
  { icon: Building2, title: "Visit GCE", body: "See the car at our branch and pay there. No address needed." },
  {
    icon: MapPin,
    title: "Meet up in CALABARZON",
    body: "Our team brings the car to a meeting point, with a mechanic on hand.",
  },
  { icon: Truck, title: "Delivery", body: "We bring it to your door. Book at least 7 days ahead." },
];

// Public landing page (T04 L1/L2). src/proxy.ts sends signed-in users from / to their own landing path,
// so only signed-out visitors see this page. Styling uses the app's shadcn components and theme tokens only.
export default async function LandingPage() {
  // The anon role cannot read vehicles or content_items: their staff RLS policies read private.user_roles,
  // which anon may not touch. This server-only page reads with the admin client instead, limited to public
  // columns of published content and available cars.
  const supabase = createAdminClient();
  const { data: content } = await supabase
    .from("content_items")
    .select("id, content_kind, title, body, vehicle_id")
    .eq("publication_state", "published")
    .order("published_at", { ascending: false });

  const items = content ?? [];
  const promos = items.filter((c) => c.content_kind === "hero" || c.content_kind === "promotion");
  const featured = items.filter((c) => c.content_kind === "featured_vehicle");
  const announcements = items.filter((c) => c.content_kind === "announcement");

  // Cars currently in the showroom, newest first.
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, make, model, year, current_price, stock_code")
    .eq("listing_state", "available")
    .order("posted_at", { ascending: false })
    .limit(5);
  const cars = vehicles ?? [];

  // First public photo of each listed car.
  const { data: media } = cars.length
    ? await supabase
        .from("vehicle_media")
        .select("vehicle_id, storage_path")
        .in(
          "vehicle_id",
          cars.map((c) => c.id),
        )
        .eq("media_kind", "photo")
        .eq("public_state", true)
        .order("display_order", { ascending: true })
    : { data: [] };
  const photoOf = new Map<string, string>();
  for (const row of media ?? []) {
    if (!photoOf.has(row.vehicle_id)) photoOf.set(row.vehicle_id, mediaUrl(row.storage_path));
  }

  const carName = (c: { year: unknown; make: unknown; model: unknown }) => `${c.year} ${c.make} ${c.model}`;

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 rounded-md font-semibold">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Car className="size-4" aria-hidden />
            </span>
            <span>GCE</span>
            <span className="hidden font-normal text-muted-foreground text-sm sm:inline">Global Car Exchange</span>
          </Link>
          <nav aria-label="Account" className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/v1/register">Register</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/v1/login">Log in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pt-10 pb-14 sm:px-6 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-2 lg:gap-14 lg:py-12">
          <HeroCopy>
            <HeroLine>
              <h1 className="text-balance font-semibold text-4xl tracking-tight sm:text-5xl lg:text-6xl">
                Your next car, from our showroom to your driveway.
              </h1>
            </HeroLine>
            <HeroLine>
              <p className="max-w-prose text-lg text-muted-foreground">
                Browse inspected cars. Pay in full or over 6 to 60 months. Pick it up, meet halfway, or have it
                delivered.
              </p>
            </HeroLine>
            <HeroLine className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth/v1/login">Log in</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/v1/register">Register</Link>
              </Button>
            </HeroLine>
          </HeroCopy>

          <HeroPhoto className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
            <Image
              src={STOCK.hero}
              alt="A white SUV parked by the road"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </HeroPhoto>
        </section>

        <PromoStrip items={promos.map((p) => ({ id: p.id, title: p.title, body: p.body }))} />

        {/* Showroom */}
        {cars.length > 0 ? (
          <section aria-labelledby="showroom-heading" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
            <Reveal className="mb-10 flex flex-col gap-2">
              <h2 id="showroom-heading" className="font-semibold text-3xl tracking-tight">
                In the showroom now
              </h2>
              <p className="max-w-prose text-muted-foreground">
                Every car here passed a GCE mechanic's inspection. Log in to see the photos and request one.
              </p>
            </Reveal>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
              {cars.map((car, index) => {
                const photo = photoOf.get(car.id);
                const lead = index === 0;
                return (
                  <li key={car.id} className={cn(lead && "sm:col-span-2 lg:row-span-2")}>
                    <Reveal delay={index * 0.06} className="h-full">
                      <Link
                        href={`/customer/showroom/${car.id}`}
                        className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <Card className="h-full gap-0 overflow-hidden py-0 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                          <div
                            className={cn(
                              "relative flex items-center justify-center overflow-hidden bg-muted",
                              lead ? "aspect-[4/3] lg:aspect-auto lg:flex-1" : "aspect-[16/10]",
                            )}
                          >
                            {photo ? (
                              <Image
                                src={photo}
                                alt={carName(car)}
                                fill
                                sizes={lead ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
                                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                              />
                            ) : (
                              // No photo yet: never a stand-in photo of another car.
                              <Car
                                className={cn("text-muted-foreground/40", lead ? "size-16" : "size-10")}
                                aria-hidden
                              />
                            )}
                          </div>
                          <CardContent className="flex flex-col items-start gap-1.5 p-4">
                            <Badge variant="outline" className="max-w-full truncate font-mono">
                              {String(car.stock_code)}
                            </Badge>
                            <span className={cn("font-medium", lead && "text-lg")}>{carName(car)}</span>
                            <span className="text-muted-foreground text-sm tabular-nums">
                              {peso(car.current_price)}
                            </span>
                          </CardContent>
                        </Card>
                      </Link>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* How you get your car */}
        <section aria-labelledby="routes-heading" className="border-y bg-muted/40">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
            <Reveal className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
              <Image
                src={STOCK.route}
                alt="A white SUV on a dirt road"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </Reveal>
            <div className="flex flex-col gap-8">
              <Reveal className="flex flex-col gap-2">
                <h2 id="routes-heading" className="font-semibold text-3xl tracking-tight">
                  Three ways to get your car
                </h2>
                <p className="max-w-prose text-muted-foreground">
                  Choose when you request a car. Schedules are on the hour, 9 AM to 9 PM, Monday to Saturday.
                </p>
              </Reveal>
              <ol className="relative flex flex-col gap-8 border-l border-dashed pl-8">
                {ROUTES.map((route, index) => (
                  <li key={route.title} className="relative">
                    <Reveal delay={index * 0.08} className="flex flex-col gap-1">
                      <span className="absolute top-0 -left-12 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <route.icon className="size-4" aria-hidden />
                      </span>
                      <h3 className="font-medium text-lg">{route.title}</h3>
                      <p className="text-muted-foreground">{route.body}</p>
                    </Reveal>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Pay your way */}
        <section aria-labelledby="pay-heading" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
            <div className="flex flex-col gap-6">
              <Reveal className="flex flex-col gap-2">
                <h2 id="pay-heading" className="font-semibold text-3xl tracking-tight">
                  Pay in full, or in monthly terms
                </h2>
                <p className="max-w-prose text-muted-foreground">
                  Full payment works by cash or bank transfer through PayMongo. Financing with GCE adds 10% to the car's
                  price, the same for every term.
                </p>
              </Reveal>
              <Reveal className="flex flex-wrap gap-2" delay={0.08}>
                <Badge variant="secondary">Cash</Badge>
                <Badge variant="secondary">Bank Transfer (via PayMongo)</Badge>
                <Badge>Financing +10%</Badge>
              </Reveal>
            </div>
            {cars.length > 0 ? (
              <Reveal delay={0.1}>
                <FinancingEstimator
                  cars={cars.map((c) => ({ id: c.id, label: carName(c), price: Number(c.current_price) }))}
                />
              </Reveal>
            ) : null}
          </div>
        </section>

        {/* Marketing: featured cars and announcements */}
        {featured.length + announcements.length > 0 ? (
          <section aria-labelledby="news-heading" className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
            <Reveal>
              <h2 id="news-heading" className="mb-6 font-semibold text-2xl tracking-tight">
                From GCE
              </h2>
            </Reveal>
            <ul className="grid gap-x-12 sm:grid-cols-2">
              {[...featured, ...announcements].map((item) => (
                <li key={item.id} className="border-t py-5">
                  <h3 className="font-medium">{item.title}</h3>
                  {item.body ? <p className="mt-1 text-muted-foreground text-sm">{item.body}</p> : null}
                  {item.vehicle_id ? (
                    <Button asChild variant="link" className="mt-1 h-auto px-0">
                      <Link href={`/customer/showroom/${item.vehicle_id}`}>
                        View this car <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Closing call to action */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
            <h2 className="max-w-md text-balance font-semibold text-3xl tracking-tight">
              Make an account to request a car
            </h2>
            <Button asChild size="lg" variant="secondary">
              <Link href="/auth/v1/register">Register</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-muted-foreground text-sm sm:px-6">
          <p>© 2026, GCE Auto Sales.</p>
          <div className="flex gap-1">
            <Button asChild variant="link" size="sm" className="text-muted-foreground">
              <Link href="/auth/v1/login">Log in</Link>
            </Button>
            <Button asChild variant="link" size="sm" className="text-muted-foreground">
              <Link href="/auth/v1/register">Register</Link>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
