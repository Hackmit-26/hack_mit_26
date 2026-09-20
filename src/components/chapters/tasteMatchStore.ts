"use client";

/**
 * Chapter 1's data, from `GET /groups/:id/taste-match`.
 *
 * Which pair wins and what the three scores are is decided by the server off real item rows —
 * that is the whole claim the card makes, so it must not be a constant in the frontend. The
 * seeded fixture stays as the fallback so a cold backend degrades to the old static card rather
 * than to an empty chapter.
 *
 * Cached at module level and stamped with the viewer it was fetched as, same rule as
 * `debateStore`.
 */

import { useEffect, useState } from "react";

import { getGroupTasteMatch, getViewerId } from "@/lib/api";
import type { TasteMatchResult } from "@/lib/apiTypes";

export interface TasteMatchApi {
  tasteMatch(groupId: string): Promise<TasteMatchResult>;
}

const backendTasteMatchApi: TasteMatchApi = { tasteMatch: getGroupTasteMatch };

let tasteMatchApi: TasteMatchApi = backendTasteMatchApi;

/** THE API SEAM. Nothing else in the app talks to /taste-match. Tests inject here. */
export function setTasteMatchApi(api: TasteMatchApi): void {
  tasteMatchApi = api;
}

let cache: { viewerId: string | null; groupId: string; match: TasteMatchResult } | null = null;

/** Only for tests: drops the cache so the next mount fetches again. */
export function clearTasteMatchCache(): void {
  cache = null;
}

export type TasteMatchState =
  | { status: "loading" }
  | { status: "ready"; match: TasteMatchResult }
  | { status: "fallback" };

function snapshot(groupId: string): TasteMatchState {
  if (!cache) return { status: "loading" };
  if (cache.viewerId !== getViewerId()) return { status: "loading" };
  if (cache.groupId !== groupId) return { status: "loading" };
  return { status: "ready", match: cache.match };
}

/**
 * A group with too little signal answers 422 NOT_ENOUGH_DATA, which is a real answer rather than
 * a failure — so there is no error state, only "fallback" to the seeded card.
 */
export function useTasteMatch(groupId: string): TasteMatchState {
  const [state, setState] = useState<TasteMatchState>(() => snapshot(groupId));

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const match = await tasteMatchApi.tasteMatch(groupId);
        if (!alive) return;
        cache = { viewerId: getViewerId(), groupId, match };
        setState({ status: "ready", match });
      } catch (err) {
        console.error("taste match load failed", err);
        if (alive) setState({ status: "fallback" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [groupId]);

  return state;
}
