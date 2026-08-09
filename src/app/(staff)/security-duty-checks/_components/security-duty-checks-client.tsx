"use client";
"use no memo";

import { useCallback, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
  type ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table";
import { Camera, CheckCircle2, Grid2X2, List, Plus, Table2 } from "lucide-react";
import { toast } from "sonner";

import { completeDutyCheck, startDutyCheck, uploadDutyEvidence } from "@/app/(staff)/security-duty-checks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { DutyEvidenceControl, type DutyEvidenceSlot, type DutyEvidenceUpload } from "./duty-evidence-control";

export interface DutyCheckRow {
  id: string;
  duty_date: string;
  before_image_path: string | null;
  after_image_path: string | null;
  notes: string | null;
  status: "pending" | "in_progress" | "completed";
  completed_at: string | null;
}

export type DutyCheckView = "table" | "list" | "grid";

interface SecurityDutyChecksClientProps {
  checks: DutyCheckRow[];
  canManage: boolean;
}

interface DutyCheckEvidenceProps {
  check: DutyCheckRow;
  canManage: boolean;
  uploadingId: string | null;
  onUpload: DutyEvidenceUpload;
}

function formatDutyDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function isDutyCheckView(value: string): value is DutyCheckView {
  return value === "table" || value === "list" || value === "grid";
}

function statusVariant(status: DutyCheckRow["status"]): "default" | "secondary" | "outline" {
  if (status === "completed") return "default";
  if (status === "in_progress") return "secondary";
  return "outline";
}

function renderStatus(status: DutyCheckRow["status"]) {
  return <Badge variant={statusVariant(status)}>{status.replace(/_/g, " ")}</Badge>;
}

function DutyCheckEvidence({ check, canManage, uploadingId, onUpload }: DutyCheckEvidenceProps) {
  const disabled = check.status === "completed";
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      {(["before", "after"] as const).map((slot: DutyEvidenceSlot) => (
        <DutyEvidenceControl
          key={slot}
          checkId={check.id}
          dutyDate={check.duty_date}
          slot={slot}
          path={slot === "before" ? check.before_image_path : check.after_image_path}
          canManage={canManage}
          disabled={disabled}
          uploading={uploadingId === `${check.id}-${slot}`}
          onUpload={onUpload}
        />
      ))}
    </div>
  );
}

interface DutyCheckActionProps {
  check: DutyCheckRow;
  canManage: boolean;
  onComplete: (id: string) => Promise<void>;
}

function DutyCheckAction({ check, canManage, onComplete }: DutyCheckActionProps) {
  if (!canManage || check.status === "completed") return null;
  const canComplete = Boolean(check.before_image_path && check.after_image_path);
  return (
    <Button size="sm" disabled={!canComplete} onClick={() => void onComplete(check.id)}>
      <CheckCircle2 data-icon="inline-start" />
      Complete Check
    </Button>
  );
}

interface DutyCheckTableProps {
  checks: DutyCheckRow[];
  canManage: boolean;
  uploadingId: string | null;
  onUpload: DutyEvidenceUpload;
  onComplete: (id: string) => Promise<void>;
}

function DutyCheckTable({ checks, canManage, uploadingId, onUpload, onComplete }: DutyCheckTableProps) {
  const columns = useMemo<ColumnDef<DutyCheckRow>[]>(
    () => [
      {
        accessorKey: "duty_date",
        header: "Date",
        cell: ({ row }) => <span data-testid="duty-check-date">{formatDutyDate(row.original.duty_date)}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => renderStatus(row.original.status),
      },
      {
        id: "before",
        header: "Before",
        cell: ({ row }) => (
          <DutyEvidenceControl
            checkId={row.original.id}
            dutyDate={row.original.duty_date}
            slot="before"
            path={row.original.before_image_path}
            canManage={canManage}
            disabled={row.original.status === "completed"}
            uploading={uploadingId === `${row.original.id}-before`}
            onUpload={onUpload}
          />
        ),
      },
      {
        id: "after",
        header: "After",
        cell: ({ row }) => (
          <DutyEvidenceControl
            checkId={row.original.id}
            dutyDate={row.original.duty_date}
            slot="after"
            path={row.original.after_image_path}
            canManage={canManage}
            disabled={row.original.status === "completed"}
            uploading={uploadingId === `${row.original.id}-after`}
            onUpload={onUpload}
          />
        ),
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.notes ?? "—"}</span>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => <DutyCheckAction check={row.original} canManage={canManage} onComplete={onComplete} />,
      },
    ],
    [canManage, onComplete, onUpload, uploadingId],
  );

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const table = useReactTable({
    data: checks,
    columns,
    state: { pagination },
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{checks.length} duty checks</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 px-0 pb-0">
        <div className="min-w-0 overflow-x-auto">
          <DataTable table={table} rowsPerPageId="security-duty-checks-rows-per-page" />
        </div>
      </CardContent>
    </Card>
  );
}

