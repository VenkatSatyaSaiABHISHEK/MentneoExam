import Link from 'next/link';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
        <nav className="flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-gray-900">
          <Link href="/exam" className="hover:text-gray-600 transition-colors tracking-widest">
            MENTNEO
          </Link>
        </nav>
      </div>
    </header>
  );
}

