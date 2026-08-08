"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { submitPerformanceReview } from "@/app/(staff)/staff-records/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export interface PerformanceReviewRow {
  id: string;
  employee_id: string;
  reviewer_id: string;
  review_period_start: string;
  review_period_end: string;
  rating: number | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  goals: string | null;
  status: "draft" | "submitted" | "acknowledged";
  profiles: { full_name: string | null } | null;
}

interface PerformanceReviewsProps {
  reviews: PerformanceReviewRow[];
  employees: { id: string; full_name: string | null }[];
  canManage: boolean;
}

export function PerformanceReviews({ reviews, employees, canManage }: PerformanceReviewsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [rating, setRating] = useState("");
  const [strengths, setStrengths] = useState("");
  const [areas, setAreas] = useState("");
  const [goals, setGoals] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!employeeId || !periodStart || !periodEnd) {
      setError("Employee, period start, and period end are required.");
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("employee_id", employeeId);
    fd.set("review_period_start", periodStart);
    fd.set("review_period_end", periodEnd);
    if (rating) fd.set("rating", rating);
    if (strengths) fd.set("strengths", strengths);
    if (areas) fd.set("areas_for_improvement", areas);
    if (goals) fd.set("goals", goals);
    const result = await submitPerformanceReview(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    toast.success("Performance review submitted.");
    setOpen(false);
    setEmployeeId("");
    setPeriodStart("");
    setPeriodEnd("");
    setRating("");
    setStrengths("");
    setAreas("");
    setGoals("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Performance Reviews</CardTitle>
        {canManage ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" />
            New Review
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No performance reviews yet. The Account Manager records review cycles per employee; the CEO reads them on
            the dashboard.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.profiles?.full_name ?? r.employee_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    {new Date(r.review_period_start).toLocaleDateString()} —{" "}
                    {new Date(r.review_period_end).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{r.rating ? `${r.rating}/5` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "submitted" ? "default" : "secondary"}>{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Performance Review</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Employee</FieldLabel>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name ?? emp.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Period Start</FieldLabel>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Period End</FieldLabel>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Rating (1–5, optional)</FieldLabel>
              <Input
                type="number"
                min="1"
                max="5"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="e.g. 4"
              />
            </Field>
            <Field>
              <FieldLabel>Strengths</FieldLabel>
              <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} />
            </Field>
            <Field>
              <FieldLabel>Areas for Improvement</FieldLabel>
              <Textarea value={areas} onChange={(e) => setAreas(e.target.value)} rows={2} />
            </Field>
            <Field>
              <FieldLabel>Goals</FieldLabel>
              <Textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} />
            </Field>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