interface DutyCheckListProps {
  checks: DutyCheckRow[];
  canManage: boolean;
  uploadingId: string | null;
  onUpload: DutyEvidenceUpload;
  onComplete: (id: string) => Promise<void>;
}

function DutyCheckList({ checks, canManage, uploadingId, onUpload, onComplete }: DutyCheckListProps) {
  return (
    <ItemGroup>
      {checks.map((check) => (
        <Item key={check.id} role="listitem" variant="outline" data-testid="duty-check-item" className="items-start">
          <ItemContent>
            <ItemHeader>
              <ItemTitle data-testid="duty-check-date">{formatDutyDate(check.duty_date)}</ItemTitle>
              <ItemActions>{renderStatus(check.status)}</ItemActions>
            </ItemHeader>
            <ItemDescription>{check.notes ?? "No notes recorded."}</ItemDescription>
            <DutyCheckEvidence check={check} canManage={canManage} uploadingId={uploadingId} onUpload={onUpload} />
            <ItemFooter>
              <DutyCheckAction check={check} canManage={canManage} onComplete={onComplete} />
            </ItemFooter>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}

interface DutyCheckGridProps {
  checks: DutyCheckRow[];
  canManage: boolean;
  uploadingId: string | null;
  onUpload: DutyEvidenceUpload;
  onComplete: (id: string) => Promise<void>;
}

function DutyCheckGrid({ checks, canManage, uploadingId, onUpload, onComplete }: DutyCheckGridProps) {
  return (
    <div data-testid="duty-check-grid" className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {checks.map((check) => (
        <Card key={check.id} data-testid="duty-check-card" className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle data-testid="duty-check-date" className="text-base">
                {formatDutyDate(check.duty_date)}
              </CardTitle>
              {renderStatus(check.status)}
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <DutyCheckEvidence check={check} canManage={canManage} uploadingId={uploadingId} onUpload={onUpload} />
            {check.notes ? <p className="text-muted-foreground text-xs">{check.notes.slice(0, 120)}</p> : null}
            <div className="mt-auto flex items-center justify-end">
              <DutyCheckAction check={check} canManage={canManage} onComplete={onComplete} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SecurityDutyChecksClient({ checks, canManage }: SecurityDutyChecksClientProps) {
  const router = useRouter();
  const [view, setView] = useState<DutyCheckView>("table");
  const [formOpen, setFormOpen] = useState(false);
  const [dutyDate, setDutyDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

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

  const submitUpload = useCallback<DutyEvidenceUpload>(
    async (id, slot, file) => {
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
    },
    [router],
  );

  const submitComplete = useCallback(
    async (id: string) => {
      const fd = new FormData();
      fd.set("duty_check_id", id);
      const result = await completeDutyCheck(fd);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Duty check completed.");
      router.refresh();
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Security Duty Checks</h1>
          <p className="text-muted-foreground text-sm">Before-and-after evidence for security shifts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => {
              if (isDutyCheckView(value)) setView(value);
            }}
            variant="outline"
            size="sm"
            aria-label="Duty check view"
          >
            <ToggleGroupItem value="table" aria-label="Table">
              <Table2 data-icon="inline-start" />
              Table
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List">
              <List data-icon="inline-start" />
              List
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid">
              <Grid2X2 data-icon="inline-start" />
              Grid
            </ToggleGroupItem>
          </ToggleGroup>
          {canManage ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus data-icon="inline-start" />
              Start Check
            </Button>
          ) : null}
        </div>
      </div>

      {checks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Camera className="size-8 text-muted-foreground" />
            <p className="text-muted-foreground">No duty checks recorded.</p>
          </CardContent>
        </Card>
      ) : view === "table" ? (
        <DutyCheckTable
          checks={checks}
          canManage={canManage}
          uploadingId={uploadingId}
          onUpload={submitUpload}
          onComplete={submitComplete}
        />
      ) : view === "list" ? (
        <DutyCheckList
          checks={checks}
          canManage={canManage}
          uploadingId={uploadingId}
          onUpload={submitUpload}
          onComplete={submitComplete}
        />
      ) : (
        <DutyCheckGrid
          checks={checks}
          canManage={canManage}
          uploadingId={uploadingId}
          onUpload={submitUpload}
          onComplete={submitComplete}
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Duty Check</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Duty Date</FieldLabel>
              <Input type="date" value={dutyDate} onChange={(event) => setDutyDate(event.target.value)} />
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
