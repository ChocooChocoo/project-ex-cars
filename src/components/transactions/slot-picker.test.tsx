import { useState } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { manilaDay } from "@/lib/transactions/buy-flow";

import { type SlotDraft, SlotPicker } from "./slot-picker";

function Harness({
  initial = "",
  onChange,
  minDays,
  leadKind,
}: {
  readonly initial?: string;
  readonly onChange: (value: string, draft: SlotDraft) => void;
  readonly minDays?: number;
  readonly leadKind?: "delivery" | "meetup";
}) {
  const [value, setValue] = useState(initial);
  return (
    <SlotPicker
      id="slot"
      label="Schedule"
      value={value}
      onChange={(next, draft) => {
        setValue(next);
        onChange(next, draft);
      }}
      minDays={minDays}
      leadKind={leadKind}
    />
  );
}

describe("SlotPicker", () => {
  it("keeps a picked date on screen before an hour is picked, and sends no slot yet", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Schedule"), { target: { value: "2033-03-05" } });

    expect(screen.getByLabelText("Schedule")).toHaveValue("2033-03-05");
    expect(onChange).toHaveBeenLastCalledWith("", { date: "2033-03-05", hour: null });
  });

  it("clears the hour when the date changes under an existing slot", () => {
    const onChange = vi.fn();
    render(<Harness initial="2033-03-05T10:00:00+08:00" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Schedule"), { target: { value: "2033-03-07" } });

    expect(screen.getByLabelText("Schedule")).toHaveValue("2033-03-07");
    expect(onChange).toHaveBeenLastCalledWith("", { date: "2033-03-07", hour: null });
  });

  it("says GCE is closed on a Sunday and offers no hour list", () => {
    render(<Harness onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Schedule"), { target: { value: "2033-03-06" } });

    expect(screen.getByText("GCE is closed on Sundays.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Hour")).not.toBeInTheDocument();
  });

  it("names the arrangement its lead time protects", () => {
    render(<Harness onChange={vi.fn()} minDays={2} leadKind="meetup" />);
    expect(screen.getByText(/A halfway meet-up needs at least 2 days from today/)).toBeInTheDocument();

    render(<Harness onChange={vi.fn()} minDays={7} leadKind="delivery" />);
    expect(screen.getByText(/Delivery needs at least 7 days from today/)).toBeInTheDocument();
  });

  it("opens the date field on the earliest day the arrangement allows", () => {
    render(<Harness onChange={vi.fn()} minDays={2} leadKind="meetup" />);
    // A Friday plus 2 days is the following Sunday; the picker still sets the minimum it was given.
    const expected = manilaDay(new Date(), 2);
    expect(screen.getByLabelText("Schedule")).toHaveAttribute("min", expected);
  });
});
