'use client';

import * as React from 'react';
import { Lock, KeyRound, ArrowRight, AlertCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export function AdminPinGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [pinDigits, setPinDigits] = React.useState<string[]>(Array(8).fill(''));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    // Auto-focus first input
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric characters
    const numericChar = value.replace(/\D/g, '').slice(-1);

    const newDigits = [...pinDigits];
    newDigits[index] = numericChar;
    setPinDigits(newDigits);
    setError(null);

    // Auto-advance to next input if filled
    if (numericChar && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 8 digits entered
    if (numericChar && index === 7 && newDigits.every((d) => d !== '')) {
      submitPin(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!pinDigits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 8);
    if (!pasted) return;

    const newDigits = Array(8).fill('');
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setPinDigits(newDigits);
    setError(null);

    if (pasted.length === 8) {
      inputRefs.current[7]?.focus();
      submitPin(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  const submitPin = async (fullPin?: string) => {
    const pin = fullPin || pinDigits.join('');

    if (pin.length !== 8) {
      setError('Please enter all 8 digits of your security PIN.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Incorrect security PIN. Please try again.');
        setPinDigits(Array(8).fill(''));
        inputRefs.current[0]?.focus();
        toast.error('Authentication failed: Invalid PIN');
        return;
      }

      toast.success('Administrator identity verified.');
      onAuthenticated();
    } catch {
      setError('Connection error verifying security PIN.');
      toast.error('Network error verifying PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      <Card className="w-full max-w-md p-2 shadow-xs">
        <CardHeader className="text-center pb-2 pt-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-gray-900">
            Administrator Security Access
          </CardTitle>
          <CardDescription className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            This control plane is restricted. Enter the 8-digit security PIN configured in your environment to proceed.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4 pb-6">
          {error && (
            <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 8-Digit Input Boxes */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 on-paste" onPaste={handlePaste}>
            {pinDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-9 h-12 sm:w-10 sm:h-12 text-center text-lg font-bold font-mono rounded-lg border transition-all focus:outline-hidden ${
                  digit
                    ? 'border-gray-900 bg-white text-gray-900 ring-1 ring-gray-900'
                    : 'border-gray-300 bg-gray-50/50 text-gray-900 focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900'
                }`}
              />
            ))}
          </div>

          <Button
            type="button"
            isLoading={loading}
            onClick={() => submitPin()}
            className="w-full text-xs uppercase tracking-wider font-semibold gap-2 h-11"
          >
            <span>Verify & Unlock Console</span>
            <ArrowRight className="w-4 h-4" />
          </Button>

          <div className="pt-2 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400">
              PIN is defined by <code className="font-mono text-gray-600 font-semibold">ADMIN_PIN</code> in your <code className="font-mono text-gray-600">.env.local</code> file.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

