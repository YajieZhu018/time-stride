"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True once the client has taken over from the server-rendered HTML.
 *
 * Needed anywhere state is read from localStorage (the persisted timer store):
 * the server always renders as if that state were empty, so the first client
 * render must match before flipping. useSyncExternalStore is used instead of
 * a `useState` + `useEffect` pair because setting state synchronously inside
 * an effect body triggers a cascading re-render the React Compiler flags.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
