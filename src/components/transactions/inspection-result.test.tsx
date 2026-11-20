import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  InspectionResult,
  type InspectionResultData,
  inspectionRepairParts,
} from "@/components/transactions/inspection-result";

const result: InspectionResultData = {
  inspection_id: "00000000-0000-4000-8000-000000000000",
  inspected_at: null,
  findings: null,
  total: 15000,
  parts: [
    {
      result_id: "00000000-0000-4000-8000-000000000001",
      node_id: "00000000-0000-4000-8000-000000000011",
      name: "Cylinder Head",
      status: "for_repair",
      cost: 12000,
      notes: "Worn cams",
      is_hidden_issue: false,
      photos: [],
    },
    {
      result_id: "00000000-0000-4000-8000-000000000002",
      node_id: "00000000-0000-4000-8000-000000000012",
      name: "Pistons",
      status: "for_repair",
      cost: 3000,
      notes: null,
      is_hidden_issue: true,
      photos: [],
    },
    {
      result_id: "00000000-0000-4000-8000-000000000003",
      node_id: "00000000-0000-4000-8000-000000000013",
      name: "Timing Belt",
      status: "good",
      cost: null,
      notes: null,
      is_hidden_issue: false,
      photos: [],
    },
  ],
};

describe("inspectionRepairParts (SH-7 / SH-4)", () => {
  it("returns the parts that need repair, and nothing for an unreported inspection", () => {
    expect(inspectionRepairParts(result).map((part) => part.name)).toEqual(["Cylinder Head", "Pistons"]);
    expect(inspectionRepairParts(null)).toEqual([]);
  });
});

describe("InspectionResult (SH-7 / SH-3)", () => {
  it("labels the seller's own ticks as declared and the surprises as hidden", () => {
    render(<InspectionResult result={result} />);

    expect(screen.getByText("Declared by seller · Needs repair")).toBeInTheDocument();
    expect(screen.getByText("Hidden issue · Needs repair")).toBeInTheDocument();
    expect(screen.getByText("1 part in good condition")).toBeInTheDocument();
    expect(screen.getByText("2 parts need repair")).toBeInTheDocument();
    expect(screen.getByText("1 hidden")).toBeInTheDocument();
    expect(screen.getByText(/Estimated total/)).toHaveTextContent("₱15,000.00");
  });

  it("says so when the inspection was never reported", () => {
    render(<InspectionResult result={null} emptyLabel="Inspection not reported yet." />);

    expect(screen.getByText("Inspection not reported yet.")).toBeInTheDocument();
  });
});
