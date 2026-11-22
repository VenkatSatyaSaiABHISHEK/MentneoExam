'use client';

import * as React from 'react';
import { Clock, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/common/theme-toggle';

interface SystemClockTelemetryProps {
  className?: string;
  showSeconds?: boolean;
  showDatabaseStatus?: boolean;
}

export function SystemClockTelemetry({
  className,
  showSeconds = true,
  showDatabaseStatus = true,
}: SystemClockTelemetryProps) {
  const [timeString, setTimeString] = React.useState<string>('--:--:--');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: showSeconds ? '2-digit' : undefined,
          hour12: true,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [showSeconds]);

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md shadow-2xs font-mono text-xs select-none transition-colors',
          className
        )}
      >
        {/* Live Status Indicator */}
        <div className="flex items-center gap-1.5 shrink-0" title="All Systems Operational • PostgreSQL Engine Active">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-bold tracking-wider text-emerald-700 dark:text-emerald-400 uppercase hidden md:inline">
            Live
          </span>
        </div>

        <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>

        {/* Clock Display */}
        <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-semibold tabular-nums shrink-0">
          <Clock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
          <span>{timeString}</span>
        </div>

        {showDatabaseStatus && (
          <>
            <span className="text-zinc-300 dark:text-zinc-700 hidden lg:inline">|</span>
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 font-medium shrink-0">
              <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate max-w-[150px] text-zinc-700 dark:text-zinc-300">PostgreSQL (Local Engine)</span>
            </div>
          </>
        )}
      </div>

      <ThemeToggle />
    </div>
  );
}
