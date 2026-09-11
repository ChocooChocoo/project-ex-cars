import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flexRender, getCoreRowModel, useReactTable, type VisibilityState } from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

import { createColumns } from "./vehicles-columns";

// The vehicle table's own rows are vehicle rows (`vehicles/page.tsx` selects `*`),
// so make/model/year are flat fields on the row, not joined relations.
const vehicles = [
  { id: "v-1", stock_code: "GCE-1042", make: "Toyota", model: "Vios", year: 2020 },
  { id: "v-2", stock_code: "GCE-0987", make: "Honda", model: "Civic", year: 2018 },
];

// Mirrors `vehicles-table.tsx`, which hides the two filter-only accessor columns.
const columnVisibility: VisibilityState = { search: false, created_at: false };

// The callbacks belong to row actions this test never triggers.
const noop = () => {
  /* row action, not exercised here */
};

// A minimal harness over the real column definitions. Rendering the full
// `VehicleTable` would pull in server actions, which is unrelated to the column
// contract under test.
function Harness({ data = vehicles }: { readonly data?: Record<string, unknown>[] }) {
  const table = useReactTable({
    data,
    columns: createColumns(noop, noop, noop, noop, noop, true, true),
    state: { columnVisibility },
    getRowId: (row) => row.id as string,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} data-testid={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

describe("vehicle table columns", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Swallow expected React/Radix noise so the "missing column" assertion below reads
    // only what the table itself logged.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      /* captured via consoleError.mock.calls */
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("renders each vehicle's make, model and year", () => {
    render(<Harness />);

    expect(screen.getByText(/Toyota\s+Vios/)).toBeInTheDocument();
    expect(screen.getByText("2020")).toBeInTheDocument();
    expect(screen.getByText(/Honda\s+Civic/)).toBeInTheDocument();
    expect(screen.getByText("2018")).toBeInTheDocument();
  });

  it("does not look up columns that do not exist", () => {
    render(<Harness />);

    const missingColumnCalls = consoleError.mock.calls.filter((args: unknown[]) =>
      String(args[0]).includes("[Table] Column with id"),
    );

    expect(missingColumnCalls).toEqual([]);
  });

  it("falls back to an em dash instead of rendering undefined when year is missing", () => {
    render(<Harness data={[{ id: "v-3", stock_code: "GCE-0001", make: "Ford", model: "Everest", year: null }]} />);

    expect(screen.getByText(/Ford\s+Everest/)).toBeInTheDocument();
    // A missing year renders the same em dash the price and mileage cells use.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });
});
