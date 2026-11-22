import * as React from 'react';
import { db } from '@/lib/db/store';
import { Navbar } from '@/components/common/navbar';
import { EmptyState } from '@/components/ui/empty-state';
import { Clock, Layers, FileQuestion, Users, Award } from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import { EnterExamButton } from '@/components/exam/enter-exam-button';
import { CatalogVisualBanner } from '@/components/exam/catalog-visual-banner';

async function ExamCatalogList() {
  const examinations = await db.getExaminations();
  const availableExams = examinations.filter(
    (e) => e.status === 'live' || e.status === 'published' || e.status === 'scheduled'
  );

  if (availableExams.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] p-8 text-center">
        <EmptyState
          icon={FileQuestion}
          title="No Active Examination Scheduled"
          description="Upcoming examinations will appear here once published by the examination coordinator."
        />
      </div>
    );
  }

  // Fetch stats for all exams in parallel
  const examsWithStats = await Promise.all(
    availableExams.map(async (exam) => {
      const stats = await db.getExamStudentStats(exam.id);
      const totalDuration = (exam.rounds || []).reduce((acc, r) => acc + r.duration_minutes, 0);
      const totalMarks = (exam.rounds || []).reduce((acc, r) => acc + Number(r.total_marks || 0), 0);
      const roundCount = exam.rounds?.length || 0;
      const isLive = exam.status === 'live';
      const isRoster = (exam.auth_mode ?? 'roster') === 'roster';

      return {
        exam,
        stats,
        totalDuration,
        totalMarks,
        roundCount,
        isLive,
        isRoster,
      };
    })
  );

  return (
    <div className="space-y-4">
      {examsWithStats.map(({ exam, stats, totalDuration, totalMarks, roundCount, isLive, isRoster }) => (
        <div
          key={exam.id}
          className="group relative rounded-2xl border border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] shadow-[0_4px_24px_rgba(184,179,255,0.08)] hover:border-[#b8b3ff] dark:hover:border-[#635bff] transition-all duration-300 overflow-hidden p-5 sm:p-6"
        >
          {/* Top Row: Status & Slug */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f0effe] dark:bg-[#1e1b3d] text-[#635bff] dark:text-[#b8b3ff] border border-[#e0ddfc] dark:border-[#38336d]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {isLive ? 'Active Assessment' : 'Scheduled'}
              </span>
            </div>
            <span className="text-xs font-mono text-[#706b9b] dark:text-[#a4a0c8]">
              /{exam.slug}
            </span>
          </div>

          {/* Title & Description */}
          <h2 className="text-xl sm:text-2xl font-semibold text-[#1d1a4a] dark:text-[#f4f3ff] tracking-tight group-hover:text-[#635bff] dark:group-hover:text-[#b8b3ff] transition-colors">
            {exam.name}
          </h2>

          <p className="mt-1 text-xs sm:text-sm text-[#706b9b] dark:text-[#a4a0c8] leading-relaxed">
            {exam.description || 'Enterprise candidate assessment with sequential qualification criteria.'}
          </p>

          {/* Key Statistics Grid (2x2 layout inside the card) */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-2.5 pt-3.5 sm:pt-4 border-t border-[#e6e3f8] dark:border-[#2c2854]">
            {/* 1. Candidate Progress / Roster */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d] border border-[#e6e3f8] dark:border-[#2c2854]">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[#706b9b] dark:text-[#a4a0c8]">
                <Users className="w-3.5 h-3.5 text-[#8580b0]" />
                <span className="truncate">Candidate Status</span>
              </div>
              <div className="mt-1 font-semibold text-xs sm:text-sm text-[#1d1a4a] dark:text-[#f4f3ff] truncate">
                {isRoster ? (
                  stats.registered > 0 ? (
                    <span>{stats.notWritten} Yet to Write</span>
                  ) : (
                    <span>Roster Pending</span>
                  )
                ) : (
                  <span>Open Enrollment</span>
                )}
              </div>
              <div className="text-[9px] sm:text-[10px] text-[#706b9b] dark:text-[#a4a0c8] mt-0.5 truncate">
                {isRoster ? `${stats.registered} registered candidates` : 'Direct candidate entry'}
              </div>
            </div>

            {/* 2. Total Duration */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d] border border-[#e6e3f8] dark:border-[#2c2854]">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[#706b9b] dark:text-[#a4a0c8]">
                <Clock className="w-3.5 h-3.5 text-[#8580b0]" />
                <span className="truncate">Total Duration</span>
              </div>
              <div className="mt-1 font-semibold text-xs sm:text-sm text-[#1d1a4a] dark:text-[#f4f3ff] truncate">
                {formatDuration(totalDuration)}
              </div>
              <div className="text-[9px] sm:text-[10px] text-[#706b9b] dark:text-[#a4a0c8] mt-0.5 truncate">
                Timed assessment session
              </div>
            </div>

            {/* 3. Evaluation Structure */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d] border border-[#e6e3f8] dark:border-[#2c2854]">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[#706b9b] dark:text-[#a4a0c8]">
                <Layers className="w-3.5 h-3.5 text-[#8580b0]" />
                <span className="truncate">Evaluation Structure</span>
              </div>
              <div className="mt-1 font-semibold text-xs sm:text-sm text-[#1d1a4a] dark:text-[#f4f3ff] truncate">
                {roundCount} Dynamic Round{roundCount !== 1 ? 's' : ''}
              </div>
              <div className="text-[9px] sm:text-[10px] text-[#706b9b] dark:text-[#a4a0c8] mt-0.5 truncate">
                Sequential qualification
              </div>
            </div>

            {/* 4. Total Marks */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#f8f7fe] dark:bg-[#1e1b3d] border border-[#e6e3f8] dark:border-[#2c2854]">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[#706b9b] dark:text-[#a4a0c8]">
                <Award className="w-3.5 h-3.5 text-[#8580b0]" />
                <span className="truncate">Scoring &amp; Marks</span>
              </div>
              <div className="mt-1 font-semibold text-xs sm:text-sm text-[#1d1a4a] dark:text-[#f4f3ff] truncate">
                {totalMarks > 0 ? `${totalMarks} Total Marks` : 'Criterion based'}
              </div>
              <div className="text-[9px] sm:text-[10px] text-[#706b9b] dark:text-[#a4a0c8] mt-0.5 truncate">
                Automated qualification
              </div>
            </div>
          </div>

          {/* Action Row with Sakuga Button */}
          <div className="mt-4 sm:mt-5 pt-3 sm:pt-3.5 border-t border-[#e6e3f8] dark:border-[#2c2854] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-[#706b9b] dark:text-[#a4a0c8] text-center sm:text-left">
              Authorized candidates only • Verification required before entering.
            </p>

            <EnterExamButton slug={exam.slug} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExamCatalogPage() {
  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#faf9fe] dark:bg-[#0d0c1d] text-[#1d1a4a] dark:text-[#f4f3ff] transition-colors lg:overflow-hidden">
      <Navbar />

      <main className="flex-1 w-full px-4 sm:px-8 lg:px-12 py-4 sm:py-5 flex flex-col justify-between overflow-y-auto lg:overflow-hidden">
        <div>
          {/* Header */}
          <div className="mb-4 sm:mb-5 max-w-3xl">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1a4a] dark:text-[#f4f3ff] font-serif">
              Examinations
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#706b9b] dark:text-[#a4a0c8] leading-relaxed">
              Select an examination below to view instructions, verify credentials, and enter scheduled evaluation rounds.
            </p>
          </div>

          {/* Layout: Card on the left, right side reserved for future animations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
            <div className="lg:col-span-7 xl:col-span-7">
              <React.Suspense
                fallback={
                  <div className="h-56 bg-[#edeaff] dark:bg-[#1e1b3d] rounded-2xl animate-pulse" />
                }
              >
                <ExamCatalogList />
              </React.Suspense>
            </div>

            {/* Right side area: Visual Banner */}
            <div className="hidden lg:flex lg:col-span-5 xl:col-span-5 items-center justify-center p-4">
              <CatalogVisualBanner />
            </div>
          </div>
        </div>

        {/* Minimalist Footer */}
        <footer className="pt-3 border-t border-[#e6e3f8] dark:border-[#2c2854] flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2 text-[10px] sm:text-[11px] text-[#706b9b] dark:text-[#a4a0c8] shrink-0 pb-3 sm:pb-1 text-center sm:text-left">
          <p>Mentneo Assessment Platform • Secure Examination Environment</p>
          <p>All sessions monitored &amp; verified</p>
        </footer>
      </main>
    </div>
  );
}
