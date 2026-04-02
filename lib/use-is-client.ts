import { useSyncExternalStore } from "react";

/** クライアントでマウント済みか（ポータル等用）。SSR では false。 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
