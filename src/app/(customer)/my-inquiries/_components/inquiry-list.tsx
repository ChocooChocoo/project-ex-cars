"use client";
"use no memo";

import Link from "next/link";

import { Car, MessageSquare, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function InquiryList({
  inquiries,
  baseUrl,
}: {
  readonly inquiries: Record<string, unknown>[];
  readonly baseUrl: string;
}) {
  if (inquiries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <MessageSquare className="size-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">No conversations yet. Browse the showroom to start one.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {inquiries.map((inv) => {
        const id = inv.id as string;
        const vehicles = inv.vehicles as Record<string, unknown> | undefined;
        const intention = inv.intention_kind as string;
        const state = inv.state as string;

        return (
          <Link key={id} href={`${baseUrl}/${id}`}>
            <Card className="transition-shadow hover:shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Car className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {vehicles ? `${vehicles.make} ${vehicles.model} (${vehicles.year})` : "Vehicle"}
                    </span>
                    <Badge variant={intention === "buy_now" ? "default" : "secondary"} className="text-xs capitalize">
                      {intention === "buy_now" ? "Buy Now" : "Inquiry"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <span className="capitalize">{state.replace("_", " ")}</span>
                  </div>
                </div>
                <User className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
