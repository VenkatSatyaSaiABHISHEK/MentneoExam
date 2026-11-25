'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ExternalLink, QrCode, Smartphone, Radio } from 'lucide-react';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function AdminExamRemoteContent() {
  const params = useParams();
  const examId = params.examId as string;
  const [examSlug, setExamSlug] = React.useState<string>(examId);

  React.useEffect(() => {
    fetch(`/api/examinations`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) {
          const found = j.data.find((e: any) => e.id === examId);
          if (found?.slug) setExamSlug(found.slug);
        }
      })
      .catch(() => {});
  }, [examId]);

  const remoteUrl = typeof window !== 'undefined' ? `${window.location.origin}/remote/${examSlug}` : `/remote/${examSlug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(remoteUrl);
    toast.success('Exam Remote link copied to clipboard.');
  };

  return (
    <AdminLayoutWrapper>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
          <div>
            <Link
              href={`/exam/admin/examinations/${examId}`}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 uppercase font-semibold tracking-wider mb-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Examination</span>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                <Radio className="w-6 h-6 text-indigo-600 animate-pulse" />
                <span>Mobile Exam Remote Control</span>
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Operator Station
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Open the dedicated mobile remote on your smartphone or share with on-ground invigilators to control candidate admission, live status, and broadcast alerts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 text-xs">
              <span>Copy Link</span>
            </Button>
            <a
              href={`/remote/${examSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              <span>Launch Remote</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Remote Live Simulator / Preview Frame */}
        <div className="bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-800 flex flex-col items-center">
          <div className="w-full max-w-md bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl h-[700px] flex flex-col">
            <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Mobile Device Simulator
              </span>
              <a
                href={`/remote/${examSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Fullscreen</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <iframe
              src={`/remote/${examSlug}`}
              className="w-full flex-1 border-0"
              title="Exam Remote Preview"
            />
          </div>
        </div>
      </div>
    </AdminLayoutWrapper>
  );
}

export default function AdminExamRemotePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">Loading Remote Control Station...</div>}>
      <AdminExamRemoteContent />
    </React.Suspense>
  );
}
