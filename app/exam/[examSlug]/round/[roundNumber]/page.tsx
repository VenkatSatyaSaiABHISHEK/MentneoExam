'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock,
  AlertTriangle,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  Menu,
  X,
  FileCode,
  Layers,
  Lock,
  Sparkles,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CodingSandbox } from '@/components/exam/coding-sandbox';
import { formatTimeRemaining, cn } from '@/lib/utils';
import { Question, ExaminationAttempt, AttemptAnswer, Student, ExaminationRound } from '@/types';
import { offlineSync, QueuedAnswer } from '@/lib/exam/offline-sync';

function ExaminationEngineContent() {
  const params = useParams();
  const router = useRouter();
  const slug = params.examSlug as string;
  const roundNum = parseInt(params.roundNumber as string, 10) || 1;

  // Engine state
  const [loading, setLoading] = React.useState(true);
  const [exam, setExam] = React.useState<any>(null);
  const [currentRound, setCurrentRound] = React.useState<ExaminationRound | null>(null);
  const [attempt, setAttempt] = React.useState<ExaminationAttempt | null>(null);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [answers, setAnswers] = React.useState<Record<string, AttemptAnswer>>({});
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [student, setStudent] = React.useState<Student | null>(null);

  // Authoritative server timer state
  const [secondsRemaining, setSecondsRemaining] = React.useState<number>(0);
  const [savingAnswer, setSavingAnswer] = React.useState(false);

  // High-Concurrency Answer Batching & Offline Sync State
  const [syncStatus, setSyncStatus] = React.useState<'saved' | 'saving' | 'offline'>('saved');
  const [pendingCount, setPendingCount] = React.useState<number>(0);
  const pendingBatchRef = React.useRef<Map<string, QueuedAnswer>>(new Map());
  const seqCounterRef = React.useRef<number>(0);
  const batchTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = React.useRef<boolean>(false);

  // Submission lock countdown (delayed submit)
  const [submitLockRemaining, setSubmitLockRemaining] = React.useState<number>(0);

  // Cheating deterrence state
  const [warningModalOpen, setWarningModalOpen] = React.useState(false);
  const [currentWarning, setCurrentWarning] = React.useState<number>(0);
  const [maxWarnings, setMaxWarnings] = React.useState<number>(3);
  const [violationReason, setViolationReason] = React.useState<string>('');
  const [isTerminated, setIsTerminated] = React.useState(false);

  // Submission modal state
  const [submitModalOpen, setSubmitModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = React.useState(false);

  // 1. Initial Load: Register / Start Attempt
  React.useEffect(() => {
    async function initEngine() {
      try {
        setLoading(true);
        // Load exam details directly by slug (O(1) lookup without full catalog scan)
        const examRes = await fetch(`/api/examinations/by-slug/${slug}`);
        const examJson = await examRes.json();
        const foundExam = examJson.data;
        if (!foundExam) {
          toast.error('Examination not found');
          router.push('/exam');
          return;
        }
        setExam(foundExam);

        // Find current round
        const round = (foundExam.rounds || []).find((r: ExaminationRound) => r.round_number === roundNum);
        if (!round) {
          toast.error(`Round ${roundNum} not found in this examination.`);
          router.push(`/exam/${slug}`);
          return;
        }
        setCurrentRound(round);

        // Retrieve registration
        let regId = localStorage.getItem(`exam_reg_${foundExam.id}`);
        const storedStudent = localStorage.getItem(`exam_student_${foundExam.id}`);
        if (storedStudent) {
          setStudent(JSON.parse(storedStudent));
        }

        // Verify credentials if in roster mode
        if (!regId) {
          if (foundExam.auth_mode === 'roster') {
            toast.error('Please verify your candidate credentials to access this examination.');
            router.push(`/exam/${slug}`);
            return;
          }

          // In open mode, auto-register fallback guest session
          const autoReg = await fetch('/api/students/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              examId: foundExam.id,
              fullName: 'Candidate ' + Math.random().toString(36).substring(2, 6).toUpperCase(),
              email: `student-${Date.now()}@exams.internal`,
              rollNumber: `ROLL-${Date.now().toString().slice(-5)}`,
            }),
          });
          const autoData = await autoReg.json();
          if (autoData.success) {
            regId = autoData.data.registrationId;
            localStorage.setItem(`exam_reg_${foundExam.id}`, regId!);
            setStudent(autoData.data.student);
          }
        }

        // Start Attempt (server-authoritative)
        const startRes = await fetch('/api/attempts/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registrationId: regId,
            roundId: round.id,
          }),
        });
        const startData = await startRes.json();

        if (!startRes.ok || !startData.success) {
          toast.error(startData.error || 'Failed to initialize attempt.');
          return;
        }

        const { attempt: att, questions: qs, answers: savedAns, secondsRemaining: secRem } = startData.data;

        setAttempt(att);
        setQuestions(qs);
        setAnswers(savedAns || {});
        setSecondsRemaining(secRem);
        setCurrentWarning(att.cheating_warnings || 0);
        setMaxWarnings(foundExam.max_cheating_warnings || 3);

        // Calculate initial submit lock remaining
        const minSubmitMinutes = round.min_time_before_submit_minutes ?? 1;
        const startedTime = new Date(att.started_at).getTime();
        const elapsedSecs = Math.max(0, Math.floor((Date.now() - startedTime) / 1000));
        const lockSecs = Math.max(0, minSubmitMinutes * 60 - elapsedSecs);
        setSubmitLockRemaining(lockSecs);

        if (att.status === 'submitted' || att.status === 'timed_out' || att.status === 'terminated') {
          router.push(`/exam/${slug}/result?attemptId=${att.id}`);
        }
      } catch {
        toast.error('Network initialization failed.');
      } finally {
        setLoading(false);
      }
    }

    initEngine();
  }, [slug, roundNum, router]);

  // 2. Authoritative Timer Countdown & Submit Unlock Timer
  React.useEffect(() => {
    if (loading || !attempt || attempt.status !== 'in_progress') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleForceAutoSubmit('Deadline expired. Examination auto-submitted by authoritative timer.');
          return 0;
        }
        return prev - 1;
      });

      setSubmitLockRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, attempt]);

  // 3. Periodic Server Clock Reconciliation (Staggered Jitter for 500+ Concurrent Students)
  React.useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;

    const jitter = Math.floor(Math.random() * 8000);
    const syncInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/attempts/${attempt.id}/status`);
        const json = await res.json();
        if (json.success && json.data) {
          setSecondsRemaining(json.data.secondsRemaining);
          if (json.data.isExpired || json.data.status !== 'in_progress') {
            handleForceAutoSubmit('Examination deadline expired on the server.');
          }
        }
      } catch {
        // Keep running client timer if sync request fails
      }
    }, 32000 + jitter);

    return () => clearInterval(syncInterval);
  }, [attempt]);

  // 4. Anti-Cheating Sensor: Listen to Tab Blur, Visibility Change, Copy/Paste
  React.useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress' || isTerminated) return;

    const isAiTabAllowed = currentRound?.allow_tab_switch === true;
    const isCopyAllowed = currentRound?.allow_copy_paste === true;

    const reportViolation = async (violationType: string, label: string) => {
      try {
        const res = await fetch(`/api/attempts/${attempt.id}/cheating-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            violationType,
            metadata: { timestamp: new Date().toISOString() },
          }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          const { warningNumber, maxWarnings: maxW, isTerminated: term } = json.data;
          setCurrentWarning(warningNumber);
          setMaxWarnings(maxW);
          setViolationReason(label);
          setWarningModalOpen(true);

          if (term) {
            setIsTerminated(true);
            toast.error('Maximum proctoring warnings reached. Attempt terminated.');
            setTimeout(() => {
              router.push(`/exam/${slug}/result?attemptId=${attempt.id}`);
            }, 2500);
          }
        }
      } catch {
        // Ignore failure
      }
    };

    const handleVisibilityChange = () => {
      if (isAiTabAllowed) return; // Tab switching permitted for this round!
      if (document.hidden) {
        reportViolation('tab_switch', 'Tab switch or window minimized');
      }
    };

    const handleWindowBlur = () => {
      if (isAiTabAllowed) return; // Window blur permitted for open AI mode
      reportViolation('window_blur', 'Window lost focus to another application');
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (isCopyAllowed) return;
      e.preventDefault();
      reportViolation('copy_attempt', 'Attempted to copy examination text');
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (isCopyAllowed) return;
      e.preventDefault();
      reportViolation('paste_attempt', 'Clipboard paste operation detected');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        e.key === 'PrintScreen' ||
        (!isCopyAllowed && e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 'c' || e.key === 'C'))
      ) {
        e.preventDefault();
        reportViolation('keyboard_shortcut', `Prohibited key combination (${e.key})`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [attempt, isTerminated, currentRound, slug, router]);

  // Reconnection listener to automatically flush queued answers
  React.useEffect(() => {
    const handleOnline = () => {
      toast.info('Network connection restored. Synchronizing answers...');
      flushPendingAnswers();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [attempt]);

  // Flush queued/buffered answers to server
  const flushPendingAnswers = React.useCallback(async () => {
    if (!attempt) return;
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }

    const itemsToSend = Array.from(pendingBatchRef.current.values());

    // Also collect any older offline items from IndexedDB
    try {
      const offlineItems = await offlineSync.getPendingAnswers(attempt.id);
      for (const item of offlineItems) {
        if (!pendingBatchRef.current.has(item.key)) {
          itemsToSend.push(item);
        }
      }
    } catch {
      // ignore
    }

    if (itemsToSend.length === 0) {
      setSyncStatus('saved');
      setPendingCount(0);
      return;
    }

    setSyncStatus('saving');

    try {
      const res = await offlineSync.flushBatch(attempt.id, itemsToSend);
      if (res.success) {
        for (const it of itemsToSend) {
          pendingBatchRef.current.delete(it.key);
        }
        const remaining = await offlineSync.getPendingAnswers(attempt.id);
        setPendingCount(remaining.length);
        setSyncStatus(remaining.length > 0 ? 'offline' : 'saved');
      } else {
        setSyncStatus('offline');
        const remaining = await offlineSync.getPendingAnswers(attempt.id);
        setPendingCount(remaining.length);
      }
    } catch {
      setSyncStatus('offline');
    }
  }, [attempt]);

  // Queue answer change with monotonic sequencing and debounce flush
  const queueAnswerUpdate = React.useCallback(
    (questionId: string, answerData: Partial<AttemptAnswer>) => {
      if (!attempt) return;
      seqCounterRef.current += 1;
      const seq = seqCounterRef.current;
      const key = `${attempt.id}_${questionId}`;

      const queued: QueuedAnswer = {
        key,
        attemptId: attempt.id,
        questionId,
        selectedOption: answerData.selected_option !== undefined ? answerData.selected_option : null,
        codeSnippet: answerData.code_snippet !== undefined ? answerData.code_snippet : null,
        codeLanguage: answerData.code_language !== undefined ? answerData.code_language : null,
        isMarkedForReview: Boolean(answerData.is_marked_for_review),
        seq,
        clientTimestamp: new Date().toISOString(),
      };

      pendingBatchRef.current.set(key, queued);
      offlineSync.queueAnswer(queued);
      setSyncStatus('saving');
      setPendingCount((prev) => prev + 1);

      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
      batchTimerRef.current = setTimeout(() => {
        flushPendingAnswers();
      }, 1800);
    },
    [attempt, flushPendingAnswers]
  );

  // Answer selection handler for MCQs
  const handleSelectOption = (optionLabel: string) => {
    if (!attempt || !currentQuestion) return;

    const qId = currentQuestion.id;
    const currentAns = answers[qId];
    const isSame = currentAns?.selected_option === optionLabel;
    const nextSelected = isSame ? null : optionLabel;

    const updatedAns: AttemptAnswer = {
      id: currentAns?.id || `ans-${Date.now()}`,
      attempt_id: attempt.id,
      question_id: qId,
      selected_option: nextSelected,
      is_marked_for_review: currentAns?.is_marked_for_review || false,
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setAnswers((prev) => {
      const next = { ...prev, [qId]: updatedAns };
      try {
        localStorage.setItem(`attempt_answers_${attempt.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });

    queueAnswerUpdate(qId, {
      selected_option: nextSelected,
      is_marked_for_review: updatedAns.is_marked_for_review,
    });
  };

  // Code change handler for Coding Sandbox
  const handleCodeChange = (codeSnippet: string, codeLanguage: string) => {
    if (!attempt || !currentQuestion) return;
    const qId = currentQuestion.id;
    const currentAns = answers[qId];

    const updatedAns: AttemptAnswer = {
      id: currentAns?.id || `ans-${Date.now()}`,
      attempt_id: attempt.id,
      question_id: qId,
      selected_option: null,
      code_snippet: codeSnippet,
      code_language: codeLanguage,
      is_marked_for_review: currentAns?.is_marked_for_review || false,
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setAnswers((prev) => {
      const next = { ...prev, [qId]: updatedAns };
      try {
        localStorage.setItem(`attempt_answers_${attempt.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });

    queueAnswerUpdate(qId, {
      selected_option: null,
      code_snippet: codeSnippet,
      code_language: codeLanguage,
      is_marked_for_review: updatedAns.is_marked_for_review,
    });
  };

  // Toggle mark for review
  const handleToggleMarkReview = () => {
    if (!attempt || !currentQuestion) return;

    const qId = currentQuestion.id;
    const currentAns = answers[qId];
    const nextMark = !currentAns?.is_marked_for_review;

    const updatedAns: AttemptAnswer = {
      id: currentAns?.id || `ans-${Date.now()}`,
      attempt_id: attempt.id,
      question_id: qId,
      selected_option: currentAns?.selected_option || null,
      code_snippet: currentAns?.code_snippet || null,
      code_language: currentAns?.code_language || null,
      is_marked_for_review: nextMark,
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setAnswers((prev) => {
      const next = { ...prev, [qId]: updatedAns };
      try {
        localStorage.setItem(`attempt_answers_${attempt.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });

    queueAnswerUpdate(qId, {
      selected_option: updatedAns.selected_option,
      code_snippet: updatedAns.code_snippet,
      code_language: updatedAns.code_language,
      is_marked_for_review: nextMark,
    });
  };

  // Clear answer
  const handleClearAnswer = () => {
    if (!attempt || !currentQuestion) return;
    const qId = currentQuestion.id;
    const currentAns = answers[qId];

    const updatedAns: AttemptAnswer = {
      id: currentAns?.id || `ans-${Date.now()}`,
      attempt_id: attempt.id,
      question_id: qId,
      selected_option: null,
      code_snippet: null,
      code_language: null,
      is_marked_for_review: currentAns?.is_marked_for_review || false,
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setAnswers((prev) => {
      const next = { ...prev, [qId]: updatedAns };
      try {
        localStorage.setItem(`attempt_answers_${attempt.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });

    queueAnswerUpdate(qId, {
      selected_option: null,
      code_snippet: null,
      code_language: null,
      is_marked_for_review: updatedAns.is_marked_for_review,
    });
  };

  // Submit attempt with double-click protection and pre-flush
  const handleSubmitExam = async () => {
    if (!attempt || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // 1. Flush any pending buffered answers before submission
      await flushPendingAnswers();

      // 2. Execute authoritative submission
      const res = await fetch(`/api/attempts/${attempt.id}/submit`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Submission failed');
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      toast.success('Examination round submitted successfully.');
      router.push(`/exam/${slug}/result?attemptId=${attempt.id}`);
    } catch {
      toast.error('Submission request failed');
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleForceAutoSubmit = async (reason: string) => {
    if (!attempt || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    toast.info(reason);

    try {
      await flushPendingAnswers();
      await fetch(`/api/attempts/${attempt.id}/submit`, {
        method: 'POST',
      });
      router.push(`/exam/${slug}/result?attemptId=${attempt.id}`);
    } catch {
      router.push(`/exam/${slug}/result?attemptId=${attempt.id}`);
    }
  };

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const isCodingRound = currentRound?.round_type === 'coding' || currentQuestion?.question_type === 'coding';
  const isAiAllowed = currentRound?.allow_tab_switch === true;

  // Counts for summary
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    return Boolean(a?.selected_option) || Boolean(a?.code_snippet && a.code_snippet.trim().length > 10);
  }).length;

  const markedReviewCount = questions.filter((q) => Boolean(answers[q.id]?.is_marked_for_review)).length;
  const unansweredCount = questions.length - answeredCount;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center space-y-4">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
          Loading Examination Engine & Question Pool...
        </p>
      </div>
    );
  }

  const isLowTime = secondsRemaining > 0 && secondsRemaining < 300; // < 5 mins
  const isSubmitLocked = submitLockRemaining > 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/60 select-none">
      {/* Sticky Top Engine Bar */}
      <header className="sticky top-0 z-30 w-full border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Exam info */}
          <div className="flex items-center gap-3 truncate">
            <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
              R{roundNum}
            </div>
            <div className="truncate">
              <h1 className="text-sm font-bold text-gray-900 truncate">{exam?.name}</h1>
              <p className="text-[11px] text-gray-500 font-medium truncate">
                {currentRound?.name} • Candidate: {student?.full_name || 'Registered'} ({student?.roll_number || 'ID'})
              </p>
            </div>
          </div>

          {/* Quick status pill and submit button */}
          <div className="flex items-center gap-3">
            {isAiAllowed ? (
              <Badge variant="info" size="sm" className="hidden sm:inline-flex gap-1">
                <Sparkles className="w-3 h-3" />
                <span>AI / Research Permitted</span>
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm" className="hidden sm:inline-flex gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Proctored Session</span>
              </Badge>
            )}

            {/* High-Concurrency Answer Sync Pill */}
            {syncStatus === 'saving' && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                <span>Saving...</span>
              </span>
            )}
            {syncStatus === 'offline' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                <span>Offline ({pendingCount} queued)</span>
              </span>
            )}
            {syncStatus === 'saved' && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-gray-400">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>Saved</span>
              </span>
            )}

            {/* Mobile palette toggle */}
            <button
              onClick={() => setMobilePaletteOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Submit Button */}
            <Button
              variant={isSubmitLocked ? 'outline' : 'primary'}
              size="sm"
              disabled={isSubmitLocked}
              onClick={() => setSubmitModalOpen(true)}
              className="text-xs font-semibold uppercase tracking-wider gap-1.5"
            >
              {isSubmitLocked ? (
                <>
                  <Lock className="w-3 h-3 text-gray-400" />
                  <span>Submit in {formatTimeRemaining(submitLockRemaining)}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Round</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-100">
          <div
            className="h-1 bg-gray-900 transition-all duration-300"
            style={{ width: `${(answeredCount / Math.max(1, questions.length)) * 100}%` }}
          />
        </div>
      </header>

      {/* Prominent AI Permitted Banner */}
      {isAiAllowed && (
        <div className="bg-sky-50 border-b border-sky-200 px-4 py-2.5 text-xs text-sky-950">
          <div className="max-w-7xl mx-auto flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
            <span>
              <strong>AI & External Research Permitted for Round {roundNum}:</strong> You are permitted to switch tabs, consult documentation, and use AI assistance during this round. No cheating warnings will be issued for tab changes.
            </span>
          </div>
        </div>
      )}

      {/* Main 3-Column Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: CLOCK & QUESTION COUNT SUMMARY               */}
        {/* ========================================================= */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col gap-4 sticky top-24">
          {/* Authoritative Clock Card */}
          <Card className="p-5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block mb-1">
              Time Remaining
            </span>
            <div
              className={cn(
                'flex items-center gap-2.5 font-mono text-2xl font-bold tracking-tight',
                isLowTime ? 'text-rose-600 animate-pulse' : 'text-gray-900'
              )}
            >
              <Clock className={cn('w-6 h-6', isLowTime ? 'text-rose-600' : 'text-gray-500')} />
              <span>{formatTimeRemaining(secondsRemaining)}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Server-authoritative timer synchronized with UTC clock.
            </p>
          </Card>

          {/* Questions Count & Round Details Card */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-800">Round Details</span>
              <Badge variant="neutral">Round {roundNum}</Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Questions:</span>
                <strong className="text-gray-900">{questions.length}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Assessment Type:</span>
                <span className="font-semibold text-gray-900 capitalize">
                  {currentRound?.round_type || 'MCQ'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Qualifying Marks:</span>
                <span className="font-semibold text-emerald-700">
                  {currentRound?.qualifying_marks} / {currentRound?.total_marks}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Policy:</span>
                <span className="font-semibold text-gray-700">
                  {isAiAllowed ? 'Open AI Allowed' : 'Strict Proctoring'}
                </span>
              </div>
            </div>

            {/* Candidate Identity */}
            <div className="pt-3 border-t border-gray-100 text-[11px] text-gray-500">
              <p>Candidate: <strong className="text-gray-800">{student?.full_name}</strong></p>
              <p className="font-mono text-[10px] mt-0.5">ID: {student?.roll_number}</p>
            </div>
          </Card>
        </aside>

        {/* ========================================================= */}
        {/* CENTER AREA: QUESTION WORKSPACE (MCQ OR CODING SANDBOX)   */}
        {/* ========================================================= */}
        <main className="lg:col-span-6 flex flex-col bg-white border border-gray-200 rounded-xl p-5 sm:p-7 shadow-xs min-h-[560px]">
          {currentQuestion ? (
            isCodingRound ? (
              /* Coding Sandbox Interface */
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-gray-700" />
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-gray-900 text-white">
                      Coding Problem {currentIndex + 1}
                    </span>
                    <Badge variant="neutral">{currentQuestion.difficulty}</Badge>
                    <span className="text-xs text-gray-500">+{currentQuestion.marks} marks</span>
                  </div>

                  {savingAnswer && <span className="text-[11px] text-gray-400 animate-pulse">Saving code...</span>}
                </div>

                <CodingSandbox
                  questionText={currentQuestion.question_text}
                  starterTemplates={currentRound?.coding_starter_templates}
                  initialCode={currentAnswer?.code_snippet}
                  initialLanguage={currentAnswer?.code_language}
                  onCodeChange={handleCodeChange}
                  saving={savingAnswer}
                />
              </div>
            ) : (
              /* Standard MCQ Interface */
              <div className="flex-1 flex flex-col">
                {/* Question Meta Bar */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-gray-900 text-white">
                      Q {currentIndex + 1} of {questions.length}
                    </span>
                    <Badge variant="neutral">{currentQuestion.difficulty}</Badge>
                    <span className="text-xs text-gray-500">
                      +{currentQuestion.marks} / -{currentQuestion.negative_marks} marks
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {savingAnswer && <span className="text-[11px] text-gray-400 animate-pulse">Saving...</span>}
                    <button
                      onClick={handleToggleMarkReview}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                        currentAnswer?.is_marked_for_review
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      <span>{currentAnswer?.is_marked_for_review ? 'Marked' : 'Mark for Review'}</span>
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <div className="text-base sm:text-lg font-medium text-gray-900 leading-relaxed">
                  {currentQuestion.question_text}
                </div>

                {/* Options List */}
                <div className="mt-8 space-y-3 flex-1">
                  {(currentQuestion.options || []).map((opt) => {
                    const isSelected = currentAnswer?.selected_option === opt.label;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(opt.label)}
                        className={cn(
                          'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer group',
                          isSelected
                            ? 'border-gray-900 bg-gray-900 text-white shadow-xs'
                            : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400 hover:bg-gray-50/50'
                        )}
                      >
                        <span
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0 transition-colors',
                            isSelected
                              ? 'bg-white text-gray-900'
                              : 'border border-gray-300 bg-gray-50 text-gray-700 group-hover:border-gray-400'
                          )}
                        >
                          {opt.label}
                        </span>
                        <span className="text-sm font-medium leading-snug flex-1">{opt.option_text}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Bottom Navigation */}
                <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAnswer}
                    disabled={!currentAnswer?.selected_option}
                    className="text-xs text-gray-500 gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Response</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((prev) => prev - 1)}
                      className="gap-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous</span>
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      disabled={currentIndex === questions.length - 1}
                      onClick={() => setCurrentIndex((prev) => prev + 1)}
                      className="gap-1.5"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center text-gray-500">
              <HelpCircle className="w-8 h-8 mb-2 text-gray-400" />
              <p>No questions configured for this round.</p>
            </div>
          )}
        </main>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: QUESTIONS COMPLETED BOX & PALETTE           */}
        {/* ========================================================= */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col gap-4 sticky top-24">
          {/* Questions Completed Box */}
          <Card className="p-5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block mb-1">
              Questions Completed
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-gray-900">{answeredCount}</span>
              <span className="text-xs text-gray-400 font-mono">/ {questions.length} total</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-gray-900 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / Math.max(1, questions.length)) * 100}%` }}
              />
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs pt-3 border-t border-gray-100">
              <div>
                <span className="text-[10px] uppercase text-gray-400 block font-semibold">Done</span>
                <span className="font-bold text-gray-900">{answeredCount}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-gray-400 block font-semibold">Left</span>
                <span className="font-bold text-rose-600">{unansweredCount}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-gray-400 block font-semibold">Review</span>
                <span className="font-bold text-amber-600">{markedReviewCount}</span>
              </div>
            </div>
          </Card>

          {/* Palette Grid */}
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-3">
              Question Palette
            </h3>

            <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const ans = answers[q.id];
                const isAnswered = Boolean(ans?.selected_option || (ans?.code_snippet && ans.code_snippet.trim().length > 10));
                const isMarked = Boolean(ans?.is_marked_for_review);
                const isCurrent = idx === currentIndex;

                let btnStyle = 'border-gray-200 bg-white text-gray-700 hover:border-gray-400';
                if (isMarked) {
                  btnStyle = 'border-amber-400 bg-amber-50 text-amber-900 font-semibold';
                } else if (isAnswered) {
                  btnStyle = 'border-gray-900 bg-gray-900 text-white font-bold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      'h-9 rounded-lg border text-xs font-mono transition-all flex items-center justify-center cursor-pointer',
                      btnStyle,
                      isCurrent && 'ring-2 ring-blue-500 ring-offset-1 font-bold'
                    )}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Submit Action */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <Button
                variant={isSubmitLocked ? 'outline' : 'primary'}
                size="sm"
                disabled={isSubmitLocked}
                onClick={() => setSubmitModalOpen(true)}
                className="w-full text-xs font-semibold uppercase tracking-wider h-10"
              >
                {isSubmitLocked ? (
                  <span>Unlocks in {formatTimeRemaining(submitLockRemaining)}</span>
                ) : (
                  <span>Review & Submit Round</span>
                )}
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {/* Mobile Question Palette Drawer */}
      {mobilePaletteOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs lg:hidden">
          <div className="bg-white rounded-t-2xl p-6 border-t border-gray-200 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">Question Palette</h3>
              <button onClick={() => setMobilePaletteOpen(false)} className="p-1 rounded-md text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2 my-6 overflow-y-auto">
              {questions.map((q, idx) => {
                const ans = answers[q.id];
                const isAnswered = Boolean(ans?.selected_option || (ans?.code_snippet && ans.code_snippet.trim().length > 10));
                const isMarked = Boolean(ans?.is_marked_for_review);
                const isCurrent = idx === currentIndex;

                let btnStyle = 'border-gray-200 bg-white text-gray-700';
                if (isMarked) {
                  btnStyle = 'border-amber-400 bg-amber-50 text-amber-900 font-semibold';
                } else if (isAnswered) {
                  btnStyle = 'border-gray-900 bg-gray-900 text-white font-bold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setMobilePaletteOpen(false);
                    }}
                    className={cn(
                      'h-11 rounded-lg border text-xs font-mono flex items-center justify-center',
                      btnStyle,
                      isCurrent && 'ring-2 ring-blue-500'
                    )}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <Button
              variant="primary"
              size="md"
              disabled={isSubmitLocked}
              onClick={() => {
                setMobilePaletteOpen(false);
                setSubmitModalOpen(true);
              }}
              className="w-full text-xs uppercase tracking-wider font-semibold"
            >
              {isSubmitLocked ? `Submission Unlocks in ${formatTimeRemaining(submitLockRemaining)}` : 'Proceed to Submission'}
            </Button>
          </div>
        </div>
      )}

      {/* Proctoring Warning Dialog */}
      <Dialog
        isOpen={warningModalOpen}
        onClose={() => setWarningModalOpen(false)}
        title="Proctoring Warning Issued"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Violation Detected: Warning {currentWarning} of {maxWarnings}
              </p>
              <p className="mt-1 text-rose-700 font-medium">Reason: {violationReason}</p>
            </div>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            Please remain focused on the examination browser window. Leaving this window, switching tabs, or using
            unauthorized hotkeys is strictly monitored. Reaching {maxWarnings} warnings will immediately terminate your
            examination.
          </p>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setWarningModalOpen(false)}
            className="w-full text-xs uppercase tracking-wider font-semibold"
          >
            I Acknowledge & Return to Exam
          </Button>
        </div>
      </Dialog>

      {/* Submission Confirmation Dialog */}
      <Dialog
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        title="Confirm Examination Submission"
        description="Are you sure you want to finalize this round? You will not be able to modify your answers once submitted."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-center">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">Answered</span>
              <span className="text-base font-bold text-gray-900">{answeredCount}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">Unanswered</span>
              <span className="text-base font-bold text-rose-600">{unansweredCount}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">Marked</span>
              <span className="text-base font-bold text-amber-600">{markedReviewCount}</span>
            </div>
          </div>

          {unansweredCount > 0 && (
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>You have {unansweredCount} unanswered question(s).</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setSubmitModalOpen(false)}
            >
              Continue Working
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
              onClick={handleSubmitExam}
              className="text-xs uppercase tracking-wider font-semibold"
            >
              Confirm Final Submission
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default function ExaminationEnginePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center text-xs text-gray-400">Loading examination engine...</div>}>
      <ExaminationEngineContent />
    </React.Suspense>
  );
}
