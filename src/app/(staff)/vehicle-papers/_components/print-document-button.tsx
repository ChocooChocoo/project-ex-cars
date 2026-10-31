"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintDocumentButton({ label }: { readonly label: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer data-icon="inline-start" />
      {label}
    </Button>
  );
}
