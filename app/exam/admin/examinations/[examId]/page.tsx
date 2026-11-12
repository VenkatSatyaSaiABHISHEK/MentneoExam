'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Layers,
  Users,
  Activity,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Award,
  ChevronRight,
  Shield,
  FileQuestion,
  Play,
  Square,
  Archive,
  ArrowRight,
  Zap,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { Examination, ExaminationRound, ExamStatus } from '@/types';
import { formatDuration } from '@/lib/utils';

function ExaminationDetailContent() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [exam, setExam] = React.useState<Examination | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  const fetchExam = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/examinations/${examId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setExam(json.data);
      } else {
        toast.error('Examination not found');
      }
    } catch {
      toast.error('Failed to load examination');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchExam();
  }, [examId]);

  const handleStatusChange = async (newStatus: ExamStatus) => {
    try {
      const res = await fetch(`/api/examinations/${examId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Examination status changed to ${newStatus}`);
        fetchExam();
      }
    } catch {
      toast.error('Failed to change status');
    }
  };

  const copyShareLink = () => {
    if (!exam) return;
    const url = `${window.location.origin}/exam/${exam.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Candidate examination link copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <AdminLayoutWrapper>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded-md w-1/3" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </AdminLayoutWrapper>
    );
  }

  if (!exam) {
    return (
      <AdminLayoutWrapper>
        <div className="p-12 text-center text-gray-500">
          <p>Examination not found.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/exam/admin/examinations')}>
            Back to Examinations
          </Button>
        </div>
      </AdminLayoutWrapper>
    );
  }

  const rounds = (exam.rounds || []).sort((a: ExaminationRound, b: ExaminationRound) => a.round_number - b.round_number);
  const totalDuration = rounds.reduce((acc: number, r: ExaminationRound) => acc + r.duration_minutes, 0);

  const statusVariant = {
    live: 'success',
    scheduled: 'warning',
    published: 'info',
    draft: 'neutral',
    completed: 'neutral',
    archived: 'neutral',
  }[exam.status] as 'success' | 'warning' | 'info' | 'neutral';

  return (
    <AdminLayoutWrapper>
      <div className="space-y-8">
        {/* Header with Title & Status Controls */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={statusVariant}>{exam.status}</Badge>
              <span className="text-xs font-mono text-gray-400">/{exam.slug}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{exam.name}</h1>
            <p className="mt-1 text-xs text-gray-500 max-w-2xl">
              {exam.description && exam.description.toLowerCase() !== exam.name.toLowerCase()
                ? exam.description
                : 'Enterprise multi-round qualification examination with automated proctoring & scoring.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={exam.status}
              onChange={(e) => handleStatusChange(e.target.value as ExamStatus)}
              className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer focus:outline-hidden focus:border-gray-900"
            >
              <option value="draft">Draft</option>
              <option value="live">Live</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </select>

            <button
              onClick={copyShareLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer uppercase tracking-wider"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
              <span>Copy Link</span>
            </button>

            <Link href={`/exam/${exam.slug}`} target="_blank">
              <Button variant="outline" size="sm" className="text-xs uppercase tracking-wider gap-1.5 font-semibold">
                <span>Candidate Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Navigation Tabs for Exam */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href={`/exam/admin/examinations/${exam.id}/rounds`} className="block">
            <Card className="hover:border-gray-400 transition-colors p-5 h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-900">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Dynamic Rounds</h3>
                    <p className="text-xs text-gray-500">{rounds.length} Rounds Configured</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </Card>
          </Link>

          <Link href={`/exam/admin/examinations/${exam.id}/students`} className="block">
            <Card className="hover:border-gray-400 transition-colors p-5 h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-900">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Registered Students</h3>
                    <p className="text-xs text-gray-500">{exam._count?.registrations ?? 'View List'}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </Card>
          </Link>

          <Link href={`/exam/admin/examinations/${exam.id}/results`} className="block">
            <Card className="hover:border-gray-400 transition-colors p-5 h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Live Monitor & Results</h3>
                    <p className="text-xs text-emerald-700 font-medium">Real-time Telemetry</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </Card>
          </Link>

          <Link href={`/exam/admin/examinations/${exam.id}/stress-test`} className="block">
            <Card className="hover:border-gray-400 transition-colors p-5 h-full border-amber-200/80 bg-amber-50/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Concurrency Lab</h3>
                    <p className="text-xs text-amber-800 font-medium">Test 300+ Students</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </Card>
          </Link>
        </div>

        {/* Overview Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Examination Metrics & Policy</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
            <div>
              <span className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] block">
                Total Duration
              </span>
              <span className="text-sm font-bold text-gray-900 mt-1 block">{formatDuration(totalDuration)}</span>
            </div>

            <div>
              <span className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] block">
                Concurrency Cap
              </span>
              <span className="text-sm font-bold text-gray-900 mt-1 block">{exam.student_limit || 'Unlimited (200+)'}</span>
            </div>

            <div>
              <span className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] block">
                Proctoring Threshold
              </span>
              <span className="text-sm font-bold text-gray-900 mt-1 block">
                {exam.max_cheating_warnings} Warnings Max
              </span>
            </div>

            <div>
              <span className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] block">
                Score Visibility
              </span>
              <span className="text-sm font-bold text-gray-900 mt-1 block">
                {exam.show_marks_to_students ? 'Student Visible' : 'Admin Only'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Rounds Detail Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
                Configured Multi-Round Stages
              </h2>
              <p className="text-xs text-gray-500">Each round operates its own dedicated question bank, timing, and qualifying criteria.</p>
            </div>
            <Link href={`/exam/admin/examinations/${exam.id}/rounds`}>
              <Button variant="outline" size="sm" className="text-xs uppercase tracking-wider font-semibold gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                <span>Configure Rounds</span>
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rounds.map((r: ExaminationRound) => (
              <Card key={`exam-${exam.id}-round-${r.id || r.round_number}`} className="p-5 flex flex-col justify-between hover:border-gray-400 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-7 h-7 rounded-md bg-gray-900 text-white flex items-center justify-center text-xs font-bold font-mono">
                      R{r.round_number}
                    </span>
                    <Badge variant={r.status === 'active' ? 'success' : 'neutral'} size="sm">
                      {r.status}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">{r.name}</h3>

                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration:</span>
                      <span className="font-semibold">{r.duration_minutes} mins</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Questions:</span>
                      <span className="font-semibold">{r.total_questions} MCQs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Qualifying Score:</span>
                      <span className="font-semibold text-emerald-700">
                        {r.qualifying_marks} / {r.total_marks}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Auto-Qualify:</span>
                      <span className="font-semibold">{r.auto_qualify ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">AI / Tab Switch:</span>
                      <span className="font-semibold">{r.allow_tab_switch ? 'Permitted' : 'Strict'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100 flex flex-col gap-2">
                  <Link
                    href={`/exam/admin/examinations/${exam.id}/rounds/${r.id}/questions`}
                    className="w-full text-center text-xs font-semibold py-2 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-900 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <FileQuestion className="w-3.5 h-3.5 text-gray-500" />
                    <span>Manage Round {r.round_number} Questions</span>
                    <ArrowRight className="w-3 h-3 text-gray-400 ml-auto" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AdminLayoutWrapper>
  );
}

export default function ExaminationDetailPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">Loading examination...</div>}>
      <ExaminationDetailContent />
    </React.Suspense>
  );
}
