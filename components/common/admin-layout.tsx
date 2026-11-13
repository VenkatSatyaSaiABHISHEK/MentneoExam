'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileCheck2,
  Settings,
  PlusCircle,
  ExternalLink,
  ChevronRight,
  Shield,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminPinGate } from '@/components/admin/admin-pin-gate';
import { SystemClockTelemetry } from '@/components/common/system-clock-telemetry';
import { toast } from 'sonner';

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/check-session');
        const data = await res.json();
        setIsAuthenticated(Boolean(data.authenticated));
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  const handleLockConsole = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      toast.info('Admin console locked.');
    } catch {
      // Ignore
    }
    setIsAuthenticated(false);
  };

  const navItems = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard, exact: true },
    { label: 'Examinations', href: '/admin/examinations', icon: FileCheck2, exact: false },
    { label: 'New Exam', href: '/admin/examinations/create', icon: PlusCircle, exact: false },
    { label: 'Settings & Logs', href: '/admin/settings', icon: Settings, exact: false },
  ];

  const isItemActive = (targetHref: string, exact?: boolean) => {
    const normPath = pathname.replace(/^\/exam/, '');
    if (exact) {
      return normPath === targetHref || pathname === targetHref;
    }
    return normPath.startsWith(targetHref) || pathname.startsWith(targetHref);
  };

  // Checking session
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 space-y-3">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
          Verifying Security Credentials...
        </span>
      </div>
    );
  }

  // If not authenticated with PIN, present the 8-digit PIN gate
  if (!isAuthenticated) {
    return <AdminPinGate onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  const getBreadcrumbs = () => {
    if (pathname === '/admin' || pathname === '/exam/admin') return ['Control Plane', 'Overview'];
    if (pathname.includes('/rounds') && pathname.includes('/questions')) return ['Examinations', 'Round Questions'];
    if (pathname.includes('/questions')) return ['Examinations', 'Question Bank'];
    if (pathname.includes('/stress-test')) return ['Examinations', 'Concurrency Lab'];
    if (pathname.includes('/results')) return ['Examinations', 'Live Monitor'];
    if (pathname.includes('/students')) return ['Examinations', 'Student Roster'];
    if (pathname.includes('/rounds')) return ['Examinations', 'Dynamic Rounds'];
    if (pathname.includes('/examinations/create')) return ['Examinations', 'Create Examination'];
    if (pathname.includes('/examinations/')) return ['Examinations', 'Overview'];
    if (pathname.includes('/examinations')) return ['Examinations', 'Directory'];
    if (pathname.includes('/settings')) return ['Settings & Logs'];
    return ['Control Plane', 'Overview'];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="h-screen w-full bg-gray-50/50 flex flex-col md:flex-row overflow-hidden">
      {/* Left Sidebar - Viewport Fixed on desktop */}
      <aside className="w-full md:w-64 border-r border-gray-200 bg-white flex flex-col shrink-0 h-auto md:h-full z-40 overflow-hidden">
        <div className="h-16 px-6 border-b border-gray-200 flex items-center justify-between shrink-0">
          <Link href="/exam/admin" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-sm tracking-wider">
              EX
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-gray-900">ExamS Admin</span>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Control Plane</p>
            </div>
          </Link>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Navigation</p>
          {navItems.map((item) => {
            const isActive = isItemActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors',
                  isActive
                    ? 'bg-gray-100 text-gray-900 font-bold'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-gray-900' : 'text-gray-400')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 bg-white space-y-2 shrink-0 mt-auto">
          <Link
            href="/exam"
            target="_blank"
            className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors uppercase tracking-wider"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
              Student Portal
            </span>
            <ChevronRight className="w-3 h-3 text-gray-400" />
          </Link>

          <button
            onClick={handleLockConsole}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors uppercase tracking-wider cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <LogOut className="w-3.5 h-3.5" />
              Lock Console
            </span>
            <span className="text-[10px] text-rose-400 font-mono">PIN Secure</span>
          </button>

          <div className="pt-2 border-t border-gray-100 flex items-center gap-2.5 px-3">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
              <Shield className="w-3 h-3" />
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-gray-900 truncate">System Administrator</p>
              <p className="text-[10px] text-gray-500 truncate">8-Digit PIN Protected</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header - Anchor Fixed across entire pane */}
        <header className="h-16 shrink-0 px-6 border-b border-gray-200 bg-white/95 backdrop-blur-md flex items-center justify-between z-30 shadow-2xs">
          <nav className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider truncate">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />}
                <span className={idx === breadcrumbs.length - 1 ? 'text-gray-900 font-bold truncate' : 'text-gray-500 truncate'}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <SystemClockTelemetry />

            <button
              onClick={handleLockConsole}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors uppercase tracking-wider cursor-pointer font-mono"
            >
              <LogOut className="w-3 h-3 text-gray-400" />
              <span>Lock</span>
            </button>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              PIN Authenticated
            </span>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="p-6 md:p-8 max-w-7xl w-full mx-auto pb-24">{children}</div>
        </main>
      </div>
    </div>
  );
}
