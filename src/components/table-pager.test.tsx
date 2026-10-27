import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TablePager, usePagedRows } from "./table-pager";

function Harness({ count }: { readonly count: number }) {
  const rows = Array.from({ length: count }, (_, i) => `Row ${i + 1}`);
  const paged = usePagedRows(rows);
  return (
    <div>
      <ul>
        {paged.rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
      <TablePager {...paged} label="Entries" />
    </div>
  );
}

describe("TablePager (T03 HA5)", () => {
  it("shows at most 10 rows and moves between pages", () => {
    render(<Harness count={23} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Row 11")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("states the fixed page size and the row range", () => {
    render(<Harness count={23} />);

    expect(screen.getByText("10 rows per page")).toBeInTheDocument();
    expect(screen.getByText("1–10 of 23")).toBeInTheDocument();
  });

  it("hides itself when there are no rows", () => {
    render(<Harness count={0} />);

    expect(screen.queryByText(/Page \d of/)).not.toBeInTheDocument();
  });
});
