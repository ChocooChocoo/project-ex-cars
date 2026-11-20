"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { captureVehiclePapers } from "@/app/(staff)/transactions/sell-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAPERS_CUSTODY_LABELS, type PapersCustodyState } from "@/lib/transactions/vehicle-papers";
import { compressFormFiles } from "@/lib/uploads/compress-image";

const PAPERS = [
  { name: "official_receipt", label: "Official Receipt (OR)" },
  { name: "certificate_of_registration", label: "Certificate of Registration (CR)" },
  { name: "deed_of_sale", label: "Deed of Sale (previous owner's)" },
] as const;

const MAX_EXTRA = 4;

// SN-3: after GCE pays the seller, the Marketing Specialist photographs the physical OR, CR and Deed of Sale and
// sends them to the Confidential Informant, who keeps the originals until a buyer's sale.
export function CapturePapersCard({
  transactionId,
  custody,
  canCapture,
}: {
  readonly transactionId: string;
  readonly custody: string | null;
  readonly canCapture: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<Partial<Record<(typeof PAPERS)[number]["name"], File>>>({});
  const [extra, setExtra] = useState<File[]>([]);
  const ready = PAPERS.every((paper) => files[paper.name]);

  async function send() {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    for (const paper of PAPERS) {
      const file = files[paper.name];
      if (file) fd.set(paper.name, file);
    }
    for (const page of extra) fd.append("extra", page);
    setBusy(true);
    const result = await captureVehiclePapers(await compressFormFiles(fd));
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Papers sent to the Confidential Informant.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle papers</CardTitle>
        <CardDescription>
          Photograph the seller&apos;s original OR, CR and Deed of Sale, then send them to the Confidential Informant
          with the originals.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {custody ? (
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="secondary">{PAPERS_CUSTODY_LABELS[custody as PapersCustodyState] ?? custody}</Badge>
          </p>
        ) : canCapture ? (
          <>
            {PAPERS.map((paper) => (
              <div key={paper.name} className="flex flex-col gap-1.5">
                <Label htmlFor={`paper-${paper.name}`}>{paper.label}</Label>
                <Input
                  id={`paper-${paper.name}`}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setFiles((current) => ({ ...current, [paper.name]: file }));
                  }}
                />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paper-extra">Extra pages (optional, up to {MAX_EXTRA})</Label>
              <Input
                id="paper-extra"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setExtra(Array.from(e.target.files ?? []).slice(0, MAX_EXTRA))}
              />
            </div>
            <Button size="sm" className="self-start" disabled={busy || !ready} onClick={send}>
              {busy ? "Sending..." : "Send to Confidential Informant"}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">The Marketing Specialist has not sent the papers yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
