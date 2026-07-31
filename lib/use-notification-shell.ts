"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from "react";

import { useFocusTrap } from "@/lib/use-focus-trap";

type NotificationShellOptions = {
  bellRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  isOutsideTargetIgnored?: (target: EventTarget | null) => boolean;
};

/**
 * Shared mechanics for the notification popovers. Feed content remains owned
 * by each caller, while the portal lifecycle and accessible dismissal match.
 */
export function useNotificationShell({
  bellRef,
  panelRef,
  isOutsideTargetIgnored
}: NotificationShellOptions) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 56, right: 16 });
  const close = () => setOpen(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useFocusTrap(panelRef, open, close);

  useLayoutEffect(() => {
    if (!open || !bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    setPanelPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
  }, [open, bellRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (
        bellRef.current?.contains(target as Node) ||
        panelRef.current?.contains(target as Node) ||
        isOutsideTargetIgnored?.(target)
      ) {
        return;
      }
      close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, bellRef, panelRef, isOutsideTargetIgnored]);

  return { close, mounted, open, panelPos, setOpen };
}
