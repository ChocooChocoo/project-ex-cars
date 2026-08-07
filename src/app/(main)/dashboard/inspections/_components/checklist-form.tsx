"use client";
"use no memo";

import { useState } from "react";

import { Check, Wrench, X } from "lucide-react";
import { toast } from "sonner";

import { submitChecklistAnswer } from "@/app/(main)/dashboard/vehicles/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ChecklistEntry {
  id: string;
  parent_id: string | null;
  level: "system" | "component" | "part";
  name: string;
  display_order: number;
}

interface ChecklistResult {
  id: string;
  inspection_id: string;
  checklist_entry_id: string;
  status: "good" | "for_repair" | "for_replacement";
  notes: string | null;
  part_replacements?: Array<{
    item_name: string;
    brand: string | null;
    estimated_cost: number | null;
  }>;
}

interface ChecklistFormProps {
  inspectionId: string;
  checklist: ChecklistEntry[];
  existingResults: ChecklistResult[];
}

const statusLabels: Record<string, string> = {
  good: "Good",
  for_repair: "For Repair",
  for_replacement: "For Replacement",
};

const levelIndent: Record<string, string> = {
  system: "ml-0",
  component: "ml-6",
  part: "ml-12",
};

const levelBadge: Record<string, string> = {
  system: "default",
  component: "secondary",
  part: "outline",
};

