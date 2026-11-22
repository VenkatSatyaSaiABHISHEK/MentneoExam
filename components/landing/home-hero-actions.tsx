'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export function HomeHeroActions() {
  const router = useRouter();

  const handleExploreClick = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement & { done?: (hold?: number) => void };
    if (typeof el?.done === 'function') {
      el.done(1.5);
    }
    setTimeout(() => {
      router.push('/exam');
    }, 450);
  };

  const handleAdminClick = (e: React.MouseEvent<HTMLElement>) => {
    router.push('/exam/admin');
  };

  return (
    <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 w-full sm:w-auto">
      {/* Primary Sakuga Button */}
      <sakuga-button
        onClick={handleExploreClick}
        class="cursor-pointer select-none inline-block w-full sm:w-auto text-center"
      >
        Explore Examinations
      </sakuga-button>

      {/* Secondary Sakuga Button */}
      <sakuga-button
        variant="secondary"
        onClick={handleAdminClick}
        class="cursor-pointer select-none inline-block w-full sm:w-auto text-center"
      >
        Admin Console
      </sakuga-button>
    </div>
  );
}

