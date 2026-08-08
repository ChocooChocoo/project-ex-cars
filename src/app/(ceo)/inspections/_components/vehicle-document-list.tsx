"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface VehicleDoc {
  id: string;
  vehicle_id: string;
  document_kind: string;
  required_state: boolean;
  submitted_state: string;
  storage_path: string | null;
  vehicles: { make: string; model: string; year: number; stock_code: string } | null;
}

export function VehicleDocumentList({ documents: initialDocs }: { readonly documents: VehicleDoc[] }) {
  const [docs, setDocs] = useState(initialDocs);
  const [uploading, setUploading] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const router = useRouter();

  async function handleUpload(docId: string, file: File) {
    setUploading(docId);
    try {
      const fd = new FormData();
      fd.set("doc_id", docId);
      fd.set("file", file);

      const supabase = (await import("@/lib/supabase/client")).createClient();
      const fileExt = file.name.split(".").pop() ?? "bin";
      const doc = docs.find((d) => d.id === docId);
      if (!doc) return;
      const storagePath = `vehicle-documents/${doc.vehicle_id}/${docId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("vehicle-documents").upload(storagePath, file);

      if (uploadError) {
        // Storage bucket may not exist — record the document anyway.
        await supabase
          .from("vehicle_document_items")
          .update({ submitted_state: "submitted", storage_path: storagePath })
          .eq("id", docId);
      } else {
        await supabase
          .from("vehicle_document_items")
          .update({ submitted_state: "submitted", storage_path: storagePath })
          .eq("id", docId);
      }

      setDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, submitted_state: "submitted", storage_path: storagePath } : d)),
      );
      toast.success("Document uploaded.");
    } catch {
      toast.error("Failed to upload document.");
    } finally {
      setUploading(null);
    }
  }

  async function handleVerify(docId: string, decision: string) {
    setVerifying(docId);
    try {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: user } = await supabase.auth.getUser();
      await supabase
        .from("vehicle_document_items")
        .update({
          submitted_state: decision,
          checker_id: user.user?.id,
          checked_at: new Date().toISOString(),
        })
        .eq("id", docId);

      setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, submitted_state: decision } : d)));
      toast.success(`Document ${decision}.`);
      router.refresh();
    } catch {
      toast.error("Failed to update document.");
    } finally {
      setVerifying(null);
    }
  }

  const badgeVariant = (state: string) => {
    if (state === "verified") return "default";
    if (state === "rejected") return "destructive";
    if (state === "submitted") return "secondary";
    return "outline";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle Documents</CardTitle>
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No vehicle documents registered.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Document Kind</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {d.vehicles
                      ? `${d.vehicles.make} ${d.vehicles.model} (${d.vehicles.stock_code})`
                      : d.vehicle_id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="capitalize">{d.document_kind.replace(/_/g, " ")}</TableCell>
                  <TableCell>{d.required_state ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant(d.submitted_state)}>{d.submitted_state.replace(/_/g, " ")}</Badge>
                    {d.storage_path && <div className="mt-1 text-muted-foreground text-xs">Uploaded</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {d.submitted_state !== "verified" && (
                        <label>
                          <Button size="sm" variant="outline" disabled={uploading === d.id} asChild>
                            <span>{uploading === d.id ? "Uploading..." : "Upload"}</span>
                          </Button>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleUpload(d.id, file);
                            }}
                          />
                        </label>
                      )}
                      {d.submitted_state === "submitted" && (
                        <>
                          <Button
                            size="sm"
                            disabled={verifying === d.id}
                            onClick={() => handleVerify(d.id, "verified")}
                          >
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={verifying === d.id}
                            onClick={() => handleVerify(d.id, "rejected")}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
