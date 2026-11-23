'use client';

import * as React from 'react';
import type { AnimationItem } from 'lottie-web';

export function CatalogVisualBanner() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const animRef = React.useRef<AnimationItem | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    async function initLottie() {
      if (!containerRef.current) return;
      try {
        const lottie = (await import('lottie-web')).default;
        if (!isMounted || !containerRef.current) return;

        if (animRef.current) {
          animRef.current.destroy();
        }

        const anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: '/animations/exam-hero.json',
        });

        animRef.current = anim;

        anim.addEventListener('DOMLoaded', () => {
          if (isMounted) setIsLoaded(true);
        });

        anim.addEventListener('data_failed', () => {
          if (!isMounted || !containerRef.current) return;
          anim.destroy();
          animRef.current = lottie.loadAnimation({
            container: containerRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: 'https://lottie.host/1a80990e-efb1-40c4-b540-47fe4864dd09/5xSGHyLQDz.json',
          });
        });
      } catch (err) {
        console.error('Failed to initialize Lottie animation:', err);
      }
    }

    initLottie();

    return () => {
      isMounted = false;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full max-w-lg mx-auto select-none">
      {/* Ambient gradient glow in Sakuga palette */}
      <div className="absolute -inset-4 bg-gradient-to-tr from-[#edeaff] via-[#b8b3ff]/30 to-[#faf9fe] dark:from-[#1e1b3d] dark:via-[#635bff]/20 dark:to-[#0d0c1d] rounded-3xl blur-2xl opacity-70 -z-10" />

      {/* Main Visual Frame with Lottie Animation */}
      <div className="relative rounded-2xl border border-[#e6e3f8] dark:border-[#2c2854] bg-white/80 dark:bg-[#15132d]/80 backdrop-blur-md p-4 sm:p-6 shadow-[0_8px_32px_rgba(184,179,255,0.14)] overflow-hidden transition-all flex flex-col items-center justify-center min-h-[300px]">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-[#15132d]/40">
            <div className="w-10 h-10 border-2 border-[#635bff] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full h-auto max-w-[460px] flex items-center justify-center transition-opacity duration-300"
          style={{ opacity: isLoaded ? 1 : 0 }}
        />
      </div>
    </div>
  );
}
