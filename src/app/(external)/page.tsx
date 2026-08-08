import Link from "next/link";

import { Car } from "lucide-react";

import { getCurrentRole } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function LandingPage() {
  const role = await getCurrentRole();

  const supabase = await createServerSupabase();
  const { data: content } = await supabase
    .from("content_items")
    .select("*")
    .eq("publication_state", "published")
    .order("published_at", { ascending: false });

  const hero = (content ?? []).find((c) => c.content_kind === "hero");
  const promotions = (content ?? []).filter((c) => c.content_kind === "promotion");
  const featured = (content ?? []).filter((c) => c.content_kind === "featured_vehicle");
  const announcements = (content ?? []).filter((c) => c.content_kind === "announcement");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-12">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 text-center">
        <Car className="size-16 text-primary" />
        <h1 className="font-bold text-4xl tracking-tight">{hero?.title ?? "Global Car Exchange"}</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          {hero?.body ?? "Your trusted platform for buying and selling vehicles."}
        </p>
        <div className="flex gap-4">
          {role ? (
            <Button asChild size="lg">
              <Link href={role === "customer" ? "/customer/showroom" : `/${role}/dashboard`}>Go to Dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href="/auth/v1/login">Get Started</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Promotions */}
      {promotions.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold text-2xl">Current Promotions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{p.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{p.body}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Featured Vehicles */}
      {featured.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold text-2xl">Featured Vehicles</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((f) => (
              <Card key={f.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{f.body}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold text-2xl">Announcements</h2>
          <div className="flex flex-col gap-3">
            {announcements.map((a) => (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="text-base">{a.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{a.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {!role && (
        <div className="flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/v1/login">Sign in to browse vehicles</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