export function ChecklistForm({ inspectionId, checklist, existingResults }: ChecklistFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const r of existingResults) {
      map[r.checklist_entry_id] = r.status;
    }
    return map;
  });

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const r of existingResults) {
      if (r.notes) map[r.checklist_entry_id] = r.notes;
    }
    return map;
  });

  const [repairItems, setRepairItems] = useState<Record<string, { name: string; brand: string; cost: string }>>(() => {
    const map: Record<string, { name: string; brand: string; cost: string }> = {};
    for (const r of existingResults) {
      if (r.part_replacements && r.part_replacements.length > 0) {
        const pr = r.part_replacements[0];
        map[r.checklist_entry_id] = {
          name: pr.item_name,
          brand: pr.brand ?? "",
          cost: pr.estimated_cost ? String(pr.estimated_cost) : "",
        };
      }
    }
    return map;
  });

  const [submitting, setSubmitting] = useState<string | null>(null);

  async function handleSubmit(entryId: string) {
    const status = answers[entryId];
    if (!status) return;
    setSubmitting(entryId);

    const fd = new FormData();
    fd.set("inspection_id", inspectionId);
    fd.set("checklist_entry_id", entryId);
    fd.set("status", status);
    if (notes[entryId]) fd.set("notes", notes[entryId]);

    if (status !== "good") {
      const ri = repairItems[entryId];
      if (ri?.name) {
        fd.set("item_name", ri.name);
        if (ri.brand) fd.set("brand", ri.brand);
        if (ri.cost) fd.set("estimated_cost", ri.cost);
      }
    }

    const result = await submitChecklistAnswer(fd);
    setSubmitting(null);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Saved: ${statusLabels[status]}`);
    }
  }

  const systems = checklist.filter((c) => c.level === "system");
  const getChildren = (parentId: string) => checklist.filter((c) => c.parent_id === parentId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Inspection Checklist</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {checklist.length === 0 && (
          <p className="py-8 text-center text-muted-foreground text-sm">
            No checklist entries defined. Add systems, components, and parts to start inspecting.
          </p>
        )}
        {systems.map((system) => {
          const components = getChildren(system.id);
          return (
            <div key={system.id} className="space-y-1">
              <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 font-semibold text-sm">
                {system.name}
              </div>
              {components.length === 0 && getChildren(system.id).length === 0 && (
                <ChecklistRow
                  entry={system}
                  answers={answers}
                  setAnswers={setAnswers}
                  notes={notes}
                  setNotes={setNotes}
                  repairItems={repairItems}
                  setRepairItems={setRepairItems}
                  submitting={submitting}
                  onSave={handleSubmit}
                />
              )}
              {components.map((comp) => (
                <div key={comp.id}>
                  <div className="rounded-md bg-muted/30 px-3 py-1.5 font-medium text-muted-foreground text-xs">
                    {comp.name}
                  </div>
                  {getChildren(comp.id).length === 0 ? (
                    <ChecklistRow
                      entry={comp}
                      answers={answers}
                      setAnswers={setAnswers}
                      notes={notes}
                      setNotes={setNotes}
                      repairItems={repairItems}
                      setRepairItems={setRepairItems}
                      submitting={submitting}
                      onSave={handleSubmit}
                    />
                  ) : (
                    getChildren(comp.id).map((part) => (
                      <ChecklistRow
                        key={part.id}
                        entry={part}
                        answers={answers}
                        setAnswers={setAnswers}
                        notes={notes}
                        setNotes={setNotes}
                        repairItems={repairItems}
                        setRepairItems={setRepairItems}
                        submitting={submitting}
                        onSave={handleSubmit}
                      />
                    ))
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ChecklistRow({
  entry,
  answers,
  setAnswers,
  notes,
  setNotes,
  repairItems,
  setRepairItems,
  submitting,
  onSave,
}: {
  entry: ChecklistEntry;
  answers: Record<string, string>;
  setAnswers: (v: Record<string, string>) => void;
  notes: Record<string, string>;
  setNotes: (v: Record<string, string>) => void;
  repairItems: Record<string, { name: string; brand: string; cost: string }>;
  setRepairItems: (v: Record<string, { name: string; brand: string; cost: string }>) => void;
  submitting: string | null;
  onSave: (entryId: string) => Promise<void>;
}) {
  const current = answers[entry.id];
  const isLoading = submitting === entry.id;

  return (
    <div className={`${levelIndent[entry.level]} space-y-2 rounded-md border px-3 py-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={levelBadge[entry.level] as "default" | "secondary" | "outline"}
            className="text-xs capitalize"
          >
            {entry.level}
          </Badge>
          <span className="text-sm">{entry.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={current ?? ""}
            onValueChange={(v) => {
              setAnswers({ ...answers, [entry.id]: v });
              if (v === "good") {
                setRepairItems({ ...repairItems, [entry.id]: { name: "", brand: "", cost: "" } });
              }
            }}
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="good">
                  <Check className="mr-1 size-3 text-green-600" /> Good
                </SelectItem>
                <SelectItem value="for_repair">
                  <Wrench className="mr-1 size-3 text-amber-600" /> For Repair
                </SelectItem>
                <SelectItem value="for_replacement">
                  <X className="mr-1 size-3 text-red-600" /> For Replacement
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => onSave(entry.id)} disabled={isLoading}>
            {isLoading ? "..." : "Save"}
          </Button>
        </div>
      </div>

      {current && current !== "good" && (
        <FieldGroup className="gap-2">
          <div className="grid grid-cols-3 gap-2">
            <Field>
              <FieldLabel>Part Name</FieldLabel>
              <Input
                placeholder="Brake pads"
                value={repairItems[entry.id]?.name ?? ""}
                onChange={(e) =>
                  setRepairItems({
                    ...repairItems,
                    [entry.id]: {
                      ...(repairItems[entry.id] ?? { name: "", brand: "", cost: "" }),
                      name: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field>
              <FieldLabel>Brand</FieldLabel>
              <Input
                placeholder="Brembo"
                value={repairItems[entry.id]?.brand ?? ""}
                onChange={(e) =>
                  setRepairItems({
                    ...repairItems,
                    [entry.id]: {
                      ...(repairItems[entry.id] ?? { name: "", brand: "", cost: "" }),
                      brand: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field>
              <FieldLabel>Est. Cost</FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">₱</InputGroupAddon>
                <InputGroupInput
                  type="number"
                  placeholder="5000"
                  value={repairItems[entry.id]?.cost ?? ""}
                  onChange={(e) =>
                    setRepairItems({
                      ...repairItems,
                      [entry.id]: {
                        ...(repairItems[entry.id] ?? { name: "", brand: "", cost: "" }),
                        cost: e.target.value,
                      },
                    })
                  }
                />
              </InputGroup>
            </Field>
          </div>
          <Field>
            <FieldLabel>Notes</FieldLabel>
            <Textarea
              rows={2}
              placeholder="Details..."
              value={notes[entry.id] ?? ""}
              onChange={(e) => setNotes({ ...notes, [entry.id]: e.target.value })}
            />
          </Field>
        </FieldGroup>
      )}
    </div>
  );
}
