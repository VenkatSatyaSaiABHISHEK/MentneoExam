'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export function EnterExamButton({ slug }: { slug: string }) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement & { done?: (hold?: number) => void };
    if (typeof el?.done === 'function') {
      el.done(1.5);
    }
    setTimeout(() => {
      router.push(`/exam/${slug}`);
    }, 450);
  };

  return (
    <sakuga-button
      onClick={handleClick}
      class="cursor-pointer select-none inline-block text-sm"
    >
      Enter Examination
    </sakuga-button>
  );
}

