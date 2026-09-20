import type { Chapter, ChapterId } from "@/lib/types";

/**
 * The four chapters plus the closing screen, in story order.
 * Names, questions and card grounds come from the design system artboard's
 * chapter strip.
 */
export const chapters: Chapter[] = [
  {
    id: "taste",
    name: "Taste Match",
    kicker: "Chapter 1 · Taste match",
    question: "Who is most like me?",
    bg: "#EBB5BD",
    fg: "#141A47",
  },
  {
    id: "spotlights",
    name: "Spotlights",
    kicker: "Chapter 2 · Spotlights",
    question: "What does my shopping say?",
    bg: "#E8806F",
    fg: "#141A47",
  },
  {
    id: "lore",
    name: "Group Lore",
    kicker: "Chapter 3 · Group lore",
    question: "What weird thing did we all do?",
    bg: "#141A47",
    fg: "#F5ECD9",
  },
  {
    id: "gift",
    name: "Gift Mode",
    kicker: "Chapter 4 · Gift mode",
    question: "What would my friends love?",
    bg: "#F5E39B",
    fg: "#141A47",
  },
  {
    id: "closing",
    name: "The End",
    kicker: "September issue · The end",
    question: "What do we do next month?",
    bg: "#F5ECD9",
    fg: "#141A47",
  },
];

/** The four numbered chapters; the closing screen is not counted in "n / 4". */
export const storyChapters = chapters.filter((c) => c.id !== "closing");

export const chapterOrder: ChapterId[] = chapters.map((c) => c.id);

export function chapterIndex(id: ChapterId): number {
  return chapterOrder.indexOf(id);
}

export function getChapter(id: ChapterId): Chapter {
  const found = chapters.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown chapter: ${id}`);
  return found;
}
