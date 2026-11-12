'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/common/navbar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  CheckCircle2,
  XCircle,
  Award,
  ArrowRight,
  Clock,
  Layers,
  ShieldCheck,
  Check,
  Wifi,
  Eye,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatTimeRemaining } from '@/lib/utils';
import { ExaminationResult, RoundQualification, Student, ExaminationRound } from '@/types';

function StudentResultContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.examSlug as string;
  const attemptId = searchParams.get('attemptId');

  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<ExaminationResult | null>(null);
  const [qualification, setQualification] = React.useState<RoundQualification | null>(null);
  const [exam, setExam] = React.useState<any>(null);
  const [currentRound, setCurrentRound] = React.useState<ExaminationRound | null>(null);
  const [student, setStudent] = React.useState<Student | null>(null);

  // 2-minute countdown timer before automatic transition
  const [countdownSeconds, setCountdownSeconds] = React.useState<number>(120);
  const [readinessModalOpen, setReadinessModalOpen] = React.useState(false);
  const [readinessAgreed, setReadinessAgreed] = React.useState(false);

  React.useEffect(() => {
    async function loadResult() {
      try {
        setLoading(true);
        const examRes = await fetch('/api/examinations');
        const examJson = await examRes.json();
        const found = examJson.data?.find((e: any) => e.slug === slug);
        if (found) setExam(found);

        const storedStudent = found ? localStorage.getItem(`exam_student_${found.id}`) : null;
        if (storedStudent) setStudent(JSON.parse(storedStudent));

        if (!attemptId) {
          toast.error('No attempt ID provided.');
          setLoading(false);
          return;
        }

        // Fetch live results for the exam
        if (found) {
          const resultsRes = await fetch(`/api/examinations/${found.id}/results`);
          const resultsJson = await resultsRes.json();
          if (resultsJson.success && resultsJson.data?.rows) {
            const myRow = resultsJson.data.rows.find((r: any) => r.attemptId === attemptId);
            if (myRow) {
              setResult({
                id: `res-${attemptId}`,
                attempt_id: attemptId,
                registration_id: '',
                round_id: '',
                correct_count: Math.round(myRow.score / (myRow.totalMarks > 0 ? myRow.totalMarks / 5 : 1)),
                wrong_count: 0,
                unanswered_count: 0,
                score: myRow.score || 0,
                total_marks: myRow.totalMarks,
                qualifying_marks: myRow.qualifyingMarks || 4,
                is_qualified: Boolean(myRow.isQualified),
                evaluated_at: myRow.submittedAt || new Date().toISOString(),
              });

              setQualification({
                id: `qual-${attemptId}`,
                registration_id: '',
                round_id: '',
                qualified: Boolean(myRow.isQualified),
                next_round_number: myRow.isQualified ? myRow.roundNumber + 1 : null,
                qualified_at: new Date().toISOString(),
              });

              const r = (found.rounds || []).find((rnd: any) => rnd.round_number === myRow.roundNumber);
              if (r) {
                setCurrentRound(r);
                if (r.next_round_delay_seconds) {
                  setCountdownSeconds(r.next_round_delay_seconds);
                }
              }
            }
          }
        }
      } catch {
        toast.error('Failed to load examination results.');
      } finally {
        setLoading(false);
      }
    }

    loadResult();
  }, [slug, attemptId]);

  // Live countdown timer for qualified students
  React.useEffect(() => {
    if (!result?.is_qualified || !qualification?.next_round_number) return;

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [result, qualification]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/50">
        <Navbar />
        <div className="flex-1 max-w-3xl w-full mx-auto p-8 animate-pulse space-y-6">
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const isQualified = result?.is_qualified ?? false;
  const nextRoundNumber = qualification?.next_round_number;
  const nextRound = exam?.rounds?.find((r: any) => r.round_number === nextRoundNumber);

  const handleStartNextRound = () => {
    if (!nextRoundNumber) return;
    router.push(`/exam/${slug}/round/${nextRoundNumber}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Outcome Header Banner */}
        <div
          className={`rounded-2xl border p-8 text-center transition-all shadow-xs ${
            isQualified ? 'border-emerald-200 bg-white' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex justify-center mb-4">
            {isQualified ? (
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-7 h-7" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <XCircle className="w-7 h-7" />
              </div>
            )}
          </div>

          <Badge variant={isQualified ? 'success' : 'danger'} size="md" className="mb-3">
            {isQualified ? 'Qualification Verified' : 'Round Completed — Did Not Qualify'}
          </Badge>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {isQualified ? 'Congratulations!' : 'Round Assessment Completed'}
          </h1>

          <p className="mt-3 text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
            {isQualified
              ? currentRound?.success_message ||
                `You have successfully passed ${currentRound?.name || 'this round'} with a qualifying score.`
              : currentRound?.failure_message ||
                `Thank you for applying. You have not achieved the minimum qualification marks. Best of luck for future assessments.`}
          </p>

          {/* Qualified Countdown Notice */}
          {isQualified && nextRound && (
            <div className="mt-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs text-emerald-950 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-md mx-auto">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Next round: <strong>{nextRound.name}</strong>
                </span>
              </div>
              <div className="font-mono font-bold text-emerald-800 bg-white px-2.5 py-1 rounded border border-emerald-200">
                Starts in {formatTimeRemaining(countdownSeconds)}
              </div>
            </div>
          )}

          {/* Student Identifiers */}
          {student && (
            <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-center gap-6 text-xs text-gray-500">
              <div>
                <span className="text-gray-400 block font-semibold uppercase tracking-wider text-[10px]">
                  Candidate Name
                </span>
                <span className="font-semibold text-gray-900">{student.full_name}</span>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div>
                <span className="text-gray-400 block font-semibold uppercase tracking-wider text-[10px]">
                  Login Identifier
                </span>
                <span className="font-semibold text-gray-900 font-mono">
                  {student.login_id || student.roll_number}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Score Breakdown Card */}
        {result && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-gray-700" />
                <span>Performance Evaluation Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50 text-center">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">
                    Marks Awarded
                  </span>
                  <span className="text-xl font-bold text-gray-900 mt-1 block">
                    {result.score} / {result.total_marks}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">
                    Pass Mark Required
                  </span>
                  <span className="text-xl font-bold text-emerald-700 mt-1 block">
                    {result.qualifying_marks}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">
                    Percentage
                  </span>
                  <span className="text-xl font-bold text-gray-900 mt-1 block">
                    {result.total_marks > 0 ? Math.round((result.score / result.total_marks) * 100) : 0}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">
                    Final Result
                  </span>
                  <span
                    className={`text-xl font-bold mt-1 block ${
                      isQualified ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {isQualified ? 'Passed' : 'Failed'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Scoring was authoritatively executed on the server and committed to transactional storage.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Actions Bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/exam" className="w-full sm:w-auto">
            <Button variant="outline" size="md" className="w-full sm:w-auto text-xs font-semibold uppercase tracking-wider">
              Return to Examinations
            </Button>
          </Link>

          {isQualified && nextRoundNumber && nextRound ? (
            <Button
              size="md"
              onClick={() => setReadinessModalOpen(true)}
              className="w-full sm:w-auto text-xs font-semibold uppercase tracking-wider gap-2 h-11 px-6"
            >
              <span>Start Round {nextRoundNumber} Immediately</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : null}
        </div>

        {/* Pre-Round Privacy & Environment Readiness Checklist Dialog */}
        <Dialog
          isOpen={readinessModalOpen}
          onClose={() => setReadinessModalOpen(false)}
          title={`Pre-Flight Readiness: Round ${nextRoundNumber}`}
          description="Confirm your environment and integrity readiness before beginning this evaluation."
        >
          <div className="space-y-4 pt-2">
            <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50 space-y-2 text-xs text-gray-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Single candidate presence confirmed. No unauthorized persons in room.</span>
              </div>
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Stable internet connection active. Local answer autosaving enabled.</span>
              </div>
              {nextRound?.allow_tab_switch ? (
                <div className="p-3 rounded-lg border border-sky-300 bg-sky-50 text-xs text-sky-950 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">AI & External Research Permitted:</span>
                    <span>You are permitted to switch tabs, browse reference documentation, and use AI tools during Round {nextRoundNumber}.</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Fullscreen and focus monitoring strictly enforced.</span>
                </div>
              )}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-700 pt-2 leading-relaxed">
              <input
                type="checkbox"
                checked={readinessAgreed}
                onChange={(e) => setReadinessAgreed(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
              />
              <span>
                I confirm that my testing environment is prepared, and I agree to proceed directly into{' '}
                <strong>{nextRound?.name}</strong>.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReadinessModalOpen(false)}
                className="text-xs uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!readinessAgreed}
                onClick={handleStartNextRound}
                className="text-xs uppercase tracking-wider font-semibold gap-1.5"
              >
                <span>Enter Round {nextRoundNumber}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </Dialog>
      </main>
    </div>
  );
}

export default function StudentResultPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">
          Loading result data...
        </div>
      }
    >
      <StudentResultContent />
    </React.Suspense>
  );
}
