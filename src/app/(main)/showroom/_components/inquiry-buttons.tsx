"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { MessageSquare, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { createInquiry } from "@/app/(main)/inquiries/actions";
import { Button } from "@/components/ui/button";

export function InquiryButtons({ vehicleId }: { readonly vehicleId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleInquiry(kind: string) {
    setLoading(kind);
    const fd = new FormData();
    fd.set("vehicle_id", vehicleId);
    fd.set("intention_kind", kind);
    const result = await createInquiry(fd);
    setLoading(null);

    if (result.error) {
      toast.error(result.error);
    } else if (result.id) {
      toast.success(kind === "buy_now" ? "Buy Now request sent!" : "Inquiry started!");
      router.push(`/inquiries/${result.id}`);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button className="w-full" onClick={() => handleInquiry("inquiry")} disabled={loading !== null}>
        <MessageSquare className="mr-2 size-4" />
        {loading === "inquiry" ? "Starting..." : "Inquire"}
      </Button>
      <Button variant="outline" className="w-full" onClick={() => handleInquiry("buy_now")} disabled={loading !== null}>
        <ShoppingCart className="mr-2 size-4" />
        {loading === "buy_now" ? "Sending..." : "Buy Now"}
      </Button>
    </div>
  );
}
