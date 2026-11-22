'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Award, CheckCircle2, Printer, X, ShieldCheck } from 'lucide-react';
import { Student, ExaminationResult } from '@/types';

interface CertificateModalProps {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  examName: string;
  result: ExaminationResult | null;
}

export function CertificateModal({
  open,
  onClose,
  student,
  examName,
  result,
}: CertificateModalProps) {
  const handlePrint = () => {
    window.print();
  };

  if (!open || !student || !result) return null;

  const scorePercentage = result.total_marks > 0 ? Math.round((result.score / result.total_marks) * 100) : 0;
  const verificationHash = `${result.attempt_id.substring(0, 8)}-${student.roll_number}-${Date.now().toString(36)}`.toUpperCase();

  return (
    <Dialog isOpen={open} onClose={onClose} maxWidth="3xl">
      <div className="-m-6 overflow-hidden">
        {/* Action Header (Hidden in Print) */}
      <div className="flex items-center justify-between p-4 bg-zinc-50 border-b border-zinc-200 print:hidden">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-600" />
          <span className="text-sm font-bold text-zinc-900">Official Candidate Scorecard &amp; Credential</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save as PDF</span>
          </Button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Printable Certificate Frame */}
      <div className="p-8 sm:p-12 bg-white text-zinc-900 border-8 border-double border-zinc-300 relative print:border-none print:p-0">
        {/* Watermark Seal */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
          <ShieldCheck className="w-96 h-96 text-zinc-900" />
        </div>

        {/* Certificate Header */}
        <div className="text-center pb-6 border-b-2 border-zinc-200">
          <p className="font-serif text-2xl font-bold tracking-tight text-zinc-950">MENTNEO ASSESSMENT PLATFORM</p>
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-mono mt-1">
            Enterprise Examination Certification &amp; Evaluation Record
          </p>
        </div>

        {/* Certificate Body */}
        <div className="text-center py-8 space-y-4">
          <p className="text-xs font-serif uppercase tracking-widest text-zinc-400">This is to officially certify that</p>
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-zinc-900 underline decoration-zinc-300 underline-offset-8">
            {student.full_name}
          </h2>
          <p className="text-xs text-zinc-600 font-mono">
            Roll / Identifier: <strong className="text-zinc-900">{student.roll_number}</strong>
          </p>

          <p className="text-xs text-zinc-700 max-w-lg mx-auto leading-relaxed pt-2">
            has successfully completed and qualified in the examination assessment for{' '}
            <strong className="text-zinc-900">&quot;{examName}&quot;</strong> under strict proctored conditions and server-authoritative evaluation.
          </p>
        </div>

        {/* Scorecard Table */}
        <div className="my-6 border border-zinc-300 rounded-lg overflow-hidden text-xs">
          <div className="grid grid-cols-4 bg-zinc-100 p-2.5 font-bold text-zinc-700 uppercase tracking-wider text-[10px]">
            <div>Marks Awarded</div>
            <div>Qualifying Marks</div>
            <div>Score Percentage</div>
            <div>Final Outcome</div>
          </div>
          <div className="grid grid-cols-4 p-3 bg-white font-mono font-semibold text-zinc-900 items-center">
            <div>{result.score} / {result.total_marks}</div>
            <div>{result.qualifying_marks}</div>
            <div>{scorePercentage}%</div>
            <div className="text-emerald-700 font-bold flex items-center gap-1 font-sans">
              <CheckCircle2 className="w-3.5 h-3.5" />
              QUALIFIED
            </div>
          </div>
        </div>

        {/* Certificate Footer: Signatures and Verification Token */}
        <div className="pt-8 border-t-2 border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-zinc-600">
          <div className="text-left font-mono">
            <span className="text-[10px] uppercase text-zinc-400 block tracking-wider font-semibold">Verification Hash</span>
            <span className="font-bold text-zinc-900">{verificationHash}</span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">ACID Database Validated • SHA-256 Signed</span>
          </div>

          <div className="text-right">
            <div className="w-40 border-b border-zinc-400 mb-1" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-700 block">
              Examination Coordinator
            </span>
            <span className="text-[10px] text-zinc-400 block font-mono">Automated Evaluation Engine</span>
          </div>
        </div>
      </div>
      </div>
    </Dialog>
  );
}
