import * as React from 'react';
import Link from 'next/link';
import { db } from '@/lib/db/store';
import { Navbar } from '@/components/common/navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Calendar, Clock, Layers, ArrowRight, FileQuestion } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

async function ExamCatalogList() {
  const examinations = await db.getExaminations();
  const availableExams = examinations.filter(
    (e) => e.status === 'live' || e.status === 'published' || e.status === 'scheduled'
  );

  if (availableExams.length === 0) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="No examination is currently available."
        description="Upcoming examinations will appear here once published by administrators."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {availableExams.map((exam) => {
        const totalDuration = (exam.rounds || []).reduce((acc, r) => acc + r.duration_minutes, 0);
        const roundCount = exam.rounds?.length || 0;

        const statusVariant = {
          live: 'success',
          scheduled: 'warning',
          published: 'info',
          draft: 'neutral',
          completed: 'neutral',
          archived: 'neutral',
        }[exam.status] as 'success' | 'warning' | 'info' | 'neutral';

        return (
          <Card key={exam.id} className="flex flex-col hover:border-gray-400 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Badge variant={statusVariant}>{exam.status}</Badge>
                <span className="text-[11px] font-mono text-gray-400">/{exam.slug}</span>
              </div>
              <CardTitle className="text-lg leading-snug">{exam.name}</CardTitle>
              <CardDescription className="line-clamp-2 mt-1">
                {exam.description || 'Comprehensive evaluation covering multiple rounds and skill levels.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 flex-1 text-xs text-gray-600">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{roundCount} Dynamic Round{roundCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                <span>Total Duration: {formatDuration(totalDuration)}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <span>
                  {exam.start_time
                    ? new Date(exam.start_time).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })
                    : 'Immediate Availability'}
                </span>
              </div>
            </CardContent>

            <CardFooter className="pt-4 border-t border-gray-100">
              <Link href={`/exam/${exam.slug}`} className="w-full">
                <Button className="w-full text-xs font-semibold uppercase tracking-wider gap-2">
                  <span>Enter Examination</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

export default function ExamCatalogPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-8 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Examinations Portal</h1>
            <p className="mt-1 text-sm text-gray-500">
              Select an examination below to view instructions, register, and enter scheduled rounds.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <React.Suspense
            fallback={
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                <div className="h-56 bg-gray-200 rounded-xl" />
                <div className="h-56 bg-gray-200 rounded-xl" />
                <div className="h-56 bg-gray-200 rounded-xl" />
              </div>
            }
          >
            <ExamCatalogList />
          </React.Suspense>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>ExamS Assessment Infrastructure.</p>
          <Link href="/admin">
            <Button variant="outline" size="sm" className="text-xs uppercase tracking-wider font-semibold gap-1.5">
              <span>Admin Console</span>
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
