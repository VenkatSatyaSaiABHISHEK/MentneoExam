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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 sm:pb-6 border-b border-gray-200 dark:border-zinc-800 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="neutral">Candidate Instructions</Badge>
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
          {/* Round Specifics & Evaluation Criteria */}
          {round1 && (
            <div className="rounded-2xl border border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] p-6 shadow-[0_4px_24px_rgba(184,179,255,0.08)]">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#1d1a4a] dark:text-[#f4f3ff] mb-4">
                Round 1 Evaluation Structure
              </h2>

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
                  <span className="text-[10px] uppercase tracking-wider text-[#706b9b] dark:text-[#a4a0c8] block font-semibold">Marking Scheme</span>
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

          {/* Clean Rules and Guidelines Card */}
          <div className="rounded-2xl border border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] p-6 shadow-[0_4px_24px_rgba(184,179,255,0.08)]">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#1d1a4a] dark:text-[#f4f3ff] mb-4">
              Important Examination Guidelines
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d]/60 border border-[#e6e3f8] dark:border-[#2c2854]">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs mb-2">
                  1
                </div>
                <h3 className="text-xs font-bold text-[#1d1a4a] dark:text-[#f4f3ff]">Full-Screen Mode</h3>
                <p className="text-[11px] text-[#706b9b] dark:text-[#a4a0c8] mt-1 leading-relaxed">
                  The test runs in full screen. Do not switch tabs or minimize the browser window. Tab switches trigger warnings (maximum {exam.max_cheating_warnings}).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d]/60 border border-[#e6e3f8] dark:border-[#2c2854]">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs mb-2">
                  2
                </div>
                <h3 className="text-xs font-bold text-[#1d1a4a] dark:text-[#f4f3ff]">Auto-Save Protection</h3>
                <p className="text-[11px] text-[#706b9b] dark:text-[#a4a0c8] mt-1 leading-relaxed">
                  Your selected answers are saved automatically. If your connection drops, your responses are preserved safely and will sync.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d]/60 border border-[#e6e3f8] dark:border-[#2c2854]">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs mb-2">
                  3
                </div>
                <h3 className="text-xs font-bold text-[#1d1a4a] dark:text-[#f4f3ff]">Countdown Timer</h3>
                <p className="text-[11px] text-[#706b9b] dark:text-[#a4a0c8] mt-1 leading-relaxed">
                  The timer begins immediately once you click &quot;Begin Examination Now&quot;. The exam submits automatically when time expires.
                </p>
              </div>
            </div>
          </div>

          {/* Clear Interactive Checkbox Callout with Visual Arrow Pointer */}
          <div
            onClick={() => setAgreed(!agreed)}
            className={`rounded-2xl border-2 p-5 sm:p-6 transition-all cursor-pointer ${
              agreed
                ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-md ring-4 ring-emerald-100 dark:ring-emerald-950/40'
                : 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 shadow-lg ring-4 ring-indigo-200/60 dark:ring-indigo-900/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  id="agree-rules"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-6 h-6 mt-0.5 rounded-md border-2 border-indigo-600 text-indigo-900 focus:ring-indigo-900 cursor-pointer shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    {!agreed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white animate-pulse">
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Step 1: Tick this box to enable start button</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Step 1 Completed: Ready to start</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-[#1d1a4a] dark:text-[#f4f3ff] mt-2">
                    I confirm that I am {student?.full_name || 'an authorized examinee'} ({student?.roll_number || 'Registered Candidate'}).
                  </h3>
                  <p className="text-xs text-[#706b9b] dark:text-[#a4a0c8] mt-1">
                    I have read and understood all the examination rules and agree to take this assessment fairly.
                  </p>
                </div>
              </div>

              {/* Status pill on the right */}
              <div className="shrink-0 self-end sm:self-center">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${
                    agreed
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                  }`}
                >
                  {agreed ? 'Checked' : 'Tick Box Required'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <Button variant="outline" size="md" onClick={() => router.push(`/exam/${slug}`)}>
              Back to Exam Details
            </Button>
            <Button
              size="lg"
              disabled={!agreed}
              isLoading={starting}
              onClick={handleStartExam}
              className={`text-xs font-bold uppercase tracking-wider gap-2 px-8 h-12 rounded-xl transition-all ${
                agreed
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 cursor-pointer scale-100'
                  : 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              <span>{agreed ? 'Begin Examination Now' : 'Please Tick Checkbox Above to Start'}</span>
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
