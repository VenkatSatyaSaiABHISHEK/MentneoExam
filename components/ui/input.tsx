import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, label, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-gray-700 tracking-wide">
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          className={cn(
            'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-gray-900 focus:outline-hidden focus:ring-1 focus:ring-gray-900 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
            error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-rose-600 font-medium">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';

