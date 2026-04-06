"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { MdFavorite } from "react-icons/md";
import { redirectHomeIfUnauthorized } from "@/lib/redirect-home-if-unauthorized";
import { HEART_COLOR_MAX } from "@/lib/heart-colors";
import { HEART_LIMIT_PER_GUEST } from "@/lib/heart-constants";
import styles from "./room-heart.module.css";

type HeartState = "idle" | "sending" | "thanked" | "limit" | "error";

type HeartParticle = {
  id: number;
  tx: number;
  ty: number;
  r: string;
  durationMs: number;
  delayMs: number;
};

type HeartGetJson = {
  pressedByGuest: number;
  remaining: number;
  limit: number;
  locked: boolean;
};

type HeartPostJson = {
  accepted: boolean;
  reachedLimit: boolean;
  remaining: number;
  pressedByGuest: number;
};

const PARTICLE_BURST = 4;
const PARTICLE_TTL_MS = 2200;

export function HeartButton({ slug }: { slug: string }) {
  const [state, setState] = useState<HeartState>("idle");
  const [tapCount, setTapCount] = useState(0);
  const [particles, setParticles] = useState<HeartParticle[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/hearts/${encodeURIComponent(slug)}`, { method: "GET" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as HeartGetJson;
        if (cancelled) return;
        startTransition(() => {
          const n = Math.min(
            Math.max(Number(data.pressedByGuest) || 0, 0),
            data.limit ?? HEART_LIMIT_PER_GUEST
          );
          setTapCount(n);
          if (data.locked || n >= HEART_LIMIT_PER_GUEST) {
            setState("limit");
          }
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const spawnBurst = useCallback(() => {
    const group: HeartParticle[] = [];
    for (let i = 0; i < PARTICLE_BURST; i++) {
      const base = (Math.PI * 2 * i) / PARTICLE_BURST + (Math.random() - 0.5) * 0.45;
      const dist = 52 + Math.random() * 56;
      const id = ++idRef.current;
      const tx = Math.cos(base) * dist;
      const ty = Math.sin(base) * dist * 0.92 - 28;
      group.push({
        id,
        tx,
        ty,
        r: `${(Math.random() - 0.5) * 48}deg`,
        durationMs: 1650 + Math.floor(Math.random() * 550),
        delayMs: Math.floor(Math.random() * 120)
      });
    }
    setParticles((prev) => [...prev, ...group].slice(-48));
    window.setTimeout(() => {
      const ids = new Set(group.map((g) => g.id));
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, PARTICLE_TTL_MS);
  }, []);

  const tapLocked = tapCount >= HEART_LIMIT_PER_GUEST;

  async function onHeartPress() {
    if (state === "sending" || tapLocked) return;

    setState("sending");
    try {
      const response = await fetch(`/api/hearts/${encodeURIComponent(slug)}`, { method: "POST" });
      redirectHomeIfUnauthorized(response.status);

      if (!response.ok) {
        setState("error");
        return;
      }

      const data = (await response.json()) as HeartPostJson;
      const n = Math.min(
        Math.max(Number(data.pressedByGuest) || 0, 0),
        HEART_LIMIT_PER_GUEST
      );
      setTapCount(n);

      if (data.reachedLimit || !data.accepted) {
        setState("limit");
        return;
      }

      spawnBurst();
      setState(n >= HEART_LIMIT_PER_GUEST ? "limit" : "thanked");
    } catch {
      setState("error");
    }
  }

  const disabled = state === "sending" || tapLocked;
  const label =
    state === "sending"
      ? "送信中..."
      : state === "thanked"
        ? "ありがとう！"
        : state === "limit"
          ? "光栄です！"
          : state === "error"
            ? "失敗しました。もう一度"
            : "ハートを送る";

  const actionClass = [
    styles.action,
    state === "thanked" && styles.actionThanked,
    state === "limit" && styles.actionLimit,
    state === "error" && styles.actionError
  ]
    .filter(Boolean)
    .join(" ");

  const buttonStateClass =
    state === "thanked"
      ? styles.buttonThanked
      : state === "limit"
        ? styles.buttonLimit
        : state === "error"
          ? styles.buttonError
          : state === "sending"
            ? styles.buttonSending
            : undefined;

  const buttonClass = [
    styles.button,
    buttonStateClass,
    tapLocked && styles.buttonTapLock
  ]
    .filter(Boolean)
    .join(" ");

  /** リングは常に上限数で等分し、塗りつぶし数だけ小ハートを配置（表示数＝サーバー回数≤上限） */
  const ringFilled = Math.min(Math.max(tapCount, 0), HEART_LIMIT_PER_GUEST);
  const orbitStyle =
    ringFilled > 0
      ? ({ "--orbit-n": HEART_LIMIT_PER_GUEST } as CSSProperties)
      : undefined;

  const showLabel =
    state === "sending" ||
    state === "thanked" ||
    state === "limit" ||
    state === "error" ||
    (state === "idle" && !tapLocked);

  return (
    <div className={`${actionClass} ${styles.inner}`}>
      <p className={styles.hint}>ハートでお気に入りを伝えよう</p>
      <div className={styles.buttonShell}>
        <button
          type="button"
          className={buttonClass}
          onClick={onHeartPress}
          disabled={disabled}
          aria-label={tapLocked ? "この記事へのハートは上限に達しました" : "ハートを送る"}
        >
          <span className={styles.buttonStack}>
            {ringFilled > 0 ? (
              <div className={styles.orbitLayer} aria-hidden style={orbitStyle}>
                <div key={ringFilled} className={styles.orbitSpinner}>
                  {Array.from({ length: ringFilled }, (_, i) => (
                    <span
                      key={i}
                      className={styles.orbitArm}
                      style={{ "--orbit-i": i } as CSSProperties}
                    >
                      <MdFavorite className={styles.orbitMi} size={10} color={HEART_COLOR_MAX} />
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <span className={styles.buttonIconBreathe} aria-hidden="true">
              <span className={styles.buttonIconWrap}>
                <MdFavorite className={styles.buttonIconMi} size={30} color={HEART_COLOR_MAX} />
              </span>
            </span>
          </span>
        </button>
        <div className={styles.particleRoot} aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className={styles.particle}
            style={
              {
                "--tx": `${p.tx}px`,
                "--ty": `${p.ty}px`,
                "--r": p.r,
                "--float-dur": `${p.durationMs}ms`,
                "--float-delay": `${p.delayMs}ms`
              } as CSSProperties
            }
          >
            <MdFavorite className={styles.particleMi} size={24} color={HEART_COLOR_MAX} />
          </span>
        ))}
        </div>
      </div>
      {showLabel ? <p className={`${styles.label} meta`}>{label}</p> : null}
    </div>
  );
}
