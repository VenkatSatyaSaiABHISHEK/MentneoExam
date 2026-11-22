'use client';

import * as React from 'react';
import { ShieldCheck, Cpu, Zap, Activity, CheckCircle2 } from 'lucide-react';

export function CatalogVisualBanner() {
  return (
    <div className="relative w-full max-w-md mx-auto select-none">
      {/* Ambient gradient glow in Sakuga palette */}
      <div className="absolute -inset-4 bg-gradient-to-tr from-[#edeaff] via-[#b8b3ff]/30 to-[#faf9fe] dark:from-[#1e1b3d] dark:via-[#635bff]/20 dark:to-[#0d0c1d] rounded-3xl blur-2xl opacity-70 -z-10" />

      {/* Main Visual Frame */}
      <div className="relative rounded-2xl border border-[#e6e3f8] dark:border-[#2c2854] bg-white/80 dark:bg-[#15132d]/80 backdrop-blur-md p-6 shadow-[0_8px_32px_rgba(184,179,255,0.14)] overflow-hidden transition-all">
        {/* Subtle background circuit watermark */}
        <div className="absolute top-0 right-0 w-44 h-44 opacity-10 dark:opacity-5 pointer-events-none">
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" className="text-[#1d1a4a] dark:text-white">
            <circle cx="50" cy="50" r="40" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="50" cy="50" r="28" strokeWidth="1.5" />
            <path d="M50 10 L50 90 M10 50 L90 50" strokeWidth="1" />
          </svg>
        </div>

        {/* Top Header Row */}
        <div className="flex items-center justify-between pb-4 border-b border-[#e6e3f8] dark:border-[#2c2854]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-[#1d1a4a] dark:text-[#f4f3ff]">
              Proctoring Telemetry Active
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#8580b0] bg-[#f0effe] dark:bg-[#1e1b3d] px-2 py-0.5 rounded border border-[#e0ddfc] dark:border-[#38336d]">
            ACID WAL
          </span>
        </div>

        {/* Center Illustration: Pulsing Core Radar */}
        <div className="py-6 flex flex-col items-center justify-center text-center">
          <div className="relative flex items-center justify-center w-24 h-24 mb-4">
            {/* Outer pulsating ring */}
            <div className="absolute inset-0 rounded-full border-2 border-[#b8b3ff] dark:border-[#635bff] animate-ping opacity-25" />
            {/* Middle soft border ring */}
            <div className="absolute inset-2 rounded-full border border-dashed border-[#8f8df7] dark:border-[#8f8df7] animate-spin [animation-duration:18s]" />
            {/* Core badge icon */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1d1a4a] to-[#2d2770] dark:from-[#b8b3ff] dark:to-[#8f8df7] text-white dark:text-[#0d0c1d] flex items-center justify-center shadow-lg transform transition-transform hover:scale-105">
              <ShieldCheck className="w-7 h-7" />
            </div>
          </div>

          <h3 className="text-base font-semibold text-[#1d1a4a] dark:text-[#f4f3ff] tracking-tight">
            High Concurrency Engine
          </h3>
          <p className="mt-1 text-xs text-[#706b9b] dark:text-[#a4a0c8] max-w-xs leading-relaxed">
            Synchronized question pools with millisecond server-authoritative timer tracking.
          </p>
        </div>

        {/* Floating Telemetry Pills */}
        <div className="grid grid-cols-2 gap-2 pt-4 border-t border-[#e6e3f8] dark:border-[#2c2854]">
          <div className="p-2.5 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d] border border-[#e6e3f8] dark:border-[#2c2854] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#8f8df7] shrink-0" />
            <div className="truncate">
              <div className="text-[10px] text-[#706b9b] dark:text-[#a4a0c8] uppercase font-semibold">Latency</div>
              <div className="text-xs font-mono font-bold text-[#1d1a4a] dark:text-[#f4f3ff]">0.4ms Sub-Tick</div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d] border border-[#e6e3f8] dark:border-[#2c2854] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#8f8df7] shrink-0" />
            <div className="truncate">
              <div className="text-[10px] text-[#706b9b] dark:text-[#a4a0c8] uppercase font-semibold">Concurrency</div>
              <div className="text-xs font-mono font-bold text-[#1d1a4a] dark:text-[#f4f3ff]">200+ Nodes</div>
            </div>
          </div>
        </div>

        {/* Footer status line */}
        <div className="mt-3 flex items-center justify-between text-[10px] text-[#8580b0] font-mono">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Zero Client Drift
          </span>
          <span>v2.4 Production</span>
        </div>
      </div>
    </div>
  );
}

