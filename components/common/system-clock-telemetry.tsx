'use client';

import * as React from 'react';
import { Clock, ShieldCheck, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [dateString, setDateString] = React.useState<string>('');

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
      setDateString(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [showSeconds]);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 px-3 py-1.5 rounded-lg border border-slate-200/80 bg-white/90 backdrop-blur-md shadow-2xs font-mono text-xs select-none',
        className
      )}
    >
      {/* Live Blinking Green Status Dot */}
      <div className="flex items-center gap-1.5 shrink-0" title="All Systems Operational • Supabase Synced">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[10px] font-bold tracking-wider text-emerald-800 uppercase hidden md:inline">
          Live
        </span>
      </div>

      <span className="text-slate-200 hidden sm:inline">|</span>

      {/* Clock Display */}
      <div className="flex items-center gap-1.5 text-slate-800 font-semibold tabular-nums shrink-0">
        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>{timeString}</span>
      </div>

      {showDatabaseStatus && (
        <>
          <span className="text-slate-200 hidden lg:inline">|</span>
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-600 font-medium shrink-0">
            <Database className="w-3 h-3 text-emerald-600" />
            <span className="truncate max-w-[140px] text-slate-700">Supabase Cloud</span>
          </div>
        </>
      )}
    </div>
  );
}

