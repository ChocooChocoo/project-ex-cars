"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { updateFieldCase } from "@/app/(staff)/field-cases/actions";
import { assignMechanic, createFieldCase } from "@/app/(staff)/transactions/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_CASE_STATES, type FieldCaseState } from "@/lib/validation/phase6";

import { FieldCasesTable } from "./field-cases-table";

export interface FieldCaseRow {
  id: string;
  case_kind: "acquisition" | "delivery" | "recovery" | "sourcing";
  state: FieldCaseState;
  vehicle_id: string | null;
  location: string | null;
  expenses_cents: number | null;
  notes: string | null;
  completion_date: string | null;
  created_at: string;
}

interface FieldCasesClientProps {
  cases: FieldCaseRow[];
  canUpdate: boolean;
  canCreate: boolean;
  canAssignMechanic: boolean;
  informants: { id: string; full_name: string | null }[];
  mechanics: { id: string; full_name: string | null }[];
  userRole: string;
}

const CASE_KIND_OPTIONS = [
  { value: "acquisition", label: "Acquisition" },
  { value: "delivery", label: "Delivery" },
  { value: "recovery", label: "Recovery" },
  { value: "sourcing", label: "Sourcing" },
] as const;

const CASE_KIND_RULES: Record<string, string[]> = {
  acquisition: ["ceo", "confidential_informant", "sales_manager"],
  delivery: ["ceo", "confidential_informant", "sales_manager"],
  recovery: ["ceo", "head_accountant"],
  sourcing: ["ceo", "sales_manager"],
};

