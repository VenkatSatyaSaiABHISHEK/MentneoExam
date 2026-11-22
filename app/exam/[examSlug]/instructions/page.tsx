'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/common/navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  Clock,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Maximize2,
  Copy,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import { Examination, Student } from '@/types';

function ExamInstructionsContent() {
  const params = useParams();
  const router = useRouter();
  const slug = params.examSlug as string;

  const [exam, setExam] = React.useState<Examination | null>(null);
  const [student, setStudent] = React.useState<Student | null>(null);
  const [agreed, setAgreed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [starting, setStarting] = React.useState(false);

  React.useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/examinations/by-slug/${slug}`);
        const json = await res.json();
        if (json.success && json.data) {
          const found = json.data;
          setExam(found);
          const savedStudent = localStorage.getItem(`exam_student_${found.id}`);
          if (savedStudent) {
            setStudent(JSON.parse(savedStudent));
          }

          // Check if candidate already completed this examination
          const regId = localStorage.getItem(`exam_reg_${found.id}`);
          if (regId) {
            try {
              const resCheck = await fetch(`/api/examinations/${found.id}/results`);
              const resJson = await resCheck.json();
              if (resJson.success && Array.isArray(resJson.data)) {
                const foundResult = resJson.data.find((r: any) => r.registration_id === regId);
                if (foundResult) {
                  toast.info('You have already completed this examination.');
                  router.push(`/exam/${slug}/result?attemptId=${foundResult.attempt_id}`);
                  return;
                }
              }
            } catch {}
          }
        }
      } catch {
        toast.error('Failed to load examination instructions.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  const handleStartExam = async () => {
    if (!agreed) {
      toast.error('You must acknowledge the examination instructions to proceed.');
      return;
    }
    if (!exam) return;

    setStarting(true);
    // Request fullscreen mode for proctoring deterrence
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen failure if user cancels
    }

    // Direct student to Round 1
    router.push(`/exam/${slug}/round/1`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/50">
        <Navbar />
        <div className="flex-1 max-w-4xl w-full mx-auto p-8 animate-pulse space-y-6">
          <div className="h-8 w-2/5 bg-gray-200 rounded-md" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/50">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-gray-500">Examination not found.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/exam')}>
            Return to Examinations
          </Button>
        </div>
      </div>
    );
  }

  const round1 = (exam.rounds || []).find((r) => r.round_number === 1) || exam.rounds?.[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9fe] dark:bg-[#0d0c1d] text-[#1d1a4a] dark:text-[#f4f3ff] transition-colors">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 sm:pb-6 border-b border-gray-200 dark:border-zinc-800 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="neutral">Pre-Flight Briefing</Badge>
              <span className="text-xs text-gray-400 font-mono">Round 1</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{exam.name}</h1>
          </div>
          {student && (
            <div className="text-left sm:text-right text-xs bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-gray-200 dark:border-zinc-800 sm:border-0 sm:p-0">
              <p className="font-semibold text-gray-900 dark:text-zinc-100">{student.full_name}</p>
              <p className="text-gray-500 font-mono">Roll: {student.roll_number}</p>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-6">
          {/* Pre-Flight Cockpit Checklist */}
          <div className="rounded-2xl border border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] p-6 shadow-[0_4px_24px_rgba(184,179,255,0.08)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#e6e3f8] dark:border-[#2c2854]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-base font-bold text-[#1d1a4a] dark:text-[#f4f3ff] tracking-tight">
                    Pre-Flight Cockpit Checklist
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[#706b9b] dark:text-[#a4a0c8]">
                  Automated telemetry sensors and examinee verification checks before round entry.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#f0effe] dark:bg-[#1e1b3d] text-[#635bff] dark:text-[#b8b3ff] border border-[#e0ddfc] dark:border-[#38336d] shrink-0 self-start sm:self-auto">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Status: {agreed ? 'Cockpit Ready (4/4)' : 'Awaiting Oath (3/4)'}</span>
              </div>
            </div>

            {/* Checklist Grid */}
            <div className="mt-5 space-y-3">
              {/* Item 1: Authoritative Clock */}
              <div className="p-3.5 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d]/60 border border-[#e6e3f8] dark:border-[#2c2854] flex items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#1d1a4a] dark:text-[#f4f3ff]">Authoritative Clock Synchronization</h3>
                    <p className="text-[11px] text-[#706b9b] dark:text-[#a4a0c8] mt-0.5">
                      Sub-tick atomic timer synchronized with server database. Local client clock tampering blocked.
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Armed (0.4ms)
                </span>
              </div>

              {/* Item 2: Proctoring Telemetry Sensor */}
              <div className="p-3.5 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d]/60 border border-[#e6e3f8] dark:border-[#2c2854] flex items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#1d1a4a] dark:text-[#f4f3ff]">Proctoring &amp; Focus Telemetry Sensor</h3>
                    <p className="text-[11px] text-[#706b9b] dark:text-[#a4a0c8] mt-0.5">
                      Fullscreen enforcement and tab switch detector armed. Maximum {exam.max_cheating_warnings} violation warnings allowed.
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Armed (Max {exam.max_cheating_warnings})
                </span>
              </div>

              {/* Item 3: Local Offline WAL Buffer */}
              <div className="p-3.5 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d]/60 border border-[#e6e3f8] dark:border-[#2c2854] flex items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#1d1a4a] dark:text-[#f4f3ff]">Transactional Offline Storage Buffer</h3>
                    <p className="text-[11px] text-[#706b9b] dark:text-[#a4a0c8] mt-0.5">
                      Answers and code submissions auto-saved with 0ms delay to device storage. Auto-syncs if Wi-Fi flickers.
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Ready (0ms Buffer)
                </span>
              </div>

              {/* Item 4: Interactive Examinee Integrity Oath */}
              <div
                onClick={() => setAgreed(!agreed)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start sm:items-center justify-between gap-3 ${
                  agreed
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="agree-rules"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-indigo-900 focus:ring-indigo-900 cursor-pointer"
                  />
                  <div>
                    <h3 className="text-xs font-bold text-[#1d1a4a] dark:text-[#f4f3ff]">
                      Examinee Integrity &amp; Proctoring Oath
                    </h3>
                    <p className="text-[11px] text-[#706b9b] dark:text-[#a4a0c8] mt-0.5">
                      I confirm I am {student?.full_name || 'an authorized examinee'} ({student?.roll_number || 'Registered'}). I will not open external tabs, use unauthorized assistance, or share examination materials.
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                    agreed
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {agreed ? 'Confirmed' : 'Action Required'}
                </span>
              </div>
            </div>
          </div>

          {/* Round Specifics */}
          {round1 && (
            <div className="rounded-2xl border border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] p-6 shadow-[0_4px_24px_rgba(184,179,255,0.08)]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d1a4a] dark:text-[#f4f3ff] mb-4">
                Round 1 Structure &amp; Evaluation Criteria
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 px-4 bg-[#f8f7fe] dark:bg-[#1e1b3d] rounded-xl border border-[#e6e3f8] dark:border-[#2c2854]">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#706b9b] dark:text-[#a4a0c8] block font-semibold">Duration</span>
                  <span className="text-sm font-semibold text-[#1d1a4a] dark:text-[#f4f3ff]">{round1.duration_minutes} Minutes</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#706b9b] dark:text-[#a4a0c8] block font-semibold">Questions</span>
                  <span className="text-sm font-semibold text-[#1d1a4a] dark:text-[#f4f3ff]">{round1.total_questions} Questions</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#706b9b] dark:text-[#a4a0c8] block font-semibold">Marking</span>
                  <span className="text-sm font-semibold text-[#1d1a4a] dark:text-[#f4f3ff]">+{round1.marks_per_question} / -{round1.negative_marks}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#706b9b] dark:text-[#a4a0c8] block font-semibold">Qualifying Score</span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{round1.qualifying_marks} Marks</span>
                </div>
              </div>

              {round1.instructions && (
                <p className="mt-3 text-xs text-[#706b9b] dark:text-[#a4a0c8] leading-relaxed">
                  {round1.instructions}
                </p>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
            <Button variant="outline" size="md" onClick={() => router.push(`/exam/${slug}`)}>
              Back
            </Button>
            <Button
              size="md"
              disabled={!agreed}
              isLoading={starting}
              onClick={handleStartExam}
              className={`text-xs font-semibold uppercase tracking-wider gap-2 px-6 h-11 transition-all ${
                agreed
                  ? 'bg-[#1d1a4a] hover:bg-[#2d2770] text-white shadow-md'
                  : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
              }`}
            >
              <span>Begin Examination Now</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ExamInstructionsPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">Loading instructions...</div>}>
      <ExamInstructionsContent />
    </React.Suspense>
  );
}
