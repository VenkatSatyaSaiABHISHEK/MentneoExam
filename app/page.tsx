import Link from 'next/link';
import { Layers, Clock, Cpu } from 'lucide-react';
import { Navbar } from '@/components/common/navbar';
import { HomeHeroActions } from '@/components/landing/home-hero-actions';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#faf9fe] dark:bg-[#0d0c1d] text-[#1d1a4a] dark:text-[#f4f3ff] transition-colors">
      <Navbar />

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-28 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full border border-[#e0ddfc] dark:border-[#38336d] bg-[#f0effe] dark:bg-[#1e1b3d] text-[11px] sm:text-xs font-semibold text-[#635bff] dark:text-[#b8b3ff] tracking-wider uppercase mb-6 sm:mb-8 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Production-Grade Assessment Platform
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#1d1a4a] dark:text-[#f4f3ff] max-w-4xl leading-[1.2] sm:leading-[1.15]">
          Multi-Round Examination &amp; Automatic Student Qualification
        </h1>

        <p className="mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg text-[#706b9b] dark:text-[#a4a0c8] max-w-2xl leading-relaxed px-2 sm:px-0">
          Conduct high-stakes examinations for 200+ students concurrently. Features dynamic round configuration, server-authoritative timer synchronization, open-source OCR question import, and instantaneous server-side answer evaluation.
        </p>

        {/* Sakuga VFX Interactive Buttons */}
        <HomeHeroActions />

        {/* Feature Highlights Grid */}
        <div className="mt-12 sm:mt-20 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-left w-full border-t border-[#e6e3f8] dark:border-[#2c2854] pt-10 sm:pt-16">
          <div className="p-6 rounded-2xl border border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] shadow-[0_4px_24px_rgba(184,179,255,0.08)] hover:border-[#b8b3ff] dark:hover:border-[#635bff] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#f0effe] dark:bg-[#1e1b3d] border border-[#e0ddfc] dark:border-[#38336d] flex items-center justify-center text-[#635bff] dark:text-[#b8b3ff] mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#1d1a4a] dark:text-[#f4f3ff] tracking-tight uppercase">Dynamic Multi-Round</h3>
            <p className="mt-2 text-xs text-[#706b9b] dark:text-[#a4a0c8] leading-relaxed">
              Configure unlimited rounds with individual question pools, timing thresholds, negative marking rules, and automatic qualification gates.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] shadow-[0_4px_24px_rgba(184,179,255,0.08)] hover:border-[#b8b3ff] dark:hover:border-[#635bff] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#f0effe] dark:bg-[#1e1b3d] border border-[#e0ddfc] dark:border-[#38336d] flex items-center justify-center text-[#635bff] dark:text-[#b8b3ff] mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#1d1a4a] dark:text-[#f4f3ff] tracking-tight uppercase">Server-Authoritative Timer</h3>
            <p className="mt-2 text-xs text-[#706b9b] dark:text-[#a4a0c8] leading-relaxed">
              Examination deadlines are strictly recorded and enforced by the database. Refreshing, reconnecting, or tampering with client clocks cannot extend examination time.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] shadow-[0_4px_24px_rgba(184,179,255,0.08)] hover:border-[#b8b3ff] dark:hover:border-[#635bff] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#f0effe] dark:bg-[#1e1b3d] border border-[#e0ddfc] dark:border-[#38336d] flex items-center justify-center text-[#635bff] dark:text-[#b8b3ff] mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#1d1a4a] dark:text-[#f4f3ff] tracking-tight uppercase">OCR PDF Question Ingestion</h3>
            <p className="mt-2 text-xs text-[#706b9b] dark:text-[#a4a0c8] leading-relaxed">
              Upload multiple-page question papers. Fast extraction parses question stems, choices, and answer keys with human-in-the-loop review.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs text-[#706b9b] dark:text-[#a4a0c8] text-center sm:text-left">
          <p>ExamS Assessment Infrastructure. High concurrency multi-round evaluation platform.</p>
          <div className="flex items-center gap-6">
            <Link href="/exam" className="hover:text-[#1d1a4a] dark:hover:text-[#f4f3ff] transition-colors uppercase tracking-wider font-semibold">
              Public Portal
            </Link>
            <Link href="/exam/admin" className="hover:text-[#1d1a4a] dark:hover:text-[#f4f3ff] transition-colors uppercase tracking-wider font-semibold">
              Admin Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
