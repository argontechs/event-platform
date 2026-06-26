"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const HeroScene = dynamic(
  () => import("./hero-scene").then((m) => m.HeroScene),
  { ssr: false },
);

/**
 * Mounts the 3D hero only client-side, and only when the user hasn't asked
 * for reduced motion. Until then (and as the fallback) the CSS gradient
 * behind it shows — keeping LCP fast and respecting accessibility.
 */
export function Hero3D() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setEnabled(!mq.matches);
  }, []);

  if (!enabled) return null;
  return <HeroScene />;
}
