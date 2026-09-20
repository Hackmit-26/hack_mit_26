"use client";

/**
 * The month's most argued-about item, from `GET /groups/:id/debate`.
 *
 * Which item wins is decided by the server off the real comment rows, not picked here — that is
 * the whole claim the card makes, so it must not be a constant in the frontend.
 *
 * Cached at module level and stamped with the viewer it was fetched as: `ownerId` is stripped for
 * an anonymously shared item and the thread is filtered to what that viewer may see, so a stamp
 * mismatch reads as no cache at all (same rule as `findsStore`).
 */

import { useEffect, useState } from "react";

import { getGroupDebate, getViewerId } from "@/lib/api";
import type { Debate } from "@/lib/apiTypes";

export interface DebateApi {
  debate(groupId: string): Promise<Debate>;
}

const backendDebateApi: DebateApi = { debate: getGroupDebate };

let debateApi: DebateApi = backendDebateApi;

/** THE API SEAM. Nothing else in the app talks to /debate. Tests inject here. */
export function setDebateApi(api: DebateApi): void {
  debateApi = api;
}

let cache: { viewerId: string | null; groupId: string; debate: Debate } | null = null;

/** Only for tests: drops the cache so the next mount fetches again. */
export function clearDebateCache(): void {
  cache = null;
}

export type DebateState =
  | { status: "loading" }
  | { status: "ready"; debate: Debate }
  | { status: "empty" };

function snapshot(groupId: string): DebateState {
  if (!cache) return { status: "loading" };
  if (cache.viewerId !== getViewerId()) return { status: "loading" };
  if (cache.groupId !== groupId) return { status: "loading" };
  return { status: "ready", debate: cache.debate };
}

/**
 * A group nobody has commented in yet answers 404 NOT_ENOUGH_DATA, which is a real answer rather
 * than a failure — so there is no error state, only "empty".
 */
export function useGroupDebate(groupId: string): DebateState {
  const [state, setState] = useState<DebateState>(() => snapshot(groupId));

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const debate = await debateApi.debate(groupId);
        if (!alive) return;
        cache = { viewerId: getViewerId(), groupId, debate };
        setState({ status: "ready", debate });
      } catch (err) {
        console.error("debate load failed", err);
        if (alive) setState({ status: "empty" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [groupId]);

  return state;
}
