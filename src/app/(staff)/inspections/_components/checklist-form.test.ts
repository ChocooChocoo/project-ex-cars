import { describe, expect, it } from "vitest";

import {
  buildChecklistTree,
  type ChecklistEntry,
  checklistLeafNodes,
} from "@/app/(staff)/inspections/_components/checklist-form";

const node = (
  id: string,
  parent: string | null,
  level: "system" | "component" | "part",
  name: string,
): ChecklistEntry => ({
  id,
  parent_id: parent,
  level,
  name,
  display_order: 0,
});

const NODES: ChecklistEntry[] = [
  node("s1", null, "system", "Engine"),
  node("c1", "s1", "component", "Engine Block"),
  node("p1", "c1", "part", "Cylinder Head"),
  node("p2", "c1", "part", "Pistons"),
  node("c2", "s1", "component", "Cooling System"),
  node("p3", "c2", "part", "Radiator"),
  node("s2", null, "system", "Brakes"),
  // A two-level checklist: the component is itself a leaf.
  node("c3", "s2", "component", "Brake System"),
];

describe("buildChecklistTree (SH-7)", () => {
  it("groups parts under their component and components under their system", () => {
    const tree = buildChecklistTree(NODES);

    expect(tree.map(({ system }) => system.name)).toEqual(["Engine", "Brakes"]);
    expect(tree[0].components.map(({ component }) => component.name)).toEqual(["Engine Block", "Cooling System"]);
    expect(tree[0].components[0].parts.map((part) => part.name)).toEqual(["Cylinder Head", "Pistons"]);
    expect(tree[0].components[1].parts.map((part) => part.name)).toEqual(["Radiator"]);
    expect(tree[1].components[0].parts).toEqual([]);
  });

  it("keeps the order the nodes arrived in", () => {
    expect(checklistLeafNodes(NODES).map((entry) => entry.name)).toEqual([
      "Cylinder Head",
      "Pistons",
      "Radiator",
      "Brake System",
    ]);
  });
});

describe("checklistLeafNodes (SH-7)", () => {
  it("returns only nodes nothing hangs under, so every answer is a real part", () => {
    const leaf = checklistLeafNodes(NODES);

    expect(leaf.map((entry) => entry.id)).toEqual(["p1", "p2", "p3", "c3"]);
    expect(leaf.some((entry) => entry.id === "s1" || entry.id === "c1")).toBe(false);
  });

  it("treats a whole system as a leaf when it has no children", () => {
    expect(checklistLeafNodes([node("s1", null, "system", "Engine")]).map((entry) => entry.id)).toEqual(["s1"]);
  });

  it("returns nothing for an empty checklist, which is what stops a report", () => {
    expect(checklistLeafNodes([])).toEqual([]);
  });
});
