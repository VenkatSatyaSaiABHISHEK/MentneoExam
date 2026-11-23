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
  Cpu,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminPinGate } from '@/components/admin/admin-pin-gate';
import { SystemClockTelemetry } from '@/components/common/system-clock-telemetry';
import { toast } from 'sonner';

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
    { label: 'Cluster & Nodes', href: '/admin/cluster', icon: Cpu, exact: false },
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 space-y-3">
        <div className="w-8 h-8 border-2 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">
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
    <div className="min-h-screen md:h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col md:flex-row md:overflow-hidden transition-colors">
      {/* Mobile Unified Top Bar */}
      <div className="md:hidden h-14 px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 -ml-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link href="/exam/admin" className="flex items-center gap-2">
            <span className="font-serif text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Mentneo
            </span>
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest pl-1.5 border-l border-zinc-200 dark:border-zinc-800">
              Admin
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-mono uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
          <button
            onClick={handleLockConsole}
            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Lock Console"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Slide Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bottom-0 bg-black/50 backdrop-blur-xs z-50 flex flex-col">
          <div className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 p-4 space-y-3 shadow-xl">
            <p className="px-3 text-[10px] font-mono font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              Navigation
            </p>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = isItemActive(item.href, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors',
                      isActive
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
              <Link
                href="/exam"
                target="_blank"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors uppercase tracking-wider"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  Candidate Portal
                </span>
                <ChevronRight className="w-3 h-3 text-zinc-400" />
              </Link>
              <button
                onClick={handleLockConsole}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors uppercase tracking-wider text-left"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="w-3.5 h-3.5" />
                  Lock Console
                </span>
                <span className="text-[10px] text-rose-400 font-mono">PIN Secure</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex-col shrink-0 h-full z-40">
        <div className="h-16 px-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <Link href="/exam/admin" className="flex items-center gap-2 group">
            <span className="font-serif text-lg font-medium tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
              Mentneo
            </span>
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest pl-1.5 border-l border-zinc-200 dark:border-zinc-800">
              Admin
            </span>
          </Link>
        </div>

        <nav className="p-4 flex flex-col gap-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-mono font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            Navigation
          </p>
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
                    ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-zinc-950 dark:text-white' : 'text-zinc-400 dark:text-zinc-500')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2 mt-auto shrink-0">
          <Link
            href="/exam"
            target="_blank"
            className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors uppercase tracking-wider"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              Student Portal
            </span>
            <ChevronRight className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
          </Link>

          <button
            onClick={handleLockConsole}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors uppercase tracking-wider cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <LogOut className="w-3.5 h-3.5" />
              Lock Console
            </span>
            <span className="text-[10px] text-rose-400 font-mono">PIN Secure</span>
          </button>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5 px-3">
            <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <Shield className="w-3 h-3" />
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate">System Administrator</p>
              <p className="text-[10px] font-mono text-zinc-500 truncate">8-Digit PIN Protected</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 md:h-full md:overflow-hidden">
        {/* Desktop Top Header (Hidden on Mobile) */}
        <header className="hidden md:flex h-16 shrink-0 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md items-center justify-between z-30 shadow-2xs transition-colors">
          <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate font-mono">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-zinc-300 dark:text-zinc-700 shrink-0" />}
                <span className={idx === breadcrumbs.length - 1 ? 'text-zinc-900 dark:text-zinc-100 font-bold truncate' : 'text-zinc-500 dark:text-zinc-400 truncate'}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <SystemClockTelemetry />

            <button
              onClick={handleLockConsole}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors uppercase tracking-wider cursor-pointer font-mono"
            >
              <LogOut className="w-3 h-3 text-zinc-400" />
              <span>Lock</span>
            </button>

            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 uppercase tracking-wider font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              PIN Secure
            </span>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto min-w-0 bg-zinc-50/50 dark:bg-zinc-950/50">
          <div className="p-3.5 sm:p-6 md:p-8 max-w-7xl w-full mx-auto pb-24">{children}</div>
        </main>
      </div>
    </div>
  );
}
