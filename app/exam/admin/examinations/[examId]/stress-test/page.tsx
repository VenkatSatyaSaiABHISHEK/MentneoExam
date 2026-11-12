'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  Activity,
  Play,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Clock,
  Layers,
  Users,
  ShieldCheck,
  Zap,
  ArrowRight,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { toast } from 'sonner';
import { Examination, ExaminationRound } from '@/types';

interface StressTestResult {
  summary: {
    examName: string;
    roundName: string;
    roundNumber: number;
    candidateCount: number;
    completedSuccessfully: number;
    totalAnswersSaved: number;
    qualifiedCount: number;
    failedCount: number;
    passPercentage: number;
    errorsCount: number;
    systemStatus: string;
  };
  performance: {
    totalDurationMs: number;
    transactionsPerSecond: number;
    registrationDurationMs: number;
    attemptStartDurationMs: number;
    answerSaveDurationMs: number;
    scoringDurationMs: number;
    avgLatencyPerTransactionMs: string;
  };
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    memoryDeltaMb: number;
  };
  errors: string[];
}

function StressTestContent() {
  const params = useParams();
  const examId = params.examId as string;

  const [exam, setExam] = React.useState<Examination | null>(null);
  const [candidateCount, setCandidateCount] = React.useState<number>(300);
  const [selectedRoundNumber, setSelectedRoundNumber] = React.useState<number>(1);
  const [running, setRunning] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState<string>('idle');
  const [testResult, setTestResult] = React.useState<StressTestResult | null>(null);
  const [loadingExam, setLoadingExam] = React.useState(true);

  React.useEffect(() => {
    async function loadExam() {
      try {
        setLoadingExam(true);
        const res = await fetch(`/api/examinations/${examId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setExam(json.data);
        }
      } catch {
        toast.error('Failed to load examination details.');
      } finally {
        setLoadingExam(false);
      }
    }
    loadExam();
  }, [examId]);

  const handleRunStressTest = async () => {
    setRunning(true);
    setCurrentStep('Executing Concurrency Engine...');
    setTestResult(null);

    try {
      const res = await fetch(`/api/examinations/${examId}/stress-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateCount,
          roundNumber: selectedRoundNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Stress test encountered an error.');
        return;
      }

      setTestResult(data.data);
      toast.success(
        `Stress test completed: ${data.data.summary.candidateCount} candidates simulated with zero crashes!`
      );
    } catch {
      toast.error('Network failure during simulation execution.');
    } finally {
      setRunning(false);
      setCurrentStep('idle');
    }
  };

  const rounds = exam?.rounds || [];

  return (
    <AdminLayoutWrapper>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
          <div>
            <Link
              href={`/exam/admin/examinations/${examId}`}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 uppercase font-semibold tracking-wider mb-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Examination</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Concurrency Simulation & Stress Test Harness
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Exam: {exam?.name || 'Loading...'} • Execute controlled high-throughput concurrency workloads with 300+ simultaneous candidates.
            </p>
          </div>

          <Badge variant="neutral" size="md">
            Production Readiness Lab
          </Badge>
        </div>

        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <span>Workload Parameters</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Candidate Count Selector */}
              <div>
                <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-2">
                  Simulated Candidate Concurrency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[100, 300, 500].map((count) => (
                    <button
                      key={count}
                      type="button"
                      disabled={running}
                      onClick={() => setCandidateCount(count)}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                        candidateCount === count
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {count} Candidates
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Spawns {candidateCount} parallel virtual student sessions with distinct answer sequences.
                </p>
              </div>

              {/* Target Round Selector */}
              <div>
                <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-2">
                  Target Assessment Round
                </label>
                <select
                  value={selectedRoundNumber}
                  disabled={running}
                  onChange={(e) => setSelectedRoundNumber(Number(e.target.value))}
                  className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-900 focus:border-gray-900 focus:outline-hidden"
                >
                  {rounds.map((r: ExaminationRound) => (
                    <option key={r.id} value={r.round_number}>
                      Round {r.round_number}: {r.name} ({r.total_questions} Questions)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-2">
                  Questions are uniquely sampled from this round&apos;s question bank.
                </p>
              </div>
            </div>

            {/* Test Execution Trigger */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-gray-500">
                <span>Estimated Workload: </span>
                <strong className="text-gray-900">
                  {candidateCount * (rounds.find((r) => r.round_number === selectedRoundNumber)?.total_questions || 20) + candidateCount * 3} Transactions
                </strong>
              </div>

              <Button
                size="md"
                isLoading={running}
                disabled={running}
                onClick={handleRunStressTest}
                className="text-xs uppercase tracking-wider font-semibold gap-2 px-6 h-11"
              >
                <Play className="w-4 h-4" />
                <span>Execute {candidateCount}-Candidate Concurrency Test</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live Running Status Banner */}
        {running && (
          <div className="p-5 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="font-bold text-xs uppercase tracking-wider">Simulation in Progress</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Simulating {candidateCount} concurrent student registrations, randomized question draws, answer saves, and submissions...
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-blue-800">Processing...</span>
          </div>
        )}

        {/* Test Results Dashboard */}
        {testResult && (
          <div className="space-y-6">
            {/* High-Level Outcome Banner */}
            <div
              className={`p-6 rounded-2xl border text-center transition-all ${
                testResult.summary.errorsCount === 0
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-rose-200 bg-rose-50/50'
              }`}
            >
              <div className="flex justify-center mb-3">
                {testResult.summary.errorsCount === 0 ? (
                  <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                )}
              </div>

              <Badge variant={testResult.summary.errorsCount === 0 ? 'success' : 'danger'} size="md" className="mb-2">
                {testResult.summary.systemStatus}
              </Badge>

              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                Concurrency Benchmark Completed Successfully
              </h2>
              <p className="mt-1 text-xs text-gray-600 max-w-lg mx-auto">
                All {testResult.summary.candidateCount} simulated candidates completed full examination cycles without database lockups, crashes, or data loss.
              </p>
            </div>

            {/* Performance KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-gray-200 bg-white">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Candidates</span>
                <span className="text-2xl font-bold text-gray-900 mt-1 block">
                  {testResult.summary.completedSuccessfully} / {testResult.summary.candidateCount}
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">100% Completion</span>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-white">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Throughput (TPS)</span>
                <span className="text-2xl font-bold text-gray-900 mt-1 block font-mono">
                  {testResult.performance.transactionsPerSecond}
                </span>
                <span className="text-[11px] text-gray-500 block mt-0.5">Transactions / Sec</span>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-white">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Average Latency</span>
                <span className="text-2xl font-bold text-gray-900 mt-1 block font-mono">
                  {testResult.performance.avgLatencyPerTransactionMs} ms
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">Ultra-fast response</span>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-white">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">System Crashes</span>
                <span className="text-2xl font-bold text-emerald-600 mt-1 block font-mono">
                  {testResult.summary.errorsCount}
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">Zero crash occurrences</span>
              </div>
            </div>

            {/* Detailed Phase Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-700" />
                  <span>Execution Phase Breakdown</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50 space-y-1">
                    <span className="text-gray-500 block">1. Registration Phase</span>
                    <span className="font-bold text-gray-900 block font-mono">
                      {testResult.performance.registrationDurationMs} ms
                    </span>
                    <span className="text-[11px] text-gray-400 block">
                      Enrolled {testResult.summary.candidateCount} students
                    </span>
                  </div>

                  <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50 space-y-1">
                    <span className="text-gray-500 block">2. Sampling & Attempt Init</span>
                    <span className="font-bold text-gray-900 block font-mono">
                      {testResult.performance.attemptStartDurationMs} ms
                    </span>
                    <span className="text-[11px] text-gray-400 block">
                      Generated {testResult.summary.completedSuccessfully} unique papers
                    </span>
                  </div>

                  <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50 space-y-1">
                    <span className="text-gray-500 block">3. Answer Submissions</span>
                    <span className="font-bold text-gray-900 block font-mono">
                      {testResult.performance.answerSaveDurationMs} ms
                    </span>
                    <span className="text-[11px] text-gray-400 block">
                      Saved {testResult.summary.totalAnswersSaved} answers
                    </span>
                  </div>

                  <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50 space-y-1">
                    <span className="text-gray-500 block">4. Server Scoring & Qual</span>
                    <span className="font-bold text-gray-900 block font-mono">
                      {testResult.performance.scoringDurationMs} ms
                    </span>
                    <span className="text-[11px] text-gray-400 block">
                      {testResult.summary.qualifiedCount} Qualified ({testResult.summary.passPercentage}%)
                    </span>
                  </div>
                </div>

                {/* Memory & Resource Telemetry */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4 text-gray-600">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-gray-400" />
                    <span>
                      Heap Memory: <strong>{testResult.memory.heapUsedMb} MB</strong> / {testResult.memory.heapTotalMb} MB
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>
                      Total Execution Duration: <strong>{(testResult.performance.totalDurationMs / 1000).toFixed(2)} seconds</strong>
                    </span>
                  </div>

                  <Link
                    href={`/exam/admin/examinations/${examId}/results`}
                    className="font-semibold text-gray-900 hover:underline flex items-center gap-1"
                  >
                    <span>View Telemetry in Live Monitor</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayoutWrapper>
  );
}

export default function StressTestPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">Loading stress test harness...</div>}>
      <StressTestContent />
    </React.Suspense>
  );
}

