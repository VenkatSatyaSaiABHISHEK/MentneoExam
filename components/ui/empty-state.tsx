import * as React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-gray-200 rounded-xl bg-white">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 border border-gray-200 text-gray-500 mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

