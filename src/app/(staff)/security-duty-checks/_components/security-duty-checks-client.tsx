"use client";
"use no memo";

import { useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { Camera, CheckCircle2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

import { completeDutyCheck, startDutyCheck, uploadDutyEvidence } from "@/app/(staff)/security-duty-checks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface DutyCheckRow {
  id: string;
  duty_date: string;
  before_image_path: string | null;
  after_image_path: string | null;
  notes: string | null;
  status: "pending" | "in_progress" | "completed";
  completed_at: string | null;
}

interface SecurityDutyChecksClientProps {
  checks: DutyCheckRow[];
  canManage: boolean;
}

export function SecurityDutyChecksClient({ checks, canManage }: SecurityDutyChecksClientProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [dutyDate, setDutyDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  async function submitStart() {
    setLoading(true);
    setFormError(null);
    const fd = new FormData();
    fd.set("duty_date", dutyDate);
    const result = await startDutyCheck(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setFormError(result.error);
      return;
    }
    toast.success("Duty check started.");
    setFormOpen(false);
    setDutyDate("");
    router.refresh();
  }

  async function submitUpload(id: string, slot: "before" | "after", file: File | undefined) {
    if (!file) {
      toast.error("Select an image first.");
      return;
    }
    setUploadingId(`${id}-${slot}`);
    const fd = new FormData();
    fd.set("duty_check_id", id);
    fd.set("slot", slot);
    fd.set("image", file);
    const result = await uploadDutyEvidence(fd);
    setUploadingId(null);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(slot === "before" ? "Before image uploaded." : "After image uploaded.");
    router.refresh();
  }

  async function submitComplete(id: string) {
    const fd = new FormData();
    fd.set("duty_check_id", id);
    const result = await completeDutyCheck(fd);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Duty check completed.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Security Duty Checks</h1>
          <p className="text-muted-foreground text-sm">Before-and-after evidence for security shifts.</p>
        </div>
        {canManage ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus data-icon="inline-start" />
            Start Check
          </Button>
        ) : null}
      </div>

      {checks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Camera className="size-8 text-muted-foreground" />
            <p className="text-muted-foreground">No duty checks recorded.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((check) => (
            <Card key={check.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{new Date(check.duty_date).toLocaleDateString()}</CardTitle>
                  <Badge
                    variant={
                      check.status === "completed"
                        ? "default"
                        : check.status === "in_progress"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {check.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border p-3">
                    <span className="text-muted-foreground text-xs">Before</span>
                    <p className="font-medium">{check.before_image_path ? "Uploaded" : "Pending"}</p>
                    {canManage && check.status !== "completed" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        disabled={uploadingId === `${check.id}-before`}
                        onClick={() => beforeRef.current?.click()}
                      >
                        <Upload data-icon="inline-start" />
                        {uploadingId === `${check.id}-before` ? "Uploading..." : "Upload"}
                      </Button>
                    ) : null}
                  </div>
                  <div className="rounded-lg border p-3">
                    <span className="text-muted-foreground text-xs">After</span>
                    <p className="font-medium">{check.after_image_path ? "Uploaded" : "Pending"}</p>
                    {canManage && check.status !== "completed" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        disabled={uploadingId === `${check.id}-after`}
                        onClick={() => afterRef.current?.click()}
                      >
                        <Upload data-icon="inline-start" />
                        {uploadingId === `${check.id}-after` ? "Uploading..." : "Upload"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {canManage ? (
                  <input
                    ref={beforeRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      void submitUpload(check.id, "before", e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                ) : null}
                {canManage ? (
                  <input
                    ref={afterRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      void submitUpload(check.id, "after", e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                ) : null}
                {check.notes ? <p className="text-muted-foreground text-xs">{check.notes.slice(0, 120)}</p> : null}
                {canManage && check.status !== "completed" ? (
                  <Button
                    size="sm"
                    disabled={!check.before_image_path || !check.after_image_path}
                    onClick={() => submitComplete(check.id)}
                  >
                    <CheckCircle2 data-icon="inline-start" />
                    Complete Check
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Duty Check</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Duty Date</FieldLabel>
              <Input type="date" value={dutyDate} onChange={(e) => setDutyDate(e.target.value)} />
            </Field>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitStart} disabled={loading}>
              {loading ? "Starting..." : "Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
