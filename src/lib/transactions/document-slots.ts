// T06: the buyer's documents laid out as the three things GCE asks for: Valid ID #1 and #2 (front and back
// each) and one proof of billing. A slot holds the active upload, or the latest rejected one so the buyer sees
// what to fix. The first ID type uploaded fills ID #1, the next different type fills ID #2.

export type SlotDocument = {
  id?: unknown;
  document_kind: unknown;
  verification_state: unknown;
  id_type?: unknown;
  id_side?: unknown;
  rejection_reason?: unknown;
};

export type IdSlot<T> = { idType: string | null; front: T | null; back: T | null };

function pick<T extends SlotDocument>(docs: T[]): T | null {
  return docs.find((doc) => doc.verification_state !== "rejected") ?? docs[0] ?? null;
}

/** `documents` newest first, as the page loads them. */
export function documentSlots<T extends SlotDocument>(
  documents: T[],
): { ids: [IdSlot<T>, IdSlot<T>]; billing: T | null } {
  const ids = documents.filter((doc) => doc.document_kind === "valid_id");
  // Types in upload order (oldest first), active ones before types that only have rejected uploads.
  const types: string[] = [];
  for (const doc of [...ids].reverse()) {
    const type = String(doc.id_type ?? "");
    if (!types.includes(type)) types.push(type);
  }
  const isActive = (type: string) =>
    ids.some((doc) => String(doc.id_type ?? "") === type && doc.verification_state !== "rejected");
  types.sort((a, b) => Number(isActive(b)) - Number(isActive(a)));

  const slot = (type: string | undefined): IdSlot<T> => {
    if (type === undefined) return { idType: null, front: null, back: null };
    const ofType = ids.filter((doc) => String(doc.id_type ?? "") === type);
    return {
      idType: type === "" ? null : type,
      // Uploads from before IDs had a side count as the front.
      front: pick(ofType.filter((doc) => doc.id_side !== "back")),
      back: pick(ofType.filter((doc) => doc.id_side === "back")),
    };
  };

  return {
    ids: [slot(types[0]), slot(types[1])],
    billing: pick(documents.filter((doc) => doc.document_kind === "proof_of_billing")),
  };
}
