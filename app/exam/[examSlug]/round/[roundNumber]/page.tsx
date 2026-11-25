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
  CheckCheck,
  Database,
  Maximize2,
  Keyboard,
  Megaphone,
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
import { sounds } from '@/lib/audio/sound-effects';

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
  const [questionSyncMap, setQuestionSyncMap] = React.useState<Record<string, 'local' | 'synced' | 'saving'>>({});
  const [confirmedQuestions, setConfirmedQuestions] = React.useState<Record<string, boolean>>({});
  const [pendingCount, setPendingCount] = React.useState<number>(0);
  const pendingBatchRef = React.useRef<Map<string, QueuedAnswer>>(new Map());
  const seqCounterRef = React.useRef<number>(0);
  const batchTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = React.useRef<boolean>(false);

  // Submission lock countdown (delayed submit)
  const [submitLockRemaining, setSubmitLockRemaining] = React.useState<number>(0);

  // Emergency Proctor Broadcast Banner state (auto-hide after 60s)
  const [emergencyAnnouncement, setEmergencyAnnouncement] = React.useState<string | null>(null);
  const [dismissedBroadcast, setDismissedBroadcast] = React.useState<string | null>(null);
  const [broadcastRemainingSec, setBroadcastRemainingSec] = React.useState<number>(60);

  React.useEffect(() => {
    if (!emergencyAnnouncement) return;
    if (dismissedBroadcast === emergencyAnnouncement) return;

    setBroadcastRemainingSec(60);
    const interval = setInterval(() => {
      setBroadcastRemainingSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setDismissedBroadcast(emergencyAnnouncement);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [emergencyAnnouncement, dismissedBroadcast]);

  // Cheating deterrence state
  const [warningModalOpen, setWarningModalOpen] = React.useState(false);
  const [currentWarning, setCurrentWarning] = React.useState<number>(0);
  const [maxWarnings, setMaxWarnings] = React.useState<number>(3);
  const [violationReason, setViolationReason] = React.useState<string>('');
  const [isTerminated, setIsTerminated] = React.useState(false);
  const [isInFullscreen, setIsInFullscreen] = React.useState(true);
  const [fullscreenPromptOpen, setFullscreenPromptOpen] = React.useState(false);

  // Submission modal state
  const [submitModalOpen, setSubmitModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = React.useState(false);

  // Pre-Round 3 (Coding) Briefing Modal state
  const [briefingModalOpen, setBriefingModalOpen] = React.useState(false);
  const [briefingCountdown, setBriefingCountdown] = React.useState(15);
  const [briefingConfirmed, setBriefingConfirmed] = React.useState(false);

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

        // Instant local cache hydration for zero-lag 0ms question load
        if (typeof window !== 'undefined') {
          try {
            const cachedQs = localStorage.getItem(`cached_questions_${round.id}`);
            if (cachedQs) {
              const parsedQs = JSON.parse(cachedQs);
              if (Array.isArray(parsedQs) && parsedQs.length > 0) {
                setQuestions(parsedQs);
              }
            }
          } catch {}
        }

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
          if (startData.isDisqualified) {
            toast.error(startData.error || 'You have been disqualified from this examination.');
            router.push(`/exam/${slug}/result?disqualified=true`);
            return;
          }
          if (startData.alreadySubmitted && startData.attemptId) {
            toast.error('You have already completed this examination round. Duplicate attempts are prohibited.');
            router.push(`/exam/${slug}/result?attemptId=${startData.attemptId}`);
            return;
          }
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

        // Preload and cache all assigned questions on local device for zero-lag navigation
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`cached_questions_${round.id}`, JSON.stringify(qs));
            localStorage.setItem(`attempt_questions_${att.id}`, JSON.stringify(qs));
            localStorage.setItem(`attempt_answers_${att.id}`, JSON.stringify(savedAns || {}));
          } catch {}
        }

        // WhatsApp double-check sync mapping: mark existing answers as synced
        const initialSyncMap: Record<string, 'local' | 'synced' | 'saving'> = {};
        if (savedAns) {
          Object.keys(savedAns).forEach((qid) => {
            if (savedAns[qid]?.selected_option || savedAns[qid]?.code_snippet) {
              initialSyncMap[qid] = 'synced';
            }
          });
        }
        setQuestionSyncMap(initialSyncMap);

        // Calculate initial submit lock remaining
        const minSubmitMinutes = round.min_time_before_submit_minutes ?? 1;
        const startedTime = new Date(att.started_at).getTime();
        const elapsedSecs = Math.max(0, Math.floor((Date.now() - startedTime) / 1000));
        const lockSecs = Math.max(0, minSubmitMinutes * 60 - elapsedSecs);
        setSubmitLockRemaining(lockSecs);

        if (att.status === 'submitted' || att.status === 'timed_out' || att.status === 'terminated' || secRem <= 0) {
          toast.info('Examination time has expired. Submitting answers...');
          router.push(`/exam/${slug}/result?attemptId=${att.id}`);
          return;
        }

        // Check if candidate previously started this attempt, left, and is now re-joining
        const isAiTabAllowed = round.allow_tab_switch === true;
        if (typeof window !== 'undefined' && !isAiTabAllowed && elapsedSecs > 10) {
          const wasActive = sessionStorage.getItem(`active_session_${att.id}`);
          if (!wasActive) {
            // Student closed browser or navigated away earlier and now rejoined
            sessionStorage.setItem(`active_session_${att.id}`, 'true');
            // Log infraction on server and display warning modal to student
            fetch(`/api/attempts/${att.id}/cheating-event`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                violationType: 'session_rejoined',
                metadata: { elapsedSecs, timestamp: new Date().toISOString() },
              }),
            })
              .then((r) => r.json())
              .then((j) => {
                if (j.success && j.data) {
                  setCurrentWarning(j.data.warningNumber);
                  setMaxWarnings(j.data.maxWarnings);
                  setViolationReason('You previously left the examination session and rejoined. The timer continued running while you were away.');
                  setWarningModalOpen(true);
                  if (j.data.isTerminated) {
                    setIsTerminated(true);
                    setTimeout(() => {
                      router.push(`/exam/${slug}/result?attemptId=${att.id}`);
                    }, 2500);
                  }
                }
              })
              .catch(() => {});
          }
        } else if (typeof window !== 'undefined') {
          sessionStorage.setItem(`active_session_${att.id}`, 'true');
        }

        // Trigger Pre-Round Briefing for Coding rounds (Round 3)
        const isCoding = round.round_type === 'coding' || roundNum === 3;
        if (isCoding && typeof window !== 'undefined') {
          const alreadyDismissed = sessionStorage.getItem(`briefing_acknowledged_${att.id}`);
          if (!alreadyDismissed) {
            setBriefingModalOpen(true);
            setBriefingCountdown(15);
          }
        }
      } catch {
        toast.error('Network initialization failed.');
      } finally {
        setLoading(false);
      }
    }

    initEngine();
  }, [slug, roundNum, router]);

  // Briefing 15-second countdown timer
  React.useEffect(() => {
    if (!briefingModalOpen || briefingCountdown <= 0) return;
    const interval = setInterval(() => {
      setBriefingCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [briefingModalOpen, briefingCountdown]);

  const handleDismissBriefing = () => {
    if (attempt) {
      sessionStorage.setItem(`briefing_acknowledged_${attempt.id}`, 'true');
    }
    setBriefingModalOpen(false);
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
    toast.success('Coding Workspace Active. Best of luck!');
  };

  // 2. Authoritative Timer Countdown & Submit Unlock Timer
  React.useEffect(() => {
    if (loading || !attempt || attempt.status !== 'in_progress') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev === 300) {
          try {
            sounds.playTimerAlert();
            toast.warning('5 minutes remaining in this round.', { duration: 4000 });
          } catch {}
        }
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

    const jitter = Math.floor(Math.random() * 4000);
    const syncInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/attempts/${attempt.id}/status`);
        const json = await res.json();
        if (json.success && json.data) {
          setSecondsRemaining(json.data.secondsRemaining);
          if (json.data.isDisqualified) {
            router.push(`/exam/${slug}/result?disqualified=true`);
            return;
          }
          if (json.data.emergencyAnnouncement) {
            setEmergencyAnnouncement(json.data.emergencyAnnouncement);
          }
          if (json.data.isExpired || json.data.status !== 'in_progress') {
            handleForceAutoSubmit('Examination deadline expired on the server.');
          }
        }
      } catch {
        // Keep running client timer if sync request fails
      }
    }, 15000 + jitter);

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
          try {
            sounds.playInfractionWarning();
          } catch {}

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

    // Check initial fullscreen state
    if (!isAiTabAllowed && typeof document !== 'undefined') {
      const isFs = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsInFullscreen(isFs);
      if (!isFs) {
        setFullscreenPromptOpen(true);
      }
    }

    const handleFullscreenChange = () => {
      if (isAiTabAllowed) return;
      const isFs = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsInFullscreen(isFs);
      if (!isFs) {
        setFullscreenPromptOpen(true);
        reportViolation('fullscreen_exit', 'Candidate exited fullscreen examination mode');
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
        e.key === 'F11' ||
        e.key === 'F12' ||
        e.key === 'PrintScreen' ||
        (!isCopyAllowed && e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 'c' || e.key === 'C'))
      ) {
        e.preventDefault();
        reportViolation('keyboard_shortcut', `Prohibited key combination (${e.key})`);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (!isAiTabAllowed) e.preventDefault();
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [attempt, isTerminated, currentRound, slug, router]);

  const requestExamFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      }
      setIsInFullscreen(true);
      setFullscreenPromptOpen(false);
    } catch {
      toast.error('Fullscreen mode is mandatory. Please click to allow fullscreen.');
    }
  };

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

        // WhatsApp-style status: Mark batch questions as synchronized to cloud
        setQuestionSyncMap((prev) => {
          const next = { ...prev };
          for (const it of itemsToSend) {
            next[it.questionId] = 'synced';
          }
          return next;
        });
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

      // WhatsApp-style: Mark locally saved immediately (0ms)
      setQuestionSyncMap((prev) => ({
        ...prev,
        [questionId]: 'local',
      }));

      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
      batchTimerRef.current = setTimeout(() => {
        flushPendingAnswers();
      }, 800);
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

      if (data.data && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`mentneo_result_${attempt.id}`, JSON.stringify(data.data));
        } catch {}
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

  // MCQ Keyboard Hotkeys listener (Completely silent: zero audio effects)
  React.useEffect(() => {
    // Hotkeys are only active for MCQs (not coding), when an attempt is active, and no dialogs are open
    if (
      isCodingRound ||
      loading ||
      !attempt ||
      isTerminated ||
      warningModalOpen ||
      submitModalOpen ||
      mobilePaletteOpen ||
      fullscreenPromptOpen ||
      briefingModalOpen
    ) {
      return;
    }

    const handleExamKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, contenteditable, or code editor
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('.monaco-editor'))
      ) {
        return;
      }

      // Do not intercept browser shortcuts (Ctrl+..., Alt+..., Meta+...)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const key = e.key;

      // 1. Navigation: Next question [N] or [ArrowRight]
      if (key === 'ArrowRight' || key === 'n' || key === 'N') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
        return;
      }

      // 2. Navigation: Previous question [P] or [ArrowLeft]
      if (key === 'ArrowLeft' || key === 'p' || key === 'P') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      // 3. Mark for Review: [M]
      if (key === 'm' || key === 'M') {
        e.preventDefault();
        handleToggleMarkReview();
        return;
      }

      // 4. Clear Answer: [Delete] or [Backspace]
      if (key === 'Delete' || key === 'Backspace') {
        if (currentAnswer?.selected_option) {
          e.preventDefault();
          handleClearAnswer();
        }
        return;
      }

      // 5. Option Selection: A, B, C, D, ... or 1, 2, 3, 4, ...
      if (currentQuestion && currentQuestion.options && currentQuestion.options.length > 0) {
        const upperKey = key.toUpperCase();
        const numIndex = parseInt(key, 10);

        // Check matching label (e.g. 'A', 'B', 'C', 'D')
        const matchedByLabel = currentQuestion.options.find(
          (opt) => opt.label.toUpperCase() === upperKey
        );
        if (matchedByLabel) {
          e.preventDefault();
          handleSelectOption(matchedByLabel.label);
          return;
        }

        // Check matching number (1..N)
        if (!isNaN(numIndex) && numIndex >= 1 && numIndex <= currentQuestion.options.length) {
          e.preventDefault();
          const targetOpt = currentQuestion.options[numIndex - 1];
          if (targetOpt) {
            handleSelectOption(targetOpt.label);
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleExamKeyDown);
    return () => {
      window.removeEventListener('keydown', handleExamKeyDown);
    };
  }, [
    isCodingRound,
    loading,
    attempt,
    isTerminated,
    warningModalOpen,
    submitModalOpen,
    mobilePaletteOpen,
    fullscreenPromptOpen,
    briefingModalOpen,
    currentIndex,
    questions,
    currentQuestion,
    currentAnswer,
  ]);

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
      <header className="sticky top-0 z-30 w-full border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-[#121026]/95 backdrop-blur-sm shadow-xs">
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Exam & Candidate Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              R{roundNum}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                {exam?.name}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
                {currentRound?.name} {student ? `• ${student.full_name} (${student.roll_number})` : ''}
              </p>
            </div>
          </div>

          {/* Prominent High-Visibility Countdown Timer */}
          <div className="flex items-center gap-2 px-3.5 sm:px-5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 shadow-xs">
            <Clock className={cn("w-4 sm:w-5 h-4 sm:h-5", isLowTime ? "text-rose-600 animate-pulse" : "text-indigo-600 dark:text-indigo-400")} />
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                "font-mono text-base sm:text-xl font-bold tracking-tight",
                isLowTime ? "text-rose-600 animate-pulse" : "text-gray-900 dark:text-white"
              )}>
                {formatTimeRemaining(secondsRemaining)}
              </span>
              <span className="hidden sm:inline text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                remaining
              </span>
            </div>
          </div>

          {/* Quick status count and Submit button */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <span>{answeredCount} / {questions.length} answered</span>
            </span>

            {/* Mobile palette toggle */}
            <button
              onClick={() => setMobilePaletteOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              aria-label="Open question palette"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Submit Button */}
            <Button
              variant={isSubmitLocked ? 'outline' : 'primary'}
              size="sm"
              disabled={isSubmitLocked}
              onClick={() => setSubmitModalOpen(true)}
              className="text-xs font-semibold uppercase tracking-wider gap-1.5 h-10 px-4"
            >
              {isSubmitLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
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

        {/* Top Progress bar */}
        <div className="w-full h-1 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-1 bg-indigo-600 transition-all duration-300"
            style={{ width: `${(answeredCount / Math.max(1, questions.length)) * 100}%` }}
          />
        </div>
      </header>

      {/* Proctor Emergency Announcement Banner with 60s Auto-Hide */}
      {emergencyAnnouncement && dismissedBroadcast !== emergencyAnnouncement && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-amber-950 dark:text-amber-200 text-xs font-semibold shadow-xs z-20">
          <div className="max-w-6xl mx-auto flex items-center justify-center gap-2.5 flex-1 text-center">
            <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-bounce" />
            <span>PROCTOR ALERT: {emergencyAnnouncement}</span>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-900 dark:text-amber-300 font-mono">
              Auto-hiding in {broadcastRemainingSec}s
            </span>
          </div>
          <button
            onClick={() => setDismissedBroadcast(emergencyAnnouncement)}
            className="p-1 hover:bg-amber-500/20 rounded text-amber-800 dark:text-amber-300 hover:text-amber-950 ml-2"
            title="Dismiss alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Resilient Network Offline Reassurance Banner */}
      {syncStatus === 'offline' && (
        <div className="bg-amber-500/10 border-b border-amber-300 px-4 py-3 text-xs text-amber-950">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse shrink-0" />
              <div>
                <p className="font-bold text-amber-950">
                  Local Offline Buffer Active ({pendingCount} pending updates queued)
                </p>
                <p className="text-[11px] text-amber-800">
                  Network instability detected. Do not panic: your code and answers are safely cached on this device (0ms latency) and will auto-sync with the server the instant connection stabilizes.
                </p>
              </div>
            </div>
            <button
              onClick={() => flushPendingAnswers()}
              className="text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 bg-amber-200 text-amber-900 rounded border border-amber-300 hover:bg-amber-300 transition-colors shrink-0"
            >
              Retry Sync Now
            </button>
          </div>
        </div>
      )}

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

      {/* Main Spacious Full-Width Workspace */}
      <div className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* MAIN WORKSPACE: SPACIOUS QUESTION CARD                    */}
        {/* ========================================================= */}
        <main className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 flex flex-col bg-white dark:bg-[#15132d] border border-[#e6e3f8] dark:border-[#2c2854] rounded-2xl p-6 sm:p-8 md:p-10 shadow-[0_4px_24px_rgba(184,179,255,0.08)] min-h-[580px]">
          {currentQuestion ? (
            isCodingRound ? (
              /* Coding Sandbox Interface */
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-4">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[#1d1a4a] dark:text-[#b8b3ff]" />
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#1d1a4a] dark:bg-[#b8b3ff] text-white dark:text-[#0d0c1d]">
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
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e6e3f8] dark:border-[#2c2854] mb-6">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold font-mono px-3 py-1 rounded-lg bg-[#1d1a4a] dark:bg-[#b8b3ff] text-white dark:text-[#0d0c1d] shadow-xs">
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                    <Badge variant="neutral">{currentQuestion.difficulty}</Badge>
                    <span className="text-xs text-[#554e80] dark:text-[#a8a1dc] font-mono">
                      +{currentQuestion.marks} / -{currentQuestion.negative_marks} marks
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleMarkReview}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                        currentAnswer?.is_marked_for_review
                          ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                          : 'border-[#e6e3f8] dark:border-[#2c2854] text-[#554e80] dark:text-[#a8a1dc] hover:bg-[#f0effe] dark:hover:bg-[#232049]'
                      )}
                    >
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      <span>{currentAnswer?.is_marked_for_review ? 'Marked for Review' : 'Mark for Review'}</span>
                      <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[9px] font-mono">M</kbd>
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <div className="text-lg sm:text-xl font-medium text-[#1d1a4a] dark:text-[#f4f3ff] leading-relaxed">
                  {currentQuestion.question_text}
                </div>

                {/* Options List */}
                <div className="mt-8 space-y-3.5 flex-1" role="radiogroup" aria-label="Question choices">
                  {(currentQuestion.options || []).map((opt) => {
                    const isSelected = currentAnswer?.selected_option === opt.label;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleSelectOption(opt.label)}
                        className={cn(
                          'w-full flex items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer group relative',
                          isSelected
                            ? 'border-[#1d1a4a] dark:border-[#b8b3ff] bg-[#1d1a4a] dark:bg-[#b8b3ff] text-white dark:text-[#0d0c1d] shadow-[0_8px_24px_rgba(29,26,74,0.18)] dark:shadow-[0_8px_24px_rgba(184,179,255,0.22)] -translate-y-0.5'
                            : 'border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] text-[#1d1a4a] dark:text-[#f4f3ff] hover:border-[#b8b3ff] hover:bg-[#faf9fe] dark:hover:bg-[#1c193b] hover:shadow-[0_4px_16px_rgba(184,179,255,0.12)] hover:-translate-y-0.5'
                        )}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <span
                            className={cn(
                              'w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black font-mono shrink-0 transition-colors shadow-xs',
                              isSelected
                                ? 'bg-[#b8b3ff] dark:bg-[#1d1a4a] text-[#1d1a4a] dark:text-[#f4f3ff]'
                                : 'border border-[#d5d0f5] dark:border-[#3a3568] bg-[#f5f4ff] dark:bg-[#1d1a42] text-[#1d1a4a] dark:text-[#b8b3ff] group-hover:border-[#b8b3ff] group-hover:bg-[#ebe8ff]'
                            )}
                          >
                            {opt.label}
                          </span>
                          <span
                            className={cn(
                              'text-base sm:text-lg font-medium leading-relaxed',
                              isSelected
                                ? 'text-white dark:text-[#0d0c1d] font-semibold'
                                : 'text-[#1d1a4a] dark:text-[#e4e2fd]'
                            )}
                          >
                            {opt.option_text}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="shrink-0 flex items-center">
                            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Keyboard Hotkey Cheatsheet banner strip */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#f8f7fe] dark:bg-[#171533] border border-[#e6e3f8] dark:border-[#2c2854] text-[11px] text-[#554e80] dark:text-[#a8a1dc]">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Keyboard className="w-3.5 h-3.5 text-[#6355d8] shrink-0" />
                    <span className="font-semibold text-[#1d1a4a] dark:text-[#e4e2fd]">Keyboard Shortcuts:</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#232049] border border-[#d5d0f5] dark:border-[#383366] font-mono text-[10px] font-bold text-[#1d1a4a] dark:text-[#d6d2fc]">A</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#232049] border border-[#d5d0f5] dark:border-[#383366] font-mono text-[10px] font-bold text-[#1d1a4a] dark:text-[#d6d2fc]">B</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#232049] border border-[#d5d0f5] dark:border-[#383366] font-mono text-[10px] font-bold text-[#1d1a4a] dark:text-[#d6d2fc]">C</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#232049] border border-[#d5d0f5] dark:border-[#383366] font-mono text-[10px] font-bold text-[#1d1a4a] dark:text-[#d6d2fc]">D</kbd>
                    <span className="text-[#8881b8] dark:text-[#7d76b1]">to select</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-[#7871a8] dark:text-[#a59ed8]">
                    <span>[P/←] Prev</span>
                    <span>•</span>
                    <span>[N/→] Next</span>
                    <span>•</span>
                    <span>[M] Mark</span>
                    <span>•</span>
                    <span>[Del] Clear</span>
                  </div>
                </div>

                {/* Bottom Navigation */}
                <div className="mt-6 pt-6 border-t border-[#e6e3f8] dark:border-[#2c2854] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAnswer}
                      disabled={!currentAnswer?.selected_option}
                      className="text-xs text-[#554e80] dark:text-[#a8a1dc] hover:text-[#1d1a4a] dark:hover:text-white hover:bg-[#f0effe] dark:hover:bg-[#232049] gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear Response</span>
                      <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[9px] font-mono">Del</kbd>
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="md"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((prev) => prev - 1)}
                      className="gap-1.5 border-[#e6e3f8] dark:border-[#2c2854] text-[#1d1a4a] dark:text-[#e4e2fd] hover:bg-[#f0effe] dark:hover:bg-[#232049] px-5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous</span>
                      <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-[#f0effe] dark:bg-[#232049] text-[9px] font-mono border border-[#d5d0f5] dark:border-[#383366]">P</kbd>
                    </Button>

                    <Button
                      variant="primary"
                      size="md"
                      disabled={currentIndex === questions.length - 1}
                      onClick={() => setCurrentIndex((prev) => prev + 1)}
                      className="gap-1.5 bg-[#1d1a4a] hover:bg-[#2d2870] dark:bg-[#b8b3ff] dark:hover:bg-[#cfcbff] text-white dark:text-[#0d0c1d] font-semibold shadow-[0_2px_8px_rgba(29,26,74,0.16)] px-6"
                    >
                      <span>Next</span>
                      <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-white/20 dark:bg-black/20 text-[9px] font-mono">N</kbd>
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
        {/* RIGHT COLUMN: PALETTE & STATUS (SPACIOUS, NO CRAMPING)    */}
        {/* ========================================================= */}
        <aside className="hidden lg:flex lg:col-span-4 xl:col-span-4 2xl:col-span-3 flex-col gap-4 sticky top-20">
          <Card className="p-5 border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] shadow-[0_4px_24px_rgba(184,179,255,0.08)] space-y-4">
            {/* Top Pass Criteria & Candidate Info */}
            <div className="pb-3 border-b border-[#e6e3f8] dark:border-[#2c2854] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#1d1a4a] dark:text-[#f4f3ff]">Pass Criteria</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {currentRound?.qualifying_marks} / {currentRound?.total_marks} marks
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#706b9b] dark:text-[#a4a0c8]">
                <span>Candidate</span>
                <span className="truncate max-w-[140px] font-medium text-gray-700 dark:text-gray-300">
                  {student?.full_name || 'Candidate'}
                </span>
              </div>
            </div>

            {/* Questions Progress Breakdown */}
            <div>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="font-bold uppercase tracking-wider text-[#7871a8] dark:text-[#a59ed8] text-[10px]">
                  Progress
                </span>
                <span className="font-mono font-bold text-[#1d1a4a] dark:text-[#f4f3ff]">
                  {answeredCount} / {questions.length} answered
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#f0effe] dark:bg-[#201d40] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#1d1a4a] dark:bg-[#b8b3ff] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(answeredCount / Math.max(1, questions.length)) * 100}%` }}
                />
              </div>

              {/* Breakdown Status Pills */}
              <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] uppercase text-emerald-700 dark:text-emerald-300 block font-semibold">Done</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">{answeredCount}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                  <span className="text-[10px] uppercase text-rose-600 dark:text-rose-400 block font-semibold">Left</span>
                  <span className="font-bold text-rose-700 dark:text-rose-300">{unansweredCount}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] uppercase text-amber-600 dark:text-amber-400 block font-semibold">Review</span>
                  <span className="font-bold text-amber-700 dark:text-amber-300">{markedReviewCount}</span>
                </div>
              </div>
            </div>

            {/* Question Palette Grid - Full Visibility without Cramped Box */}
            <div className="pt-3 border-t border-[#e6e3f8] dark:border-[#2c2854]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1d1a4a] dark:text-[#f4f3ff]">
                  Question Palette
                </h3>
                <span className="text-[11px] font-mono text-gray-400">
                  {questions.length} Questions
                </span>
              </div>

              <div className="grid grid-cols-6 xl:grid-cols-6 2xl:grid-cols-8 gap-2 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const ans = answers[q.id];
                  const isAnswered = Boolean(ans?.selected_option || (ans?.code_snippet && ans.code_snippet.trim().length > 10));
                  const isMarked = Boolean(ans?.is_marked_for_review);
                  const isCurrent = idx === currentIndex;

                  let btnStyle = 'border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] text-[#1d1a4a] dark:text-[#f4f3ff] hover:border-[#b8b3ff]';
                  if (isMarked) {
                    btnStyle = 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold';
                  } else if (isAnswered) {
                    btnStyle = 'border-[#1d1a4a] dark:border-[#b8b3ff] bg-[#1d1a4a] dark:bg-[#b8b3ff] text-white dark:text-[#0d0c1d] font-bold shadow-xs';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={cn(
                        'relative h-10 rounded-lg border text-xs font-mono transition-all flex items-center justify-center cursor-pointer',
                        btnStyle,
                        isCurrent && 'ring-2 ring-[#6355d8] dark:ring-[#b8b3ff] ring-offset-2 font-black scale-105 z-10'
                      )}
                    >
                      <span>{idx + 1}</span>
                      {isAnswered && !isMarked && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      )}
                      {isMarked && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Clean Legend */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#e6e3f8] dark:border-[#2c2854] text-[10px] text-[#706b9b] dark:text-[#a4a0c8]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#1d1a4a] dark:bg-[#b8b3ff]" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                  <span>Review</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm border border-gray-300 bg-white" />
                  <span>Unanswered</span>
                </div>
              </div>
            </div>

            {/* Submit Action at Bottom of Sidebar */}
            <div className="pt-2">
              <Button
                variant={isSubmitLocked ? 'outline' : 'primary'}
                size="md"
                disabled={isSubmitLocked}
                onClick={() => setSubmitModalOpen(true)}
                className="w-full text-xs font-bold uppercase tracking-wider h-11"
              >
                {isSubmitLocked ? (
                  <span>Unlocks in {formatTimeRemaining(submitLockRemaining)}</span>
                ) : (
                  <span>Submit Round</span>
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
            <div className="grid grid-cols-6 gap-2 my-6 overflow-y-auto max-h-[60vh]">
              {questions.map((q, idx) => {
                const ans = answers[q.id];
                const isAnswered = Boolean(ans?.selected_option || (ans?.code_snippet && ans.code_snippet.trim().length > 10));
                const isMarked = Boolean(ans?.is_marked_for_review);
                const isCurrent = idx === currentIndex;

                let btnStyle = 'border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] text-[#1d1a4a] dark:text-[#f4f3ff]';
                if (isMarked) {
                  btnStyle = 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold';
                } else if (isAnswered) {
                  btnStyle = 'border-[#1d1a4a] dark:border-[#b8b3ff] bg-[#1d1a4a] dark:bg-[#b8b3ff] text-white dark:text-[#0d0c1d] font-bold shadow-xs';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setMobilePaletteOpen(false);
                    }}
                    className={cn(
                      'relative h-11 rounded-lg border text-xs font-mono flex items-center justify-center cursor-pointer',
                      btnStyle,
                      isCurrent && 'ring-2 ring-[#6355d8] dark:ring-[#b8b3ff] font-bold'
                    )}
                  >
                    <span>{idx + 1}</span>
                    {isAnswered && !isMarked && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                    {isMarked && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
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

      {/* Pre-Round 3 (Coding) Briefing & AI Usage Protocol Modal */}
      <Dialog
        isOpen={briefingModalOpen}
        onClose={() => {
          if (briefingCountdown === 0 && briefingConfirmed) {
            handleDismissBriefing();
          }
        }}
        title="Round 3 Briefing: Advanced Coding Sandbox Protocol"
        description="Please review the rules, external AI assistance guidelines, and sandbox requirements before starting."
      >
        <div className="space-y-5">
          {/* Circular Countdown Progress Badge */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 text-white border border-slate-800">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 font-mono">
                Mandatory Briefing Review
              </span>
              <h4 className="text-sm font-semibold">Carefully Read Round Guidelines</h4>
              <p className="text-xs text-slate-300">
                {briefingCountdown > 0
                  ? `Sandbox unlocks automatically once reading timer concludes (${briefingCountdown}s left)`
                  : 'Reading timer complete. Confirm acknowledgment below to enter sandbox.'}
              </p>
            </div>

            {/* Circular SVG Timer */}
            <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  className="text-slate-700"
                  fill="transparent"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  className="text-emerald-400 transition-all duration-1000 ease-linear"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 24}
                  strokeDashoffset={((15 - briefingCountdown) / 15) * (2 * Math.PI * 24)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute font-mono font-bold text-xs text-white">
                {briefingCountdown > 0 ? `${briefingCountdown}s` : 'DONE'}
              </span>
            </div>
          </div>

          {/* Three Key Guidance Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-950 space-y-1 sm:col-span-2">
              <div className="flex items-center gap-2 font-bold text-sky-900">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>AI & External Research Explicitly Permitted</span>
              </div>
              <p className="text-[11px] text-sky-800 leading-relaxed">
                You are encouraged to use modern developer tools: ChatGPT, Claude, Gemini, documentation, and web references. You may freely switch tabs; no cheating warnings or proctor strikes will occur in this round.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <FileCode className="w-4 h-4 text-slate-700" />
                <span>5 Languages Supported</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Switch seamlessly between Python 3.12, Java 21, C (C11), C++ (C++17), and JavaScript (Node.js 20) with pre-configured templates.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Database className="w-4 h-4 text-slate-700" />
                <span>Offline-Resilient Sandbox</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Every keystroke is written directly to device storage. Even in the event of campus Wi-Fi dropouts, your work remains 100% intact.
              </p>
            </div>
          </div>

          {/* Explicit Acknowledgment Checkbox */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-gray-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={briefingConfirmed}
              onChange={(e) => setBriefingConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-900"
            />
            <div className="text-xs text-gray-700 leading-snug">
              <span className="font-semibold text-gray-900 block">
                I have read and understood the assessment environment rules
              </span>
              <span>
                I understand that external research/AI is allowed, my code is saved automatically, and I am ready to enter the workspace.
              </span>
            </div>
          </label>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              size="md"
              disabled={briefingCountdown > 0 || !briefingConfirmed}
              onClick={handleDismissBriefing}
              className="w-full text-xs uppercase tracking-wider font-semibold h-11"
            >
              {briefingCountdown > 0
                ? `Reviewing Briefing (${briefingCountdown}s remaining)...`
                : !briefingConfirmed
                ? 'Check Acknowledgment Box Above to Begin'
                : 'Enter Coding Sandbox'}
            </Button>
          </div>
        </div>
      </Dialog>

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

      {/* Strict Fullscreen Mode Mandatory Overlay */}
      {fullscreenPromptOpen && !isAiAllowed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 select-none">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-rose-600 font-mono">
                Strict Proctoring Protocol Active
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Fullscreen Mode Required
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                To prevent unauthorized application switching and ensure academic integrity, this examination must remain in Fullscreen Mode. Exiting fullscreen logs an automated cheating infraction.
              </p>
            </div>

            <div className="py-2.5 px-3.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs font-mono text-slate-700 flex justify-between items-center">
              <span>Candidate: {student?.full_name || 'Registered'}</span>
              <span className="font-bold text-rose-600">
                Warnings: {currentWarning} / {maxWarnings}
              </span>
            </div>

            <Button
              onClick={requestExamFullscreen}
              className="w-full h-11 text-xs font-semibold uppercase tracking-wider font-mono gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Enter Fullscreen & Resume Examination</span>
            </Button>
          </div>
        </div>
      )}
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
