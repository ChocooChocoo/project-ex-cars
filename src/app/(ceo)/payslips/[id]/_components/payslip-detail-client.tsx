"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Plus, Printer } from "lucide-react";
import { toast } from "sonner";

import { addPayslipItem, markPayslipPaid } from "@/app/(ceo)/payroll/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export interface PayslipItemRow {
  id: string;
  item_kind: "earning" | "deduction";
  label: string;
  amount_cents: number;
  calculation_note: string | null;
}

interface PayslipDetailClientProps {
  payslipId: string;
  status: "draft" | "finalized";
  paymentStatus: "pending" | "paid";
  grossCents: number;
  deductionsCents: number;
  netCents: number;
  earnings: PayslipItemRow[];
  deductions: PayslipItemRow[];
  canEdit: boolean;
  canPay: boolean;
  periodLabel: string;
  employeeLabel: string;
}

export function PayslipDetailClient({
  payslipId,
  status,
  paymentStatus,
  grossCents,
  deductionsCents,
  netCents,
  earnings,
  deductions,
  canEdit,
  canPay,
  periodLabel,
  employeeLabel,
}: PayslipDetailClientProps) {
  const router = useRouter();
  const [itemOpen, setItemOpen] = useState(false);
  const [itemKind, setItemKind] = useState<"earning" | "deduction">("deduction");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [calculationNote, setCalculationNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  async function submitPaid() {
    setPaying(true);
    const fd = new FormData();
    fd.set("payslip_id", payslipId);
    const result = await markPayslipPaid(fd);
    setPaying(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Payslip marked as paid.");
    router.refresh();
  }

  async function submitItem() {
    setLoading(true);
    setFormError(null);
    const fd = new FormData();
    fd.set("payslip_id", payslipId);
    fd.set("item_kind", itemKind);
    fd.set("label", label);
    fd.set("amount_cents", amount);
    fd.set("calculation_note", calculationNote);
    const result = await addPayslipItem(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setFormError(result.error);
      return;
    }
    toast.success("Payslip item added.");
    setItemOpen(false);
    setLabel("");
    setAmount("");
    setCalculationNote("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Payslip</h1>
          <p className="text-muted-foreground text-sm">
            {periodLabel} · {employeeLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === "finalized" ? "default" : "secondary"}>{status}</Badge>
          <Badge variant={paymentStatus === "paid" ? "default" : "outline"}>
            {paymentStatus === "paid" ? "Paid" : "Payment Pending"}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Print
          </Button>
          {canEdit && status === "draft" ? (
            <Button size="sm" onClick={() => setItemOpen(true)}>
              <Plus data-icon="inline-start" />
              Add Item
            </Button>
          ) : null}
          {canPay && status === "finalized" && paymentStatus === "pending" ? (
            <Button size="sm" variant="outline" onClick={submitPaid} disabled={paying}>
              {paying ? "Marking..." : "Mark as Paid"}
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gross Pay</span>
            <span>₱{(grossCents / 100).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Deductions</span>
            <span>₱{(deductionsCents / 100).toLocaleString()}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Net Pay</span>
            <span>₱{(netCents / 100).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <p className="text-muted-foreground text-sm">No earnings recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {earnings.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-2 py-2">
                      <span className="font-medium">{item.label}</span>
                      {item.calculation_note ? (
                        <span className="block text-muted-foreground text-xs">{item.calculation_note}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right">₱{(item.amount_cents / 100).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deductions</CardTitle>
        </CardHeader>
        <CardContent>
          {deductions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No deductions recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {deductions.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-2 py-2">
                      <span className="font-medium">{item.label}</span>
                      {item.calculation_note ? (
                        <span className="block text-muted-foreground text-xs">{item.calculation_note}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right">₱{(item.amount_cents / 100).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payslip Item</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Kind</FieldLabel>
              <Select value={itemKind} onValueChange={(value) => setItemKind(value as "earning" | "deduction")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="earning" className="capitalize">
                      Earning
                    </SelectItem>
                    <SelectItem value="deduction" className="capitalize">
                      Deduction
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Label</FieldLabel>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="SSS, PhilHealth, Overtime..."
              />
            </Field>
            <Field>
              <FieldLabel>Amount (₱)</FieldLabel>
              <Input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field>
              <FieldLabel>Calculation Note (optional)</FieldLabel>
              <Input
                value={calculationNote}
                onChange={(e) => setCalculationNote(e.target.value)}
                placeholder="Source value and how this was computed"
              />
            </Field>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setItemOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitItem} disabled={loading}>
              {loading ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
