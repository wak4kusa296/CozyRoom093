/**
 * 単一 Node プロセス内でのみ有効な通知プッシュ（SSE 購読者へ即時データを流す）。
 * serverless でインスタンスが分かれる環境では届かない場合があり、そのときはポーリングにフォールバックする。
 */

const adminCallbacks = new Set<() => void>();
const roomCallbacksByGuest = new Map<string, Set<() => void>>();

export function registerAdminNotificationPush(callback: () => void): () => void {
  adminCallbacks.add(callback);
  return () => adminCallbacks.delete(callback);
}

export function pingAdminNotificationSubscribers(): void {
  for (const cb of [...adminCallbacks]) {
    try {
      cb();
    } catch {
      // ignore
    }
  }
}

export function registerRoomNotificationPush(guestId: string, callback: () => void): () => void {
  let set = roomCallbacksByGuest.get(guestId);
  if (!set) {
    set = new Set();
    roomCallbacksByGuest.set(guestId, set);
  }
  set.add(callback);
  return () => {
    set!.delete(callback);
    if (set!.size === 0) roomCallbacksByGuest.delete(guestId);
  };
}

export function pingRoomNotificationSubscriber(guestId: string): void {
  const set = roomCallbacksByGuest.get(guestId);
  if (!set) return;
  for (const cb of [...set]) {
    try {
      cb();
    } catch {
      // ignore
    }
  }
}

/** 接続中の全ゲスト向けルーム通知（例: 新規公開手記） */
export function pingAllRoomNotificationSubscribers(): void {
  for (const set of roomCallbacksByGuest.values()) {
    for (const cb of [...set]) {
      try {
        cb();
      } catch {
        // ignore
      }
    }
  }
}

/** 指定ゲストだけ SSE で通知一覧を再取得させる（個別プッシュ向け） */
export function pingRoomNotificationSubscribers(guestIds: string[]): void {
  const seen = new Set<string>();
  for (const id of guestIds) {
    const g = id.trim();
    if (!g || seen.has(g)) continue;
    seen.add(g);
    pingRoomNotificationSubscriber(g);
  }
}
