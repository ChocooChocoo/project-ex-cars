import { describe, expect, it } from "vitest";

import { documentSlots } from "./document-slots";

const id = (n: string, id_type: string, id_side: string, verification_state = "pending") => ({
  id: n,
  document_kind: "valid_id",
  id_type,
  id_side,
  verification_state,
});

describe("documentSlots (T06)", () => {
  it("is empty before any upload", () => {
    expect(documentSlots([])).toEqual({
      ids: [
        { idType: null, front: null, back: null },
        { idType: null, front: null, back: null },
      ],
      billing: null,
    });
  });

  it("puts the first ID type in ID #1 and the second in ID #2, front and back", () => {
    // Newest first, like the page query.
    const docs = [id("4", "umid", "front"), id("3", "passport", "back"), id("2", "passport", "front")];
    const { ids } = documentSlots(docs);
    expect(ids[0]).toMatchObject({ idType: "passport", front: { id: "2" }, back: { id: "3" } });
    expect(ids[1]).toMatchObject({ idType: "umid", front: { id: "4" }, back: null });
  });

  it("prefers the active upload over a rejected one, and keeps a rejected one visible", () => {
    const docs = [
      id("3", "passport", "front"),
      id("2", "passport", "front", "rejected"),
      { id: "b1", document_kind: "proof_of_billing", verification_state: "rejected", rejection_reason: "Blurry" },
    ];
    const slots = documentSlots(docs);
    expect(slots.ids[0].front).toMatchObject({ id: "3" });
    expect(slots.billing).toMatchObject({ id: "b1", rejection_reason: "Blurry" });
  });

  it("moves an ID type that is only rejected after the active ones", () => {
    const docs = [id("2", "umid", "front"), id("1", "sss_id", "front", "rejected")];
    expect(documentSlots(docs).ids.map((slot) => slot.idType)).toEqual(["umid", "sss_id"]);
  });
});
