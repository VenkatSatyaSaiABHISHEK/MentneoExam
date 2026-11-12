import * as React from 'react';
import Link from 'next/link';
import { db } from '@/lib/db/store';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileCheck2,
  Users,
  Activity,
  Award,
  Layers,
  ArrowRight,
  PlusCircle,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { formatDuration } from '@/lib/utils';

async function AdminDashboardContent() {
  const stats = await db.getAdminStats();
  const examinations = await db.getExaminations();

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Overview</h1>
          <p className="mt-1 text-xs text-gray-500">
            Real-time monitoring of concurrent examinations, candidate submissions, and OCR pipelines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/exam/admin/examinations/create">
            <Button size="sm" className="text-xs uppercase tracking-wider gap-1.5 font-semibold">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Examination</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Dashboard Statistics Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 block">Total Exams</span>
          <span className="text-2xl font-bold text-gray-900 mt-1 block">{stats.totalExaminations}</span>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 block">Candidates</span>
          <span className="text-2xl font-bold text-gray-900 mt-1 block">{stats.totalStudents}</span>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 block">Currently Writing</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {stats.studentsWriting}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 block">Submissions</span>
          <span className="text-2xl font-bold text-gray-900 mt-1 block">{stats.totalSubmissions}</span>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 block">Qualified</span>
          <span className="text-2xl font-bold text-gray-900 mt-1 block">{stats.qualifiedStudents}</span>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 block">Pending OCR</span>
          <span className="text-2xl font-bold text-gray-900 mt-1 block">{stats.pendingOcrJobs}</span>
        </div>
      </div>

      {/* Examinations & Dynamic Round Overviews */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
            Active Examinations & Configured Rounds
          </h2>
          <Link
            href="/exam/admin/examinations"
            className="text-xs font-semibold text-gray-600 hover:text-gray-900 uppercase tracking-wider"
          >
            View All ({examinations.length})
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            }[exam.status] as 'success' | 'warning' | 'info' | 'neutral';

            return (
              <Card key={`dashboard-exam-${exam.id}`} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge variant={statusVariant}>{exam.status}</Badge>
                    <span className="text-xs font-mono text-gray-400">slug: {exam.slug}</span>
                  </div>
                  <CardTitle className="text-base">{exam.name}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-1">{exam.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 flex-1">
                  <div className="flex items-center gap-6 text-xs text-gray-600 py-2 border-y border-gray-100">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-gray-400" />
                      <span>{rounds.length} Configured Rounds</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{formatDuration(totalDuration)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>Limit: {exam.student_limit || '200+'}</span>
                    </div>
                  </div>

                  {/* Dynamic Round Cards Grid */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                      Sequential Rounds
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {rounds.map((r) => (
                        <div key={`dashboard-exam-${exam.id}-round-${r.id || r.round_number}`} className="p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-gray-900">R{r.round_number}</span>
                            <Badge variant={r.status === 'active' ? 'success' : 'neutral'} size="sm">
                              {r.status}
                            </Badge>
                          </div>
                          <p className="truncate text-gray-600 text-[11px] font-medium">{r.name}</p>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                            <span>{r.duration_minutes}m</span>
                            <span>Pass: {r.qualifying_marks}m</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>

                <div className="p-5 pt-0 border-t border-gray-100 mt-auto flex items-center justify-between gap-3">
                  <Link href={`/exam/${exam.slug}`} target="_blank" className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1.5 font-medium">
                    <span>Public Link</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </Link>

                  <div className="flex items-center gap-2">
                    <Link href={`/exam/admin/examinations/${exam.id}/results`}>
                      <Button variant="outline" size="sm" className="text-xs uppercase tracking-wider font-semibold gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        <span>Live Monitor</span>
                      </Button>
                    </Link>
                    <Link href={`/exam/admin/examinations/${exam.id}`}>
                      <Button size="sm" className="text-xs uppercase tracking-wider font-semibold gap-1.5">
                        <span>Manage</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
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
            <div className="h-8 bg-gray-200 rounded-md w-1/3" />
            <div className="grid grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        }
      >
        <AdminDashboardContent />
      </React.Suspense>
    </AdminLayoutWrapper>
  );
}
