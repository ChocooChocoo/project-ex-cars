import { describe, expect, it, vi } from "vitest";

const NODE_ID = "11111111-1111-4111-8111-111111111111";

const calls: { rpc: unknown[][]; documentQueries: unknown[][] } = { rpc: [], documentQueries: [] };

const { roleRef, rpcResult } = vi.hoisted(() => ({
  roleRef: { current: "mechanic" as string | null },
  rpcResult: { current: [] as { transaction_id: string; condition_items: unknown }[] },
}));

vi.mock("@/lib/auth/guards", () => ({
  // The guard is exercised by roles.transaction-viewers.test.ts; here it only has to not redirect.
  requireRole: vi.fn(async () => undefined),
}));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole: async () => roleRef.current }));
vi.mock("@/app/(staff)/vehicles/actions", () => ({ submitChecklistAnswer: vi.fn() }));

// A tiny chainable stand-in for the Supabase query builder, recording what the page asked for.
vi.mock("@/lib/supabase/server", () => {
  const from = (table: string) => {
    const query: Record<string, unknown> = {};
    const chain = (name: string) => {
      query[name] = (...args: unknown[]) => {
        if (table === "transaction_documents") calls.documentQueries.push([name, ...args]);
        return query;
      };
      return query;
    };
    for (const name of ["select", "eq", "in", "order", "single", "maybeSingle", "limit"]) chain(name);
    // The real builder is a thenable, so the page awaits it directly. Reproducing that is
    // the point of the mock.
    // biome-ignore lint/suspicious/noThenProperty: intentional stand-in for the Supabase query builder.
    query.then = (resolve: (value: unknown) => unknown) =>
      resolve(
        table === "transaction_documents"
          ? {
              data: [
                {
                  id: "doc-1",
                  document_kind: "sell_photo",
                  storage_path: "tx-1/sell-photo-front.jpg",
                },
              ],
              error: null,
            }
          : { data: [{ id: NODE_ID, name: "Exterior scratches" }], error: null },
      );
    return query;
  };

  return {
    createServerSupabase: async () => ({
      from,
      rpc: async (name: string, args: unknown) => {
        calls.rpc.push([name, args]);
        return { data: rpcResult.current, error: null };
      },
      storage: {
        from: () => ({
          createSignedUrl: async (path: string, expiresIn: number) => ({
            data: { signedUrl: `https://storage.test/signed/${expiresIn}/${path}` },
            error: null,
          }),
        }),
      },
    }),
  };
});

const { default: InspectionDetailPage } = await import("./page");
const { InspectionSellMedia } = await import("./_components/inspection-sell-media");

// The page's first query is the inspection itself; a row here keeps it past `notFound()`.
function reset() {
  calls.rpc = [];
  calls.documentQueries = [];
}

/** Walks the returned element tree looking for a component type. */
function find(node: unknown, type: unknown): { props?: Record<string, unknown> } | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = find(child, type);
      if (match) return match;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (element.type === type) return element;
  return find(element.props?.children, type);
}

function contains(node: unknown, type: unknown): boolean {
  return find(node, type) !== null;
}

async function renderPage(role: string | null) {
  reset();
  roleRef.current = role;
  return InspectionDetailPage({ params: Promise.resolve({ id: "inspection-1" }) });
}

describe("inspection detail sell media gating", () => {
  it("asks for and shows the sell submission for the assigned mechanic", async () => {
    rpcResult.current = [{ transaction_id: "tx-1", condition_items: [NODE_ID] }];

    const element = await renderPage("mechanic");

    expect(calls.rpc).toEqual([["get_inspection_sell_submission", { inspection_id: "inspection-1" }]]);
    expect(contains(element, InspectionSellMedia)).toBe(true);
  });

  it("shows it for the confidential informant too", async () => {
    rpcResult.current = [{ transaction_id: "tx-1", condition_items: [NODE_ID] }];

    const element = await renderPage("confidential_informant");

    expect(calls.rpc).toHaveLength(1);
    expect(contains(element, InspectionSellMedia)).toBe(true);
  });

  it("never asks for sell media on behalf of the other inspection viewers", async () => {
    rpcResult.current = [{ transaction_id: "tx-1", condition_items: [NODE_ID] }];

    for (const role of ["ceo", "account_manager", "sales_manager"]) {
      const element = await renderPage(role);

      expect(calls.rpc, `${role} must not reach the sell bridge`).toEqual([]);
      expect(contains(element, InspectionSellMedia)).toBe(false);
    }
  });

  it("reads only this transaction's sell photos", async () => {
    rpcResult.current = [{ transaction_id: "tx-1", condition_items: [NODE_ID] }];

    await renderPage("mechanic");

    expect(calls.documentQueries).toContainEqual(["eq", "transaction_id", "tx-1"]);
    expect(calls.documentQueries).toContainEqual(["eq", "document_kind", "sell_photo"]);
  });

  it("renders nothing extra when the vehicle has no sell submission", async () => {
    rpcResult.current = [];

    const element = await renderPage("mechanic");

    // The card is always mounted, but empty props make it return null — so no empty
    // frame appears and no document query was issued.
    expect(find(element, InspectionSellMedia)?.props).toMatchObject({ photos: [], conditionItems: [] });
    expect(calls.documentQueries).toEqual([]);
  });

  it("passes signed previews and resolved condition names, never a storage path", async () => {
    rpcResult.current = [{ transaction_id: "tx-1", condition_items: [NODE_ID] }];

    const element = await renderPage("mechanic");
    const props = find(element, InspectionSellMedia)?.props ?? {};

    expect(props.photos).toEqual([
      { id: "doc-1", is_image: true, signed_url: "https://storage.test/signed/3600/tx-1/sell-photo-front.jpg" },
    ]);
    expect(props.conditionItems).toEqual(["Exterior scratches"]);
    // A signed URL necessarily embeds the object path; what must not leak is a separate,
    // unsigned storage_path field the client could use to bypass the signature.
    expect(JSON.stringify(props)).not.toContain("storage_path");
    expect(Object.keys((props.photos as object[])[0])).toEqual(["id", "is_image", "signed_url"]);
  });
});
