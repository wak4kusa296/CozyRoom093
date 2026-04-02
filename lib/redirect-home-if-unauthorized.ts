/** ルーム系 API が 401 を返したとき（セッション失効・ID 削除後）、キャッシュに依存せずトップへ */
export function redirectHomeIfUnauthorized(status: number) {
  if (typeof window === "undefined") return;
  if (status === 401) {
    window.location.assign("/");
  }
}
