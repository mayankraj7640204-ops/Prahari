**Add a one-time splash/intro animation to the Prahari landing page: a large centered wordmark that scales and fades in, holds briefly, then shrinks and morphs into its final position as the nav-bar logo while the page reveals underneath. Total duration ~2.5s. Build with React + TypeScript + Tailwind CSS + Framer Motion, matching the existing Vite project structure (`@/` alias to `src/`).**

## Dependency
Install `framer-motion` if not already present:
```
npm install framer-motion
```

## Core technique
Use Framer Motion's **shared layout animation** (`layoutId`) so the splash wordmark and the nav wordmark are treated as the *same element* — this is what produces the "shrinks and moves into the nav" morph, rather than two separate fade animations that merely look similar.

- Both the splash-screen logo and the real nav-bar logo get `layoutId="prahari-logo"`.
- Wrap both in `<AnimatePresence>` / `<motion.div layoutId="prahari-logo">`.
- When the splash unmounts, Framer Motion automatically animates the shared element from its splash position/size to its nav position/size.

## Component: `src/components/IntroSplash.tsx`

**Behavior / timeline:**
1. `0.0s–0.6s` — Full-screen overlay fades in (`opacity 0 → 1`), wordmark scales and fades in from `scale: 0.8, opacity: 0` to `scale: 1, opacity: 1` (ease `[0.16, 1, 0.3, 1]`, an "ease-out-expo" feel).
2. `0.6s–1.6s` — Hold: wordmark sits centered, full size, overlay fully opaque (or near-opaque with a subtle background — see styling below).
3. `1.6s–2.5s` — Exit: overlay background fades out (`opacity 1 → 0`) while the wordmark (via shared `layoutId`) animates from its centered/large position to the nav bar's actual logo position and size. These happen simultaneously so the wordmark appears to "fly" into place as the curtain lifts.
4. After `2.5s`, unmount the splash component entirely (`AnimatePresence` `onExitComplete`, or a `setTimeout` driving a `showIntro` state) and reveal the real page (nav + hero) underneath, which was already mounted but hidden/covered by the overlay (`z-50`) the whole time — do NOT delay-mount the page; mount it immediately underneath so there's no flash/pop when the overlay clears.

**Structure:**
```tsx
// src/components/IntroSplash.tsx
import { motion, AnimatePresence } from 'framer-motion';

interface IntroSplashProps {
  show: boolean;
}

export function IntroSplash({ show }: IntroSplashProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, delay: 1.6, ease: [0.65, 0, 0.35, 1] }}
        >
          <motion.span
            layoutId="prahari-logo"
            className="font-display text-[64px] md:text-[88px] text-white leading-none select-none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            prahari
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Nav-bar logo must share the same `layoutId`:**
```tsx
// inside your existing Nav component
<motion.span
  layoutId="prahari-logo"
  className="font-display text-[32px] text-black leading-none select-none"
>
  prahari
</motion.span>
```
Framer Motion needs both elements mounted in the tree at the moment of transition for the shared-layout morph to compute correctly — the exiting splash and the entering nav logo should overlap for one frame, which `AnimatePresence` handles automatically as long as the nav is already rendered underneath (not conditionally mounted after the splash).

## Wiring it up in `App.tsx`
```tsx
import { useState, useEffect } from 'react';
import { IntroSplash } from '@/components/IntroSplash';
import { Hero } from '@/components/Hero';

function App() {
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    document.body.style.overflow = showIntro ? 'hidden' : '';
    const timer = setTimeout(() => setShowIntro(false), 2500);
    return () => clearTimeout(timer);
  }, [showIntro]);

  return (
    <div className="relative">
      <Hero />
      <IntroSplash show={showIntro} />
    </div>
  );
}

export default App;
```
- Body scroll is locked (`overflow: hidden`) while the intro plays, then restored.
- `Hero` (which contains the real nav with the `layoutId="prahari-logo"` element) is mounted from the start, sitting *underneath* the splash overlay (`z-50` on splash vs. normal stacking on the page), so the morph target already exists in the DOM.

## Styling notes for Prahari
- Splash background: solid dark (`#0a0a0a`) or your Prahari brand dark tone — adjust to match your actual palette.
- Wordmark font: use whatever display/logo font Prahari's nav already uses, so the splash and nav versions are visually identical except for size — this is required for the morph to look seamless, not just technically correct.
- Keep the splash wordmark's horizontal center roughly aligned with where the nav logo will sit (left-aligned nav) so the movement reads as a deliberate "settle into place" rather than a diagonal jump — small position mismatches are fine and part of the effect, but avoid it flying across the whole viewport.

## Accessibility / practical notes
- Respect `prefers-reduced-motion`: if set, skip straight to the settled state (render nav immediately, skip the splash) rather than forcing the animation.
- Only show the intro once per session — store a flag in `sessionStorage` (`prahari-intro-shown`) so it doesn't replay on every route change or refresh within the same session.
