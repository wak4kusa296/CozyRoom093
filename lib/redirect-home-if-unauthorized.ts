/** ルーム系 API が 401 を返したとき、失効理由を示してトップへ戻す。 */
export function redirectHomeIfUnauthorized(status: number) {
  if (typeof window === "undefined") return;
  if (status === 401) {
    window.location.assign("/?reason=session_expired");
  }
}
