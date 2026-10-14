"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import { signContract } from "@/app/(customer)/my-transactions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The buyer reads the contract the Head Accountant approved and signs it with a typed full name.
// Before approval there is nothing to read or sign, so only the wait is explained.
export function ContractSign({
  transactionId,
  contractState,
  contractBody,
  signedAt,
}: {
  readonly transactionId: string;
  readonly contractState: string | null;
  readonly contractBody: string | null;
  readonly signedAt: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [signing, setSigning] = useState(false);

  async function sign() {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    fd.set("signed_name", name);
    setSigning(true);
    const result = await signContract(fd);
    setSigning(false);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Contract signed.");
      router.refresh();
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="contract-heading">
      <h2 id="contract-heading" className="font-medium tracking-tight">
        Your contract
      </h2>
      {contractState === "signed" ? (
        <p className="text-sm">
          You signed this contract{signedAt ? ` on ${format(new Date(signedAt), "MMM d, yyyy 'at' h:mm a")}` : ""}.
        </p>
      ) : contractState === "approved" ? (
        <p className="text-muted-foreground text-sm">
          Read the whole contract, then sign below. No payment is taken before you sign.
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
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sign();
          }}
        >
          <Label htmlFor="contract-signed-name">Type your full name to sign</Label>
          <Input
            id="contract-signed-name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-describedby="contract-sign-hint"
          />
          <p id="contract-sign-hint" className="text-muted-foreground text-xs">
            Your typed name and the time are recorded as your signature.
          </p>
          <Button type="submit" className="self-start" disabled={signing || !name.trim()}>
            {signing ? "Signing..." : "Sign contract"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
