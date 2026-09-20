import { describe, expect, it } from "vitest";

import {
  giftProfiles,
  groupGifts,
  getProduct,
  recommendations,
  recommendationsFor,
} from "@/data/products";
import { group, groupMembersExcept } from "@/data/users";
import type { UserId } from "@/lib/types";

describe("groupMembersExcept", () => {
  it("never offers the viewer a gift for themselves", () => {
    for (const viewer of group.memberIds) {
      expect(groupMembersExcept(viewer)).not.toContain(viewer);
    }
  });

  it("offers every other member of the group", () => {
    expect(groupMembersExcept("esh")).toEqual(["kristina", "sabina", "madhav"]);
    expect(groupMembersExcept("kristina")).toEqual(["esh", "sabina", "madhav"]);
    expect(groupMembersExcept("sabina")).toEqual(["kristina", "esh", "madhav"]);
    expect(groupMembersExcept("madhav")).toEqual(["kristina", "esh", "sabina"]);
  });

  it("keeps roster order, so the demo looks the same every time", () => {
    const twice = [groupMembersExcept("esh"), groupMembersExcept("esh")];
    expect(twice[0]).toEqual(twice[1]);
    expect(groupMembersExcept("esh")).toEqual(
      group.memberIds.filter((id) => id !== "esh"),
    );
  });

  it("ignores an id that is not in the group rather than throwing", () => {
    expect(groupMembersExcept("nobody" as UserId)).toEqual(group.memberIds);
  });
});

describe("gift data covers everyone who can be picked", () => {
  const everyGiftee = new Set(group.memberIds.flatMap((v) => groupMembersExcept(v)));

  it("can be picked as a giftee from at least one viewer", () => {
    expect([...everyGiftee].sort()).toEqual([...group.memberIds].sort());
  });

  it("has a gift profile for every giftee", () => {
    for (const id of everyGiftee) {
      expect(giftProfiles[id]?.userId).toBe(id);
      expect(giftProfiles[id].tags.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("has two recommendations in each spendable budget for every giftee", () => {
    for (const id of everyGiftee) {
      for (const budget of ["u25", "u50", "u100"]) {
        expect(recommendationsFor(id, budget)).toHaveLength(2);
      }
    }
  });

  it("has a group gift for every giftee", () => {
    for (const id of everyGiftee) {
      expect(groupGifts[id]?.forUserId).toBe(id);
      expect(groupGifts[id].splitWays).toBe(groupMembersExcept(id).length);
    }
  });

  it("points every recommendation and group gift at a product that resolves", () => {
    for (const rec of recommendations) expect(() => getProduct(rec.productId)).not.toThrow();
    for (const id of everyGiftee) expect(() => getProduct(groupGifts[id].productId)).not.toThrow();
  });

  it("keeps each budget's prices inside its band", () => {
    const bands: Record<string, [number, number]> = {
      u25: [0, 2500],
      u50: [2500, 5000],
      u100: [5000, 10000],
    };
    for (const rec of recommendations) {
      const [min, max] = bands[rec.budget];
      const price = getProduct(rec.productId).priceCents;
      expect(price, `${rec.id} (${rec.budget})`).toBeGreaterThan(min);
      expect(price, `${rec.id} (${rec.budget})`).toBeLessThanOrEqual(max);
    }
  });

  it("uses unique recommendation ids", () => {
    const ids = recommendations.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
