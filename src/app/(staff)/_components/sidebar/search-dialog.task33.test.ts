import { describe, expect, it } from "vitest";

import { getSearchItems } from "./search-dialog";

describe("SearchDialog Task 33 role access", () => {
  it("shows the Create Walk-In deep-link only to Account Managers", () => {
    const accountManagerItem = getSearchItems("account_manager").find((item) => item.id === "create-walk-in");
    const ceoItem = getSearchItems("ceo").find((item) => item.id === "create-walk-in");
    const salesManagerItem = getSearchItems("sales_manager").find((item) => item.id === "create-walk-in");

    expect(accountManagerItem).toMatchObject({
      label: "Create Walk-In",
      url: "/account_manager/staff-records?createWalkIn=1",
    });
    expect(ceoItem).toBeUndefined();
    expect(salesManagerItem).toBeUndefined();
  });

  it("returns nothing when the role is missing or unknown instead of the full catalog", () => {
    expect(getSearchItems(undefined)).toEqual([]);
    expect(getSearchItems(null)).toEqual([]);
    expect(getSearchItems("not_a_role")).toEqual([]);
  });
});
