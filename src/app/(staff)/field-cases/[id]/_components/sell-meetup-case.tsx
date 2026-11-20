"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import {
  confirmFieldCheck,
  recordFieldPrice,
  reportInspection,
} from "@/app/(staff)/field-cases/sell-inspection-actions";
import {
  buildChecklistTree,
  CHECKLIST_LEVEL_BADGE,
  CHECKLIST_LEVEL_INDENT,
  type ChecklistEntry,
  checklistLeafNodes,
} from "@/app/(staff)/inspections/_components/checklist-form";
import { MeetupMap } from "@/components/maps/lazy-maps";
import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { InspectionResult, type InspectionResultData } from "@/components/transactions/inspection-result";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { transactionDocumentLabel } from "@/lib/transactions/document-media";
import { SELL_MEETUP_METHOD_LABELS, type SellMeetupMethod } from "@/lib/transactions/sell-flow";
import { compressFormFiles } from "@/lib/uploads/compress-image";
import { formatCurrency } from "@/lib/utils";

import { FieldExpensesCard } from "./field-expenses-card";
import { NoExpensesButton } from "./no-expenses-button";

type Row = Record<string, unknown>;
type Result = { error: string } | { success: true };

/** One answered part while the Mechanic fills the card in. */
type Answer = { status: "good" | "for_repair"; cost: string; note: string };

const EMPTY_ANSWER: Answer = { status: "good", cost: "", note: "" };

/** The seller's ticked parts (`sell_details.condition_items` is JSON, and reaches the page either parsed or raw). */
function declaredPartIds(value: unknown): string[] {
  const parsed = Array.isArray(value)
    ? value
    : (() => {
        try {
          const decoded = JSON.parse(String(value ?? "[]"));
          return Array.isArray(decoded) ? decoded : [];
        } catch {
          return [];
        }
      })();

  return parsed.filter((id): id is string => typeof id === "string");
}

