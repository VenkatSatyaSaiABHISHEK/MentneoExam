'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  className,
}: {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-gray-200 overflow-x-auto', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 py-2.5 px-3.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer',
              isActive
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-mono',
                  isActive ? 'bg-gray-100 text-gray-900' : 'bg-gray-100 text-gray-500'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

