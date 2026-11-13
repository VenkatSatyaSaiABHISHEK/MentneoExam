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
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between pb-6 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="neutral">Pre-Flight Briefing</Badge>
              <span className="text-xs text-gray-400 font-mono">Round 1</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{exam.name}</h1>
          </div>
          {student && (
            <div className="text-right text-xs">
              <p className="font-semibold text-gray-900">{student.full_name}</p>
              <p className="text-gray-500 font-mono">Roll: {student.roll_number}</p>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-6">
          {/* Hardware & Environment Readiness */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="w-4 h-4 text-gray-700" />
                <span>Environment Readiness & System Integrity</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-lg border border-gray-200 bg-white space-y-1">
                <span className="text-gray-500 font-medium block">Authoritative Clock</span>
                <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Synchronized with Server
                </span>
              </div>
              <div className="p-4 rounded-lg border border-gray-200 bg-white space-y-1">
                <span className="text-gray-500 font-medium block">Proctoring Telemetry</span>
                <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Active Focus Sensor
                </span>
              </div>
              <div className="p-4 rounded-lg border border-gray-200 bg-white space-y-1">
                <span className="text-gray-500 font-medium block">Network Resilience</span>
                <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Auto-Save on Answer
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Anti-Cheating Protocol */}
          <Card className="border-amber-200 bg-amber-50/20">
            <CardHeader>
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <CardTitle className="text-base text-amber-900">Proctoring Rules & Cheating Deterrence</CardTitle>
              </div>
              <CardDescription className="text-amber-800/80">
                The examination environment is strictly monitored. You are allocated a maximum of{' '}
                {exam.max_cheating_warnings} violation warnings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-gray-700">
              <div className="flex items-start gap-2.5">
                <Maximize2 className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Fullscreen Enforcement:</strong> Exiting fullscreen mode will immediately trigger an infraction warning.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Eye className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Tab & Window Focus:</strong> Switching browser tabs or losing window focus is detected in real time and recorded on your session.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Copy className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Clipboard & Shortcuts:</strong> Copying question text, pasting, inspect tools, and unauthorized hotkeys are blocked and logged.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="text-rose-700 font-medium">
                  <strong>Automatic Termination:</strong> Reaching {exam.max_cheating_warnings} warnings will permanently lock your attempt and submit the current state.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Round Specifics */}
          {round1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Round 1 Structure & Scoring</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-gray-600">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 px-4 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">Duration</span>
                    <span className="text-sm font-semibold text-gray-900">{round1.duration_minutes} Minutes</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">Questions</span>
                    <span className="text-sm font-semibold text-gray-900">{round1.total_questions} Questions</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">Marking</span>
                    <span className="text-sm font-semibold text-gray-900">+{round1.marks_per_question} / -{round1.negative_marks}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">Qualifying Score</span>
                    <span className="text-sm font-semibold text-emerald-700">{round1.qualifying_marks} Marks</span>
                  </div>
                </div>

                <p className="mt-2 text-gray-500">
                  {round1.instructions || 'Answer all questions within the allocated time. Answers are incrementally saved.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Agreement Checkbox */}
          <div className="p-4 rounded-xl border border-gray-200 bg-white flex items-start gap-3">
            <input
              type="checkbox"
              id="agree-rules"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
            />
            <label htmlFor="agree-rules" className="text-xs text-gray-700 cursor-pointer leading-relaxed">
              I have read and understood all examination regulations. I confirm that I will not attempt to open external
              windows, switch tabs, or use unauthorized assistance. I consent to real-time proctoring telemetry.
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button variant="outline" size="md" onClick={() => router.push(`/exam/${slug}`)}>
              Back
            </Button>
            <Button
              size="md"
              disabled={!agreed}
              isLoading={starting}
              onClick={handleStartExam}
              className="text-xs font-semibold uppercase tracking-wider gap-2 px-6"
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
