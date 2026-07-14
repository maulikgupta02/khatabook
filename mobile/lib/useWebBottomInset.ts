import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Mobile browsers (Chrome/Safari) show a bottom toolbar whose height isn't fixed --
// it varies by browser/device and can hide/show on scroll. window.innerHeight (the
// layout viewport) doesn't shrink to match, but window.visualViewport does, so the
// gap between them is exactly how much of the bottom is currently occluded by that
// toolbar. Recomputed live on every visualViewport resize/scroll so a fixed-position
// bottom tab bar never sits underneath it. No-ops on native (insets.bottom is used
// there instead) and on browsers without visualViewport support (falls back to a
// fixed guess).
export function useWebBottomInset(fallback = 28) {
  const [inset, setInset] = useState(fallback);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const gap = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(fallback, Math.round(gap)));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [fallback]);

  return inset;
}