export function SellMeetupCase({
  fieldCase,
  transaction,
  sellDetails,
  documents,
  expenses,
  inspection,
  checklist,
  userRole,
  userId,
}: {
  readonly fieldCase: Row;
  readonly transaction: Row;
  readonly sellDetails: Row | null;
  readonly documents: Row[];
  readonly expenses: Row[];
  readonly inspection?: InspectionResultData | null;
  readonly checklist?: ChecklistEntry[];
  readonly userRole: string;
  readonly userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [photos, setPhotos] = useState<Record<string, File[]>>({});
  const [priceStatus, setPriceStatus] = useState("");
  const [updatedPrice, setUpdatedPrice] = useState("");
  const [discount, setDiscount] = useState("");

  const caseId = fieldCase.id as string;
  const isInformant = userRole === "confidential_informant" && fieldCase.assigned_confidential_informant === userId;
  const isMechanic = userRole === "mechanic" && fieldCase.mechanic_id === userId;
  const open = !["completed", "cancelled"].includes(fieldCase.state as string);
  const vehicle = transaction.vehicles as Row | null;
  const seller = transaction.profiles as Row | null;
  const method = sellDetails?.meetup_method as SellMeetupMethod | undefined;
  const meetupPoint =
    sellDetails?.meetup_lat != null && sellDetails?.meetup_lng != null
      ? { lat: Number(sellDetails.meetup_lat), lng: Number(sellDetails.meetup_lng) }
      : null;
  const checksDone = Boolean(fieldCase.identity_confirmed_at && fieldCase.plate_confirmed_at);
  // SN-7: the header names the real arrangement; the same labels the case notes use.
  const arrangementLabel =
    method === "meet_halfway"
      ? "Seller meet-up (Meet Halfway)"
      : method === "gce_visit"
        ? "GCE visit"
        : "Seller meet-up";
  const halfway = method === "meet_halfway";
  // SN-8: a GCE visit needs no expense report; a halfway trip needs filed expenses or the explicit "none" answer.
  const noExpensesAt = fieldCase.no_expenses_at as string | null | undefined;
  const canRecordNoExpenses = halfway && isInformant && open && expenses.length === 0 && !noExpensesAt;

  // SH-7: the seller ticked these parts on the sell form; a Needs-repair answer on any other part is a hidden issue.
  const declaredIds = new Set(declaredPartIds(sellDetails?.condition_items));
  const leafParts = checklistLeafNodes(checklist ?? []);
  const tree = buildChecklistTree(checklist ?? []);
  const answeredCount = leafParts.filter((part) => answers[part.id]).length;
  const missingStatuses = leafParts.filter((part) => !answers[part.id]?.status);
  const estimatedTotal = leafParts.reduce(
    (total, part) => total + (answers[part.id]?.status === "for_repair" ? Number(answers[part.id].cost || 0) : 0),
    0,
  );
  const repairRows = leafParts.filter((part) => answers[part.id]?.status === "for_repair");

  function answer(nodeId: string): Answer {
    return answers[nodeId] ?? EMPTY_ANSWER;
  }

  function setAnswer(nodeId: string, patch: Partial<Answer>) {
    setAnswers((prev) => ({ ...prev, [nodeId]: { ...(prev[nodeId] ?? EMPTY_ANSWER), ...patch } }));
  }

  function setPhotosFor(nodeId: string, files: File[]) {
    setPhotos((prev) => ({ ...prev, [nodeId]: files }));
  }

  async function send(action: (fd: FormData) => Promise<Result>, fd: FormData, message: string) {
    fd.set("field_case_id", caseId);
    setBusy(true);
    const result = await action(await compressFormFiles(fd));
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    toast.success(message);
    router.refresh();
    return true;
  }

  function check(kind: "identity" | "plate") {
    const fd = new FormData();
    fd.set("check", kind);
    void send(confirmFieldCheck, fd, kind === "identity" ? "Identity confirmed." : "Plate and chassis confirmed.");
  }

  async function submitInspection() {
    if (missingStatuses.length > 0) {
      toast.error("Answer every part of the checklist.");
      return;
    }
    const withoutCost = repairRows.filter((part) => answer(part.id).cost === "");
    if (withoutCost.length > 0) {
      toast.error("Give the repair cost of every part that needs repair.");
      return;
    }
    const withoutPhoto = repairRows.filter((part) => (photos[part.id] ?? []).length === 0);
    if (withoutPhoto.length > 0) {
      toast.error("Attach at least one photo of every part that needs repair.");
      return;
    }
    const fd = new FormData();
    fd.set(
      "results",
      JSON.stringify(
        leafParts.map((part) => ({
          node_id: part.id,
          status: answer(part.id).status,
          cost: answer(part.id).status === "for_repair" ? answer(part.id).cost : null,
          note: answer(part.id).note,
        })),
      ),
    );
    for (const part of repairRows) {
      // No `[]` here: laravelForm appends the brackets itself when a key repeats, so a part with two
      // photos would otherwise arrive as result_photo_x[][] and be seen as not attached at all.
      for (const file of photos[part.id] ?? []) fd.append(`result_photo_${part.id}`, file);
    }
    await send(reportInspection, fd, "Inspection reported.");
  }

  async function submitPrice() {
    setBusy(true);
    const result = await recordFieldPrice(caseId, { status: priceStatus, updatedPrice, discountAmount: discount });
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(priceStatus === "negotiated" ? "Confirmed price kept." : "Price updated. The office was notified.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/dashboard/field-cases" className="text-muted-foreground text-sm underline">
          Back to field cases
        </Link>
        <h1 className="text-3xl leading-none tracking-tight">{arrangementLabel}</h1>
        <p className="text-muted-foreground text-sm">
          {fieldCase.schedule ? format(new Date(fieldCase.schedule as string), "MMM d, yyyy h:mm a") : "No schedule"} ·{" "}
          {String(fieldCase.location ?? "No location")}
          {method ? ` · ${SELL_MEETUP_METHOD_LABELS[method]}` : ""}
        </p>
      </div>

      {/* T12 / SH-14: the pin the seller set on the map, read-only, right here in the app (SH-8: no external link). */}
      {method === "meet_halfway" && meetupPoint ? (
        <Card>
          <CardHeader>
            <CardTitle>Meet-up point</CardTitle>
            <CardDescription>Where the seller set the halfway point. Meet-ups stay inside CALABARZON.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <MeetupMap value={meetupPoint} editable={false} />
            {sellDetails?.meetup_address ? <p>{String(sellDetails.meetup_address)}</p> : null}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Case pack</CardTitle>
            <CardDescription>Everything the field team needs before meeting the seller.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Seller: </span>
              {String(seller?.full_name ?? "—")} {seller?.phone ? `· ${seller.phone}` : ""}
            </p>
            <p>
              <span className="text-muted-foreground">Vehicle: </span>
              {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.stock_code})` : "—"}
              {vehicle?.mileage ? ` · ${Number(vehicle.mileage).toLocaleString()} km` : ""}
            </p>
            <p>
              <span className="text-muted-foreground">Agreed price: </span>
              {sellDetails?.agreed_price ? formatCurrency(Number(sellDetails.agreed_price)) : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Declared issues: </span>
              {sellDetails?.has_known_issues ? String(sellDetails.declared_issues ?? "") : "No known issue"}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {documents.map((doc) => {
                const label = transactionDocumentLabel(doc.document_kind);
                const url = typeof doc.signed_url === "string" ? doc.signed_url : null;
                return (
                  <div key={doc.id as string} className="flex flex-col gap-1 rounded-md border p-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs">{label}</span>
                      <Badge variant="secondary" className="text-[11px]">
                        {String(doc.verification_state)}
                      </Badge>
                    </div>
                    {url && doc.is_image === true ? (
                      <TransactionImagePreview src={url} alt={`${label} preview`} />
                    ) : url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="text-primary text-xs underline">
                        Open
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>On-site checks</CardTitle>
              <CardDescription>
                The Confidential Informant confirms the seller matches the verified ID; the Mechanic confirms the plate
                and chassis match the ORCR.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>Seller identity</span>
                {fieldCase.identity_confirmed_at ? (
                  <Badge>Confirmed</Badge>
                ) : (isInformant || (isMechanic && !fieldCase.assigned_confidential_informant)) && open ? (
                  <Button size="sm" disabled={busy} onClick={() => check("identity")}>
                    Confirm identity
                  </Button>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Plate / chassis vs ORCR</span>
                {fieldCase.plate_confirmed_at ? (
                  <Badge>Confirmed</Badge>
                ) : isMechanic && open ? (
                  <Button size="sm" disabled={busy} onClick={() => check("plate")}>
                    Confirm plate
                  </Button>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Price at inspection</CardTitle>
              <CardDescription>
                Keep the confirmed price, or record the price agreed with the seller on site. A new price alerts the
                Marketing Specialist, Sales Manager and CEO.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {fieldCase.price_status === "displayed_price" ? (
                <div className="flex flex-col gap-1">
                  <Badge className="self-start">Price changed at inspection</Badge>
                  <p>
                    Updated price {formatCurrency(Number(fieldCase.updated_price))} · discount{" "}
                    {formatCurrency(Number(fieldCase.discount_amount ?? 0))}
                  </p>
                </div>
              ) : fieldCase.price_status === "negotiated" ? (
                <p>Negotiated. The confirmed price stays.</p>
              ) : null}
              {isInformant && open && fieldCase.price_status !== "negotiated" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="price-status">Price status</Label>
                    <Select value={priceStatus} onValueChange={setPriceStatus}>
                      <SelectTrigger id="price-status">
                        <SelectValue placeholder="Choose a price status" />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldCase.price_status !== "displayed_price" ? (
                          <SelectItem value="negotiated">Negotiated</SelectItem>
                        ) : null}
                        <SelectItem value="displayed_price">Displayed Price</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {priceStatus === "displayed_price" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="updated-price">Updated price (₱)</Label>
                        <Input
                          id="updated-price"
                          type="number"
                          inputMode="decimal"
                          min="1"
                          value={updatedPrice}
                          onChange={(e) => setUpdatedPrice(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="discount-amount">Discounted amount (₱)</Label>
                        <Input
                          id="discount-amount"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                        />
                      </div>
                      <p className="text-muted-foreground text-xs sm:col-span-2">
                        Confirmed price:{" "}
                        {sellDetails?.agreed_price ? formatCurrency(Number(sellDetails.agreed_price)) : "—"}
                      </p>
                    </div>
                  ) : null}
                  <Button size="sm" className="self-start" disabled={busy || !priceStatus} onClick={submitPrice}>
                    Save price status
                  </Button>
                </>
              ) : !fieldCase.price_status ? (
                <p className="text-muted-foreground">Not recorded yet.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inspection</CardTitle>
              <CardDescription>
                Go through the checklist part by part: Good condition, or Needs repair with its cost and at least one
                photo. Parts the seller already declared are marked for you; anything else you find is a hidden issue.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {inspection ? (
                <InspectionResult result={inspection} title="Reported inspection" />
              ) : fieldCase.inspection_outcome ? (
                <p>
                  {fieldCase.inspection_outcome === "no_issues"
                    ? "No issues found. The car is cleared for payment."
                    : `Issue: ${fieldCase.issue_description} (estimated repair ${formatCurrency(Number(fieldCase.repair_estimate ?? 0))})`}
                </p>
              ) : isMechanic && open ? (
                <>
                  {!checksDone ? (
                    <p className="text-muted-foreground text-xs">Finish both on-site checks first.</p>
                  ) : null}
                  {leafParts.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      No checklist parts are published yet, so the inspection cannot be reported.
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-3">
                    {tree.map(({ system, components }) => (
                      <div key={system.id} className="flex flex-col gap-2">
                        <p className="rounded-md bg-muted/50 px-3 py-2 font-semibold">{system.name}</p>
                        {components.length === 0 ? (
                          // A two-level checklist: the system itself is the part to answer.
                          <InspectionPartRow
                            entry={system}
                            answer={answer(system.id)}
                            answered={Boolean(answers[system.id])}
                            declared={declaredIds.has(system.id)}
                            photos={photos[system.id] ?? []}
                            onAnswer={(patch) => setAnswer(system.id, patch)}
                            onPhotos={(files) => setPhotosFor(system.id, files)}
                          />
                        ) : (
                          components.map(({ component, parts }) => (
                            <div key={component.id} className="flex flex-col gap-2 sm:ml-3">
                              <p className="font-medium text-muted-foreground text-xs">{component.name}</p>
                              {(parts.length === 0 ? [component] : parts).map((part) => (
                                <InspectionPartRow
                                  key={part.id}
                                  entry={part}
                                  answer={answer(part.id)}
                                  answered={Boolean(answers[part.id])}
                                  declared={declaredIds.has(part.id)}
                                  photos={photos[part.id] ?? []}
                                  onAnswer={(patch) => setAnswer(part.id, patch)}
                                  onPhotos={(files) => setPhotosFor(part.id, files)}
                                />
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-muted-foreground text-xs">
                      {answeredCount} of {leafParts.length} parts answered
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Estimated total:{" "}
                      <span className="font-medium text-foreground tabular-nums">{formatCurrency(estimatedTotal)}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="self-start"
                    disabled={busy || !checksDone || answeredCount < leafParts.length}
                    onClick={submitInspection}
                  >
                    Report inspection
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">Not reported yet.</p>
              )}
            </CardContent>
          </Card>

          <FieldExpensesCard
            fieldCaseId={caseId}
            expenses={expenses}
            canFile={isInformant && open}
            title="Meet-up expenses"
            description={
              halfway
                ? "The Confidential Informant files the trip expenses with a proof for each. The Mechanic sees them read-only."
                : "A GCE visit needs no travel expenses. File one only if the trip cost something."
            }
          />
          {halfway ? (
            <Card>
              <CardHeader>
                <CardTitle>Expense report</CardTitle>
                <CardDescription>
                  A Meet Halfway case closes once its expenses are filed, or once the Confidential Informant confirms
                  the trip cost nothing.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 text-sm">
                {noExpensesAt ? (
                  <Badge variant="secondary">No expenses recorded for this trip</Badge>
                ) : canRecordNoExpenses ? (
                  <NoExpensesButton fieldCaseId={caseId} />
                ) : expenses.length === 0 ? (
                  <p className="text-muted-foreground">File the expenses, or confirm the trip cost nothing.</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** SH-7: one checklist part while the Mechanic answers. A declared part is the seller's own tick. */
function InspectionPartRow({
  entry,
  answer,
  answered,
  declared,
  photos,
  onAnswer,
  onPhotos,
}: {
  readonly entry: ChecklistEntry;
  readonly answer: Answer;
  readonly answered: boolean;
  /** The seller ticked this part on the sell form. */
  readonly declared: boolean;
  readonly photos: File[];
  readonly onAnswer: (patch: Partial<Answer>) => void;
  readonly onPhotos: (files: File[]) => void;
}) {
  const forRepair = answer.status === "for_repair";

  return (
    <div
      className={`${CHECKLIST_LEVEL_INDENT[entry.level] ?? "ml-0"} flex flex-col gap-2 rounded-md border px-3 py-2.5`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={CHECKLIST_LEVEL_BADGE[entry.level] ?? "outline"} className="text-xs capitalize">
            {entry.level}
          </Badge>
          <span>{entry.name}</span>
          {declared ? (
            <Badge variant="outline" className="text-[11px]">
              Declared by seller
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={answer.status === "good" ? "default" : "outline"}
            aria-pressed={answer.status === "good"}
            onClick={() => onAnswer({ status: "good" })}
          >
            Good condition
          </Button>
          <Button
            type="button"
            size="sm"
            variant={forRepair ? "destructive" : "outline"}
            aria-pressed={forRepair}
            onClick={() => onAnswer({ status: "for_repair" })}
          >
            Needs repair
          </Button>
        </div>
      </div>

      {forRepair ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`repair-cost-${entry.id}`} className="text-xs">
              Repair cost (₱)
            </Label>
            <InputGroup>
              <InputGroupAddon align="inline-start">₱</InputGroupAddon>
              <InputGroupInput
                id={`repair-cost-${entry.id}`}
                type="number"
                min="0"
                placeholder="5000"
                value={answer.cost}
                onChange={(e) => onAnswer({ cost: e.target.value })}
              />
            </InputGroup>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`repair-note-${entry.id}`} className="text-xs">
              Note (optional)
            </Label>
            <Textarea
              id={`repair-note-${entry.id}`}
              rows={2}
              placeholder="Details the Marketing Specialist needs"
              value={answer.note}
              onChange={(e) => onAnswer({ note: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`repair-photos-${entry.id}`} className="text-xs">
              Photos of the part (at least one) *
            </Label>
            <Input
              id={`repair-photos-${entry.id}`}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onPhotos(Array.from(e.target.files ?? []))}
            />
            {photos.length === 0 ? (
              <p className="text-destructive text-xs">Attach at least one photo of this part.</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                {photos.length} photo{photos.length === 1 ? "" : "s"} attached.
              </p>
            )}
            {!declared && answered ? (
              <p className="text-muted-foreground text-xs">
                Not declared by the seller: this is reported as a hidden issue.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
