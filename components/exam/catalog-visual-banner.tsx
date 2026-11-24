'use client';

import * as React from 'react';

declare global {
  interface Window {
    lottie?: any;
    bodymovin?: any;
  }
}

export function CatalogVisualBanner() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const animRef = React.useRef<any>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function initAnimation() {
      if (!containerRef.current) return;

      // 1. Ensure Lottie engine runtime is available
      let lottie = window.lottie || window.bodymovin;

      if (!lottie) {
        try {
          // @ts-ignore
          const mod = await import('lottie-web').catch(() => null);
          lottie = mod?.default || mod;
        } catch {
          // Fallback to CDN script
        }
      }

      if (!lottie && typeof document !== 'undefined') {
        await new Promise<void>((resolve) => {
          const existing = document.getElementById('lottie-cdn-player');
          if (existing) {
            existing.addEventListener('load', () => resolve());
            setTimeout(resolve, 1200);
            return;
          }
          const s = document.createElement('script');
          s.id = 'lottie-cdn-player';
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => resolve();
          document.head.appendChild(s);
        });
        lottie = window.lottie || window.bodymovin;
      }

      if (!isMounted || !containerRef.current) return;

      // 2. Fetch animation JSON directly for instant synchronous SVG rendering
      let animationData: any = null;
      try {
        const localRes = await fetch('/animations/exam-hero.json');
        if (localRes.ok) {
          animationData = await localRes.json();
        }
      } catch (err) {
        console.warn('[Lottie] Local fetch failed, trying remote host:', err);
      }

      if (!animationData) {
        try {
          const remoteRes = await fetch(
            'https://lottie.host/1a80990e-efb1-40c4-b540-47fe4864dd09/5xSGHyLQDz.json'
          );
          if (remoteRes.ok) {
            animationData = await remoteRes.json();
          }
        } catch (err) {
          console.warn('[Lottie] Remote host fetch failed:', err);
        }
      }

      if (!isMounted || !containerRef.current || !lottie) return;

      // Clear any prior instance
      if (animRef.current) {
        try {
          animRef.current.destroy();
        } catch {}
        animRef.current = null;
      }

      try {
        if (animationData) {
          animRef.current = lottie.loadAnimation({
            container: containerRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData,
          });
        } else {
          // Fallback to path if fetch failed
          animRef.current = lottie.loadAnimation({
            container: containerRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: 'https://lottie.host/1a80990e-efb1-40c4-b540-47fe4864dd09/5xSGHyLQDz.json',
          });
        }
      } catch (err) {
        console.error('[Lottie] Failed to render animation:', err);
      }
    }

    initAnimation();

    return () => {
      isMounted = false;
      if (animRef.current) {
        try {
          animRef.current.destroy();
        } catch {}
        animRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full flex items-center justify-center select-none">
      {/* Seamless, transparent container without any card border or background box */}
      <div
        ref={containerRef}
        className="w-full max-w-[480px] h-[340px] sm:h-[380px] flex items-center justify-center pointer-events-none"
      />
    </div>
  );
}
