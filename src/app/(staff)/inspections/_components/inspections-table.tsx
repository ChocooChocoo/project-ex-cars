"use client";
"use no memo";

import Link from "next/link";

import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function InspectionsTable({ inspections }: { readonly inspections: Record<string, unknown>[] }) {
  if (inspections.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <ClipboardList className="size-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">No inspections recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="px-0 pb-0">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Mechanic</TableHead>
                <TableHead>Condition Score</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Recommendation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspections.map((insp) => {
                const vehicles = insp.vehicles as Record<string, unknown> | undefined;
                return (
                  <TableRow key={insp.id as string}>
                    <TableCell>
                      <Link href={`/dashboard/inspections/${insp.id}`} className="font-medium hover:text-primary">
                        {vehicles ? `${vehicles.make} ${vehicles.model} (${vehicles.year})` : "—"}
                      </Link>
                      <div className="text-muted-foreground text-xs">{vehicles?.stock_code as string}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {(insp.mechanic_id as string)?.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {insp.condition_score ? (
                        <Badge variant={Number(insp.condition_score) >= 70 ? "default" : "secondary"}>
                          {insp.condition_score as number}/100
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(insp.inspection_date as string).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="max-w-60 truncate text-muted-foreground text-sm">
                      {(insp.recommendation as string) ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