export function FieldCasesClient({
  cases,
  canUpdate,
  canCreate,
  canAssignMechanic,
  informants,
  mechanics,
  userRole,
}: FieldCasesClientProps) {
  const router = useRouter();
  const [editTarget, setEditTarget] = useState<FieldCaseRow | null>(null);
  const [state, setState] = useState<FieldCaseState>("assigned");
  const [expenses, setExpenses] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<string>(
    () => CASE_KIND_OPTIONS.find((option) => CASE_KIND_RULES[option.value]?.includes(userRole))?.value ?? "",
  );
  const [createWorkerKind, setCreateWorkerKind] = useState<"informant" | "mechanic">("informant");
  const [createWorker, setCreateWorker] = useState("");
  const [createSchedule, setCreateSchedule] = useState("");
  const [createLocation, setCreateLocation] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [mechanicTarget, setMechanicTarget] = useState<FieldCaseRow | null>(null);
  const [mechanicId, setMechanicId] = useState("");

  const allowedKinds = CASE_KIND_OPTIONS.filter((option) => CASE_KIND_RULES[option.value]?.includes(userRole)).map(
    (option) => option.value,
  );
  const workersForKind = createWorkerKind === "mechanic" ? mechanics : informants;

  async function submitUpdate() {
    if (!editTarget) return;
    setLoading(true);
    setFormError(null);
    const fd = new FormData();
    fd.set("field_case_id", editTarget.id);
    fd.set("state", state);
    fd.set("expenses_cents", expenses);
    fd.set("notes", notes);
    const result = await updateFieldCase(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setFormError(result.error);
      return;
    }
    toast.success("Field case updated.");
    setEditTarget(null);
    router.refresh();
  }

  async function submitCreate() {
    setLoading(true);
    setCreateError(null);
    const fd = new FormData();
    fd.set("case_kind", createKind);
    if (createWorker) {
      if (createWorkerKind === "mechanic") fd.set("mechanic_id", createWorker);
      else fd.set("assigned_confidential_informant", createWorker);
    }
    if (createSchedule) fd.set("schedule", createSchedule);
    if (createLocation) fd.set("location", createLocation);
    if (createNotes) fd.set("notes", createNotes);
    const result = await createFieldCase(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setCreateError(result.error);
      return;
    }
    toast.success("Field case created.");
    setCreateOpen(false);
    setCreateKind(allowedKinds[0] ?? "");
    setCreateWorkerKind("informant");
    setCreateWorker("");
    setCreateSchedule("");
    setCreateLocation("");
    setCreateNotes("");
    router.refresh();
  }

  async function submitAssignMechanic() {
    if (!mechanicTarget || !mechanicId) return;
    setLoading(true);
    const fd = new FormData();
    fd.set("field_case_id", mechanicTarget.id);
    fd.set("mechanic_id", mechanicId);
    const result = await assignMechanic(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Mechanic assigned.");
    setMechanicTarget(null);
    setMechanicId("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Field Cases</h1>
          <p className="text-muted-foreground text-sm">Acquisition, delivery, sourcing, and recovery assignments.</p>
        </div>
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" />
            Create Field Case
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Cases</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {cases.length === 0 ? (
            <p className="text-muted-foreground text-sm">No field cases assigned.</p>
          ) : (
            <FieldCasesTable
              cases={cases}
              canUpdate={canUpdate}
              canAssignMechanic={canAssignMechanic}
              onAssignMechanic={(fieldCase) => {
                setMechanicTarget(fieldCase);
                setMechanicId("");
              }}
              onUpdate={(fieldCase) => {
                setEditTarget(fieldCase);
                setState(fieldCase.state);
                setExpenses(fieldCase.expenses_cents ? String(fieldCase.expenses_cents / 100) : "");
                setNotes(fieldCase.notes ?? "");
                setFormError(null);
              }}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update field case</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>State</FieldLabel>
              <Select value={state} onValueChange={(value) => setState(value as FieldCaseState)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {FIELD_CASE_STATES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Expenses (₱)</FieldLabel>
              <Input
                type="number"
                min="0"
                value={expenses}
                onChange={(e) => setExpenses(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field>
              <FieldLabel>Notes</FieldLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </Field>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitUpdate} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Field Case</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Case Kind</FieldLabel>
              <Select
                value={createKind}
                onValueChange={(value) => {
                  setCreateKind(value);
                  setCreateWorker("");
                  setCreateWorkerKind(value === "recovery" ? "informant" : "informant");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CASE_KIND_OPTIONS.filter((o) => allowedKinds.includes(o.value)).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {createKind === "recovery" ? (
                <p className="text-muted-foreground text-xs">Recovery cases are created by the Head Accountant.</p>
              ) : null}
            </Field>
            {allowedKinds.length === 0 ? (
              <p className="text-destructive text-sm">Your role cannot create any field case kind.</p>
            ) : null}
            <Field>
              <FieldLabel>Assigned Worker</FieldLabel>
              <Select value={createWorker} onValueChange={setCreateWorker}>
                <SelectTrigger>
                  <SelectValue placeholder="Select worker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {workersForKind.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.full_name ?? worker.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {createKind !== "recovery" ? (
              <Field>
                <FieldLabel>Worker Type</FieldLabel>
                <Select
                  value={createWorkerKind}
                  onValueChange={(value) => {
                    setCreateWorkerKind(value as "informant" | "mechanic");
                    setCreateWorker("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="informant">Confidential Informant</SelectItem>
                      <SelectItem value="mechanic">Mechanic</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <Field>
              <FieldLabel>Schedule (optional)</FieldLabel>
              <Input type="datetime-local" value={createSchedule} onChange={(e) => setCreateSchedule(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Location (optional)</FieldLabel>
              <Input value={createLocation} onChange={(e) => setCreateLocation(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Instructions (optional)</FieldLabel>
              <Textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} rows={3} />
            </Field>
            {createError ? <p className="text-destructive text-sm">{createError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitCreate} disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mechanicTarget !== null} onOpenChange={(open) => !open && setMechanicTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Mechanic</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-mechanic">Mechanic</Label>
              <Select value={mechanicId} onValueChange={setMechanicId}>
                <SelectTrigger id="assign-mechanic">
                  <SelectValue placeholder="Select mechanic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {mechanics.map((mechanic) => (
                      <SelectItem key={mechanic.id} value={mechanic.id}>
                        {mechanic.full_name ?? mechanic.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {mechanics.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active mechanics found.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setMechanicTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitAssignMechanic} disabled={loading || !mechanicId}>
              {loading ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
