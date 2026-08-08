"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { updateFieldCase } from "@/app/(ceo)/field-cases/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_CASE_STATES, type FieldCaseState } from "@/lib/validation/phase6";

const STATE_VARIANTS: Record<FieldCaseState, "default" | "secondary" | "outline" | "destructive"> = {
  assigned: "secondary",
  accepted: "default",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

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
}

export function FieldCasesClient({ cases, canUpdate }: FieldCasesClientProps) {
  const router = useRouter();
  const [editTarget, setEditTarget] = useState<FieldCaseRow | null>(null);
  const [state, setState] = useState<FieldCaseState>("assigned");
  const [expenses, setExpenses] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Field Cases</h1>
        <p className="text-muted-foreground text-sm">Acquisition, delivery, sourcing, and recovery assignments.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Kind</th>
                  <th className="px-2 py-2 font-medium">State</th>
                  <th className="px-2 py-2 font-medium">Vehicle</th>
                  <th className="px-2 py-2 font-medium">Location</th>
                  <th className="px-2 py-2 font-medium">Expenses</th>
                  <th className="px-2 py-2 font-medium">Completed</th>
                  {canUpdate ? <th className="px-2 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 ? (
                  <tr>
                    <td colSpan={canUpdate ? 7 : 6} className="px-2 py-6 text-center text-muted-foreground">
                      No field cases assigned.
                    </td>
                  </tr>
                ) : (
                  cases.map((fieldCase) => (
                    <tr key={fieldCase.id} className="border-b last:border-0">
                      <td className="px-2 py-2 font-medium capitalize">{fieldCase.case_kind}</td>
                      <td className="px-2 py-2">
                        <Badge variant={STATE_VARIANTS[fieldCase.state]} className="capitalize">
                          {fieldCase.state.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {fieldCase.vehicle_id ? fieldCase.vehicle_id.slice(0, 8) : "—"}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{fieldCase.location ?? "—"}</td>
                      <td className="px-2 py-2">₱{((fieldCase.expenses_cents ?? 0) / 100).toLocaleString()}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {fieldCase.completion_date ? new Date(fieldCase.completion_date).toLocaleDateString() : "—"}
                      </td>
                      {canUpdate ? (
                        <td className="px-2 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditTarget(fieldCase);
                              setState(fieldCase.state);
                              setExpenses(fieldCase.expenses_cents ? String(fieldCase.expenses_cents / 100) : "");
                              setNotes(fieldCase.notes ?? "");
                              setFormError(null);
                            }}
                          >
                            <Pencil data-icon="inline-start" />
                            Update
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}
