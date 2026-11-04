import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeTutorial } = vi.hoisted(() => ({ completeTutorial: vi.fn() }));
vi.mock("./actions", () => ({ completeTutorial }));

import { OnboardingTour } from "./onboarding-tour";
import { tutorialSteps } from "./tutorial-steps";

describe("OnboardingTour (T06)", () => {
  beforeEach(() => completeTutorial.mockClear());

  it("advances with Next and records completion on Finish", () => {
    render(<OnboardingTour userRole="customer" />);
    const steps = tutorialSteps("customer");
    for (let i = 1; i < steps.length; i++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(`Step ${steps.length} of ${steps.length}`)).toBeInTheDocument();
    expect(completeTutorial).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(completeTutorial).toHaveBeenCalledTimes(1);
  });

  it("records completion on Skip", () => {
    render(<OnboardingTour userRole="ceo" />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(completeTutorial).toHaveBeenCalledTimes(1);
  });
});
