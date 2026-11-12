import Link from 'next/link';
import { ArrowRight, CheckCircle2, Shield, Layers, Clock, Cpu, Users } from 'lucide-react';
import { Navbar } from '@/components/common/navbar';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <Navbar />

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-20 lg:py-28 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 tracking-wider uppercase mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Production-Grade Assessment Platform
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 max-w-4xl leading-[1.15]">
          Multi-Round Examination & Automatic Student Qualification
        </h1>

        <p className="mt-6 text-base sm:text-lg text-gray-600 max-w-2xl leading-relaxed">
          Conduct high-stakes examinations for 200+ students concurrently. Features dynamic round configuration, server-authoritative timer synchronization, open-source OCR question import, and instantaneous server-side answer evaluation.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link href="/exam" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto px-8 gap-2 uppercase tracking-wider text-xs font-bold">
              <span>Explore Examinations</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/admin" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 uppercase tracking-wider text-xs font-bold">
              <span>Admin Console</span>
            </Button>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full border-t border-gray-100 pt-16">
          <div className="p-6 rounded-xl border border-gray-200 bg-white">
            <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-900 mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-tight uppercase">Dynamic Multi-Round</h3>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              Configure unlimited rounds with individual question pools, timing thresholds, negative marking rules, and automatic qualification gates.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-gray-200 bg-white">
            <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-900 mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-tight uppercase">Server-Authoritative Timer</h3>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              Examination deadlines are strictly recorded and enforced by the database. Refreshing, reconnecting, or tampering with client clocks cannot extend examination time.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-gray-200 bg-white">
            <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-900 mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-tight uppercase">OCR PDF Question Ingestion</h3>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              Upload multiple-page question papers. Fast extraction parses question stems, choices, and answer keys with human-in-the-loop review.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>ExamS Assessment Infrastructure. High concurrency multi-round evaluation platform.</p>
          <div className="flex items-center gap-6">
            <Link href="/exam" className="hover:text-gray-900 transition-colors uppercase tracking-wider font-semibold">
              Public Portal
            </Link>
            <Link href="/admin" className="hover:text-gray-900 transition-colors uppercase tracking-wider font-semibold">
              Admin Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
