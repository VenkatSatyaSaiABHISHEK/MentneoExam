import * as React from 'react';
import Link from 'next/link';
import { db } from '@/lib/db/store';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Clock,
  Layers,
  ArrowRight,
  PlusCircle,
  ExternalLink,
  Activity,
  CheckCircle2,
  FileQuestion,
  Database,
} from 'lucide-react';
import { formatDuration } from '@/lib/utils';

async function AdminDashboardContent() {
  const [examinations, stats] = await Promise.all([
    db.getExaminations(),
    db.getAdminStats(),
  ]);

  return (
    <div className="space-y-8 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">System Overview</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Real-time telemetry of concurrent examinations, student submissions, and qualification pipelines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/exam/admin/database">
            <Button variant="outline" size="sm" className="text-xs uppercase tracking-wider gap-1.5 font-semibold">
              <Database className="w-3.5 h-3.5" />
              <span>Database Studio</span>
            </Button>
          </Link>

          <Link href="/exam/admin/examinations/create">
            <Button size="sm" className="text-xs uppercase tracking-wider gap-1.5 font-semibold">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Examination</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Dashboard Statistics Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500 block">Total Exams</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1 block">{stats.totalExaminations}</span>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500 block">Candidates</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1 block">{stats.totalStudents}</span>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 block">Writing Exam</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1 block flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {stats.studentsWriting}
          </span>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500 block">Submissions</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1 block">{stats.totalSubmissions}</span>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500 block">Qualified</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1 block">{stats.qualifiedStudents}</span>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500 block">OCR Queue</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1 block">{stats.pendingOcrJobs}</span>
        </div>
      </div>

      {/* Examinations & Dynamic Round Overviews */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Active Examinations & Configured Rounds
          </h2>
          <Link
            href="/exam/admin/examinations"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white uppercase tracking-wider transition-colors"
          >
            View All ({examinations.length})
          </Link>
        </div>

        {examinations.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-center">
            <FileQuestion className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No Examinations Found</p>
            <p className="text-xs text-zinc-500 mt-1">Click &quot;Create Examination&quot; above to set up your first assessment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {examinations.map((exam) => {
              const rounds = exam.rounds || [];
              const totalDuration = rounds.reduce((acc, r) => acc + r.duration_minutes, 0);

              const statusVariant = {
                live: 'success',
                scheduled: 'warning',
                published: 'info',
                draft: 'neutral',
                completed: 'neutral',
                archived: 'neutral',
                paused: 'warning',
              }[exam.status] as 'success' | 'warning' | 'info' | 'neutral';

              return (
                <div
                  key={`dashboard-exam-${exam.id}`}
                  className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                >
                  <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={statusVariant}>{exam.status}</Badge>
                      <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">slug: {exam.slug}</span>
                    </div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{exam.name}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                      {exam.description || 'Configured multi-round assessment.'}
                    </p>
                  </div>

                  <div className="p-5 space-y-4 flex-1">
                    <div className="flex items-center gap-6 text-xs text-zinc-600 dark:text-zinc-400 py-2 border-y border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{rounds.length} Rounds</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{formatDuration(totalDuration)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Limit: {exam.student_limit || '200+'}</span>
                      </div>
                    </div>

                    {/* Dynamic Round Cards Grid */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Sequential Rounds
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {rounds.map((r) => (
                          <div
                            key={`dashboard-exam-${exam.id}-round-${r.id || r.round_number}`}
                            className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 text-xs"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">R{r.round_number}</span>
                              <Badge variant={r.status === 'active' ? 'success' : 'neutral'} size="sm">
                                {r.status}
                              </Badge>
                            </div>
                            <p className="truncate text-zinc-700 dark:text-zinc-300 text-[11px] font-medium">{r.name}</p>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                              <span>{r.duration_minutes}m</span>
                              <span>Pass: {r.qualifying_marks}m</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 mt-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <Link
                      href={`/exam/${exam.slug}`}
                      target="_blank"
                      className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1.5 font-medium transition-colors"
                    >
                      <span>Public Link</span>
                      <ExternalLink className="w-3 h-3 text-zinc-400" />
                    </Link>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Link href={`/exam/admin/examinations/${exam.id}/results`} className="flex-1 sm:flex-initial">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs uppercase tracking-wider font-semibold gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          <span>Live Monitor</span>
                        </Button>
                      </Link>
                      <Link href={`/exam/admin/examinations/${exam.id}`} className="flex-1 sm:flex-initial">
                        <Button size="sm" className="w-full sm:w-auto text-xs uppercase tracking-wider font-semibold gap-1.5">
                          <span>Manage</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminLayoutWrapper>
      <React.Suspense
        fallback={
          <div className="space-y-6 animate-pulse">
            <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-md w-1/3" />
            <div className="grid grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          </div>
        }
      >
        <AdminDashboardContent />
      </React.Suspense>
    </AdminLayoutWrapper>
  );
}
