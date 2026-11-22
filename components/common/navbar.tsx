'use client';

import * as React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { ShieldCheck } from 'lucide-react';

interface NavbarProps {
  showAdmin?: boolean;
}

export function Navbar({ showAdmin = false }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#e6e3f8] dark:border-[#2c2854] bg-[#faf9fe]/90 dark:bg-[#0d0c1d]/90 backdrop-blur-md transition-colors">
      <div className="w-full px-4 sm:px-8 lg:px-12 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/exam" className="flex items-center gap-2 group">
          <span className="font-serif text-lg sm:text-xl font-medium tracking-tight text-[#1d1a4a] dark:text-[#f4f3ff] group-hover:text-[#635bff] dark:group-hover:text-[#b8b3ff] transition-colors">
            Mentneo
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          {showAdmin && (
            <Link
              href="/exam/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#706b9b] dark:text-[#a4a0c8] hover:text-[#1d1a4a] dark:hover:text-[#f4f3ff] bg-[#f0effe] dark:bg-[#1e1b3d] hover:bg-[#e0ddfc] dark:hover:bg-[#2c2854] border border-[#e6e3f8] dark:border-[#2c2854] transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
