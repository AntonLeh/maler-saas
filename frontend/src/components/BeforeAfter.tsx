// Vorher/Nachher-Fotos zum Vergleichen (Startseite und Unterseite „Werbung mit KI“); Stile in pages/LandingPage.css (.lp-ba)
import { useEffect, useState } from "react";

/** Vorher/Nachher-Vergleich zum Ziehen; fährt beim ersten Sichtbarwerden einmal hin und her */
export default function BeforeAfter() {
  const [pos, setPos] = useState(50);
  const [touched, setTouched] = useState(false);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el || touched) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        const t0 = performance.now();
        const run = (t: number) => {
          const k = Math.min(1, (t - t0) / 2600);
          // 50 → 85 → 15 → 50
          const v =
            k < 0.25
              ? 50 + 35 * (k / 0.25)
              : k < 0.75
                ? 85 - 70 * ((k - 0.25) / 0.5)
                : 15 + 35 * ((k - 0.75) / 0.25);
          setPos(v);
          if (k < 1) raf = requestAnimationFrame(run);
        };
        raf = requestAnimationFrame(run);
      },
      { threshold: 0.6 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [el, touched]);
  return (
    <div
      className="lp-ba"
      ref={setEl}
      style={{ ["--pos" as string]: `${pos}%` }}
    >
      <img
        src="/images/werbung-nachher.webp"
        srcSet="/images/werbung-nachher.webp 800w, /images/werbung-nachher-1200.webp 1200w"
        sizes="(max-width: 640px) 90vw, 360px"
        alt="Fassade nach dem Anstrich"
        width="800"
        height="597"
        loading="lazy"
        decoding="async"
      />
      <img
        className="lp-ba-before"
        src="/images/werbung-vorher.webp"
        srcSet="/images/werbung-vorher.webp 800w, /images/werbung-vorher-1200.webp 1200w"
        sizes="(max-width: 640px) 90vw, 360px"
        alt="Fassade vor dem Anstrich mit Gerüst"
        width="800"
        height="597"
        loading="lazy"
        decoding="async"
      />
      <em className="lp-ba-tag lp-ba-tag-before">Vorher</em>
      <em className="lp-ba-tag lp-ba-tag-after">Nachher</em>
      <span className="lp-ba-line" aria-hidden="true">
        <span>↔</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        aria-label="Vorher und Nachher vergleichen"
        onChange={(e) => {
          setTouched(true);
          setPos(Number(e.target.value));
        }}
      />
    </div>
  );
}
