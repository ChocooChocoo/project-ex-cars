"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import { signContract } from "@/app/(customer)/my-transactions/actions";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createClient } from "@/lib/api/storage-client";

type Method = "e_signature" | "face_to_face";

// A meet-up or delivery contract is signed on paper with GCE staff, so the buyer only reads where and when.
export function OnSiteContract({
  arrangementKind,
  signedAt,
}: {
  readonly arrangementKind: string | null;
  readonly signedAt: string | null;
}) {
  const where = arrangementKind === "delivery" ? "when the car is delivered" : "at the meet-up";
  return (
    <section className="flex flex-col gap-3" aria-labelledby="contract-heading">
      <h2 id="contract-heading" className="font-medium tracking-tight">
        Your contract
      </h2>
      <p className="text-muted-foreground text-sm">
        {signedAt
          ? `You signed this contract on ${format(new Date(signedAt), "MMM d, yyyy 'at' h:mm a")}.`
          : `You sign the printed contract with GCE staff ${where}. Read it there before you sign.`}
      </p>
    </section>
  );
}

// The buyer reads the contract the Head Accountant approved and signs it. T06: by e-signature (typed full
// name plus a drawn signature) or face-to-face with GCE staff. Before approval only the wait is explained.
export function ContractSign({
  transactionId,
  contractState,
  contractBody,
  signedAt,
  signingMethod = null,
}: {
  readonly transactionId: string;
  readonly contractState: string | null;
  readonly contractBody: string | null;
  readonly signedAt: string | null;
  readonly signingMethod?: string | null;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>(signingMethod === "face_to_face" ? "face_to_face" : "e_signature");
  const [name, setName] = useState("");
  const [signature, setSignature] = useState<HTMLCanvasElement | null>(null);
  const [signing, setSigning] = useState(false);
  const faceToFaceChosen = signingMethod === "face_to_face";

  async function submit() {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    fd.set("signing_method", method);
    setSigning(true);
    try {
      if (method === "e_signature") {
        if (!signature) return;
        const blob = await new Promise<Blob | null>((resolve) => signature.toBlob(resolve, "image/png"));
        if (!blob) {
          toast.error("Could not read the signature. Draw it again.");
          return;
        }
        const path = `${transactionId}/signature-${Date.now()}.png`;
        const { error } = await createClient().storage.from("transaction-documents").upload(path, blob, {
          contentType: "image/png",
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        fd.set("signed_name", name);
        fd.set("signature_path", path);
      }
      const result = await signContract(fd);
      if ("error" in result) toast.error(result.error);
      else {
        toast.success(method === "e_signature" ? "Contract signed." : "GCE will sign the contract with you in person.");
        router.refresh();
      }
    } finally {
      setSigning(false);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="contract-heading">
      <h2 id="contract-heading" className="font-medium tracking-tight">
        Your contract
      </h2>
      {contractState === "signed" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            You signed this contract{signedAt ? ` on ${format(new Date(signedAt), "MMM d, yyyy 'at' h:mm a")}` : ""}.
          </p>
          {/* T11: the buyer keeps a copy of the signed contract and the policy as a printable paper. */}
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link href={`/vehicle-papers/${transactionId}/contract`} data-testid="signed-copy-link">
              Signed contract / Policy
            </Link>
          </Button>
        </div>
      ) : contractState === "approved" ? (
        <p className="text-muted-foreground text-sm">
          Read the whole contract, then choose how to sign. No payment is taken before you sign.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          GCE is preparing your contract. You can read and sign it here once it is approved.
        </p>
      )}

      {contractBody ? (
        <section aria-label="Contract text" className="whitespace-pre-wrap rounded-md border p-3 text-sm">
          {contractBody}
        </section>
      ) : null}

      {contractState === "approved" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium text-sm">How do you want to sign?</legend>
            <RadioGroup value={method} onValueChange={(value) => setMethod(value as Method)}>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="e_signature" id="sign-e" />
                <Label htmlFor="sign-e" className="flex flex-col items-start gap-0.5 font-normal">
                  <span>E-signature</span>
                  <span className="text-muted-foreground text-xs">Sign now in the app.</span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="face_to_face" id="sign-f2f" />
                <Label htmlFor="sign-f2f" className="flex flex-col items-start gap-0.5 font-normal">
                  <span>Face-to-face</span>
                  <span className="text-muted-foreground text-xs">
                    Sign the printed contract in front of GCE staff at your visit, meet-up or delivery.
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </fieldset>

          {method === "e_signature" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contract-signed-name">Type your full name</Label>
                <Input
                  id="contract-signed-name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="font-medium text-sm">Draw your signature</p>
                <SignaturePad onChange={setSignature} />
              </div>
              <p className="text-muted-foreground text-xs">
                Your typed name, your drawn signature and the time are recorded as your signature.
              </p>
              <Button type="submit" className="self-start" disabled={signing || !name.trim() || !signature}>
                {signing ? "Signing..." : "Sign contract"}
              </Button>
            </>
          ) : faceToFaceChosen ? (
            <p className="text-sm">
              You chose face-to-face. GCE staff will have the printed contract ready; it is marked signed once you sign
              it in person.
            </p>
          ) : (
            <Button type="submit" className="self-start" disabled={signing}>
              {signing ? "Saving..." : "Sign face-to-face"}
            </Button>
          )}
        </form>
      ) : null}
    </section>
  );
}
