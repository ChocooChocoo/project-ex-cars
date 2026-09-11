"use client";
"use no memo";

import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { updateFieldCase } from "@/app/(staff)/field-cases/actions";
import { assignMechanic, createFieldCase } from "@/app/(staff)/transactions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TRANSACTION_STATE_LABELS, transactionKindLabel } from "@/lib/transactions/labels";
import type { TransactionKind, TransactionState } from "@/lib/transactions/state-machine";
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
  assigned_confidential_informant?: string | null;
  mechanic_id?: string | null;
}

export interface VehicleLookup {
  id: string;
  make: string;
  model: string;
  year: number;
  stock_code: string;
}

export interface TransactionLookup {
  id: string;
  transaction_kind: string;
  current_state: string;
  profiles?: { full_name: string | null } | null;
  vehicles?: VehicleLookup | null;
}

function transactionKindDisplayLabel(kind: string): string {
  return transactionKindLabel(kind as TransactionKind) || kind;
}

function vehicleDisplayLabel(vehicle: VehicleLookup): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.stock_code}`;
}

function transactionStateDisplayLabel(state: string): string {
  return TRANSACTION_STATE_LABELS[state as TransactionState] || state;
}

function transactionDisplayLabel(transaction: TransactionLookup): string {
  const customerName = transaction.profiles?.full_name?.trim();
  const vehicleLabel = transaction.vehicles ? vehicleDisplayLabel(transaction.vehicles) : null;
  const details = [customerName, vehicleLabel].filter(Boolean);

  return [
    transactionKindDisplayLabel(transaction.transaction_kind),
    transactionStateDisplayLabel(transaction.current_state),
    ...details,
    transaction.id.slice(0, 8),
  ].join(" · ");
}

// While a Radix Select is open inside a Dialog the select becomes the top dismissable
// layer and Radix sets pointer-events: none on the dialog content, so a click aimed at
// a dialog control is delivered to the dialog overlay instead and reads as an outside
// interaction. Whitelisting only the select's own portal is not enough — an empty
// option list has nothing to hit at all.
//
// The state has to be sampled while the event is still travelling down: on pointerdown
// Radix closes the select with flushSync, which removes data-state="open" before the
// event bubbles up to the dialog's handler. Reading the DOM inside the handler sees the
// select already closed and lets the dialog dismiss.
export function isSelectInteraction(target: EventTarget | null, selectWasOpenAtPointerDown = false): boolean {
  if (target instanceof Element && target.closest('[data-slot="select-content"]')) return true;
  if (selectWasOpenAtPointerDown) return true;
  return document.querySelector('[data-slot="select-content"][data-state="open"]') !== null;
}

function useSelectOpenAtPointerDown() {
  const selectWasOpen = useRef(false);

  useEffect(() => {
    const capture = () => {
      selectWasOpen.current = document.querySelector('[data-slot="select-content"][data-state="open"]') !== null;
    };
    document.addEventListener("pointerdown", capture, true);
    return () => document.removeEventListener("pointerdown", capture, true);
  }, []);

  return selectWasOpen;
}

interface FieldCasesClientProps {
  cases: FieldCaseRow[];
  canUpdate: boolean;
  canCreate: boolean;
  canAssignMechanic: boolean;
  informants: { id: string; full_name: string | null }[];
  mechanics: { id: string; full_name: string | null }[];
  userRole: string;
  currentUserId?: string | null;
  transactions?: TransactionLookup[];
  vehicles?: VehicleLookup[];
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

type FieldCasesQuickFilter = "all" | "needs_assignment" | "assigned_to_me";

export function FieldCasesClient({
  cases,
  canUpdate,
  canCreate,
  canAssignMechanic,
  informants,
  mechanics,
  userRole,
  currentUserId = null,
  transactions = [],
  vehicles = [],
}: FieldCasesClientProps) {
  const router = useRouter();
  const [quickFilter, setQuickFilter] = useState<FieldCasesQuickFilter>("all");

  const filteredCases = useMemo(() => {
    if (quickFilter === "needs_assignment") {
      return cases.filter((c) => !c.assigned_confidential_informant && !c.mechanic_id);
    }
    if (quickFilter === "assigned_to_me" && currentUserId) {
      return cases.filter(
        (c) => c.assigned_confidential_informant === currentUserId || c.mechanic_id === currentUserId,
      );
    }
    return cases;
  }, [cases, quickFilter, currentUserId]);
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
  const [createTransactionId, setCreateTransactionId] = useState("");
  const [createVehicleId, setCreateVehicleId] = useState("");
  const [createWorkerKind, setCreateWorkerKind] = useState<"informant" | "mechanic">("informant");
  const [createWorker, setCreateWorker] = useState("");
  const [createSchedule, setCreateSchedule] = useState("");
  const [createLocation, setCreateLocation] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [mechanicTarget, setMechanicTarget] = useState<FieldCaseRow | null>(null);
  const [mechanicId, setMechanicId] = useState("");
  const selectWasOpenAtPointerDown = useSelectOpenAtPointerDown();

  const allowedKinds = CASE_KIND_OPTIONS.filter((option) => CASE_KIND_RULES[option.value]?.includes(userRole)).map(
    (option) => option.value,
  );
  const workersForKind = createWorkerKind === "mechanic" ? mechanics : informants;
  const sortedVehicles = useMemo(
    () =>
      [...vehicles].sort((a, b) =>
        vehicleDisplayLabel(a).localeCompare(vehicleDisplayLabel(b), undefined, { numeric: true, sensitivity: "base" }),
      ),
    [vehicles],
  );
  const transactionGroups = useMemo(() => {
    const groups = new Map<string, TransactionLookup[]>();
    for (const transaction of transactions) {
      const group = groups.get(transaction.transaction_kind) ?? [];
      group.push(transaction);
      groups.set(transaction.transaction_kind, group);
    }

    return [...groups.entries()]
      .sort(([kindA], [kindB]) =>
        transactionKindDisplayLabel(kindA).localeCompare(transactionKindDisplayLabel(kindB), undefined, {
          sensitivity: "base",
        }),
      )
      .map(([kind, group]) => ({
        kind,
        transactions: group.sort((a, b) =>
          transactionDisplayLabel(a).localeCompare(transactionDisplayLabel(b), undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
      }));
  }, [transactions]);

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
    if (!createTransactionId && !createVehicleId) {
      setCreateError("Select a transaction or a vehicle to link this field case.");
      return;
    }
    if (!createWorker) {
      setCreateError("Assign an informant or a mechanic to this field case.");
      return;
    }
    setLoading(true);
    setCreateError(null);
    const fd = new FormData();
    fd.set("case_kind", createKind);
    if (createTransactionId) fd.set("transaction_id", createTransactionId);
    if (createVehicleId) fd.set("vehicle_id", createVehicleId);
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
    setCreateTransactionId("");
    setCreateVehicleId("");
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

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={1}
          aria-label="Field case quick filter"
          value={quickFilter}
          onValueChange={(value) => {
            if (value) setQuickFilter(value as FieldCasesQuickFilter);
          }}
          data-testid="field-case-quick-filter"
        >
          <ToggleGroupItem value="all" aria-label="All field cases">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="needs_assignment" aria-label="Needs assignment">
            Needs assignment
          </ToggleGroupItem>
          <ToggleGroupItem value="assigned_to_me" aria-label="Assigned to me">
            Assigned to me
          </ToggleGroupItem>
        </ToggleGroup>
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {filteredCases.length} / {cases.length}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Cases</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {cases.length === 0 ? (
            <p className="text-muted-foreground text-sm">No field cases assigned.</p>
          ) : filteredCases.length === 0 ? (
            <p className="text-muted-foreground text-sm">No field cases match this filter.</p>
          ) : (
            <FieldCasesTable
              cases={filteredCases}
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
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
          onInteractOutside={(event) => {
            if (isSelectInteraction(event.target, selectWasOpenAtPointerDown.current)) event.preventDefault();
          }}
        >
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
                  setCreateWorkerKind("informant");
                }}
              >
                <SelectTrigger aria-label="Select case kind">
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
              <FieldLabel>Transaction (at least one link required)</FieldLabel>
              <Select
                value={createTransactionId || "none"}
                onValueChange={(value) => setCreateTransactionId(value === "none" ? "" : value)}
              >
                <SelectTrigger aria-label="Select transaction">
                  <SelectValue placeholder="Select transaction" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectGroup>
                    <SelectLabel>None</SelectLabel>
                    <SelectItem value="none">No transaction</SelectItem>
                  </SelectGroup>
                  {transactionGroups.map((group) => (
                    <SelectGroup key={group.kind}>
                      <SelectLabel>{transactionKindDisplayLabel(group.kind)}</SelectLabel>
                      {group.transactions.map((transaction) => (
                        <SelectItem key={transaction.id} value={transaction.id}>
                          {transactionDisplayLabel(transaction)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Vehicle (at least one link required)</FieldLabel>
              <Select
                value={createVehicleId || "none"}
                onValueChange={(value) => setCreateVehicleId(value === "none" ? "" : value)}
              >
                <SelectTrigger aria-label="Select vehicle">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectGroup>
                    <SelectLabel>None</SelectLabel>
                    <SelectItem value="none">No vehicle</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Vehicles</SelectLabel>
                    {sortedVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicleDisplayLabel(vehicle)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">Link a transaction or a vehicle (at least one).</p>
            </Field>
            <Field>
              <FieldLabel>Assigned Worker</FieldLabel>
              <Select value={createWorker} onValueChange={setCreateWorker} disabled={workersForKind.length === 0}>
                <SelectTrigger aria-label="Select worker">
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
              {workersForKind.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No active {createWorkerKind === "mechanic" ? "mechanics" : "confidential informants"} available.
                </p>
              ) : null}
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
                  <SelectTrigger aria-label="Select worker type">
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
