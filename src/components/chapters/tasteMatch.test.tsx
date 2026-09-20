import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TasteCard } from "@/components/chapters/TasteCard";
import { clearTasteMatchCache, setTasteMatchApi } from "@/components/chapters/tasteMatchStore";
import type { TasteMatchResult } from "@/lib/apiTypes";
import { AppProvider } from "@/state/store";

const MATCH: TasteMatchResult = {
  pair: ["sabina", "madhav"],
  tasteScore: 91,
  budgetScore: 64,
  timingScore: 48,
  lead: "Sabina and Madhav both keep circling back to silver signet rings and ribbed tanks.",
  sharedTags: ["silver jewellery", "neutral basics", "weekend hauls"],
  notes: { taste: "same shelves", budget: "same wallet energy", timing: "both peak on saturday" },
  disagreement: [
    { userId: "sabina", text: "Loyal to one shop. Nine of her twelve finds came from Mejuri." },
    { userId: "madhav", text: "Never shops the same place twice. Eleven shops, twelve items." },
  ],
  footnote: "Scored across 4 members, 96 items.",
  otherPairs: [
    { pair: ["kristina", "esh"], score: 77 },
    { pair: ["kristina", "sabina"], score: 61 },
  ],
  source: "ai",
};

function card() {
  return render(
    <AppProvider>
      <TasteCard />
    </AppProvider>,
  );
}

/**
 * The three medallions are keyed by their kicker; the value and note sit beside it. "Taste match"
 * also labels the big number in the middle of the Venn, which comes first in the DOM — the
 * medallion is the later one.
 */
function medallion(kicker: string): string {
  return screen.getAllByText(kicker).at(-1)?.parentElement?.textContent ?? "";
}

beforeEach(() => {
  window.sessionStorage.clear();
  clearTasteMatchCache();
  setTasteMatchApi({ tasteMatch: async () => MATCH });
});

afterEach(cleanup);

describe("TasteCard", () => {
  it("shows the pair and all three scores the server computed, not the fixture's", async () => {
    card();
    await screen.findByText(MATCH.lead);
    expect(medallion("Taste match")).toContain("91%");
    expect(medallion("Budget match")).toContain("64%");
    expect(medallion("Shopping rhythm")).toContain("48%");
    // The fixture pair is kristina + esh at 86 / 73 / 77.
    expect(screen.queryByText("73%")).toBeNull();
    expect(screen.getByText(/Sabina \+ Madhav/)).toBeTruthy();
  });

  it("prints the model's copy under each score", async () => {
    card();
    await screen.findByText(MATCH.lead);
    expect(medallion("Taste match")).toContain("same shelves");
    expect(medallion("Budget match")).toContain("same wallet energy");
    expect(medallion("Shopping rhythm")).toContain("both peak on saturday");
  });

  it("gives each of the pair their own disagreement line", async () => {
    card();
    await screen.findByText(MATCH.lead);
    expect(screen.getByText("Loyal to one shop.")).toBeTruthy();
    expect(screen.getByText("Never shops the same place twice.")).toBeTruthy();
    expect(screen.getByText(MATCH.footnote)).toBeTruthy();
  });

  it("falls back to the seeded card when the group has too little signal to score", async () => {
    setTasteMatchApi({
      tasteMatch: async () => {
        throw new Error("NOT_ENOUGH_DATA");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    card();
    await screen.findByText(/Kristina \+ Esh/);
    expect(medallion("Budget match")).toContain("73%");
  });

  it("falls back rather than crashing on a pair this build has no faces for", async () => {
    setTasteMatchApi({
      tasteMatch: async () => ({ ...MATCH, pair: ["u_9f2", "u_31c"] as [string, string] }),
    });
    card();
    await screen.findByText(/Kristina \+ Esh/);
    expect(screen.queryByText(MATCH.lead)).toBeNull();
  });
});
