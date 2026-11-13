'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog } from '@/components/ui/dialog';
import {
  Plus,
  Save,
  ChevronLeft,
  Layers,
  Trash2,
  ArrowRight,
  AlertTriangle,
  Upload,
  Cpu,
  Sparkles,
  FileText,
  CheckCircle2,
  HelpCircle,
  Shuffle,
  Code2,
  Terminal,
} from 'lucide-react';
import { toast } from 'sonner';
import { Examination, ExaminationRound, SelectionStrategy } from '@/types';

function AdminRoundsConfigContent() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [exam, setExam] = React.useState<Examination | null>(null);
  const [rounds, setRounds] = React.useState<ExaminationRound[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [roundToDelete, setRoundToDelete] = React.useState<ExaminationRound | null>(null);

  // PDF Upload modal state
  const [pdfModalOpen, setPdfModalOpen] = React.useState(false);
  const [selectedRoundForPdf, setSelectedRoundForPdf] = React.useState<ExaminationRound | null>(null);
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = React.useState(false);

  // Populating questions state
  const [populatingRoundId, setPopulatingRoundId] = React.useState<string | null>(null);

  const fetchRounds = async () => {
    try {
      setLoading(true);

      // Check localStorage for user-configured exam and rounds data
      let localExam: any = null;
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`mentneo_exam_${examId}`);
          if (stored) {
            localExam = JSON.parse(stored);
          }
        } catch {}
      }

      const res = await fetch(`/api/examinations/${examId}/rounds`);
      const json = await res.json();
      let roundsList: ExaminationRound[] = [];
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        roundsList = json.data;
      } else if (localExam?.rounds && Array.isArray(localExam.rounds) && localExam.rounds.length > 0) {
        roundsList = localExam.rounds;
      }

      // Enrich with local storage customizations and local question bank counts if present
      if (typeof window !== 'undefined') {
        roundsList = roundsList.map((r) => {
          let poolCount = r.question_pool_count || 0;
          try {
            const qRaw = localStorage.getItem(`mentneo_questions_${r.id}`);
            if (qRaw) {
              const qList = JSON.parse(qRaw);
              if (Array.isArray(qList) && qList.length > 0) {
                poolCount = Math.max(poolCount, qList.length);
              }
            }
          } catch {}

          if (localExam?.rounds && Array.isArray(localExam.rounds)) {
            const matched = localExam.rounds.find(
              (lr: any) => lr.id === r.id || Number(lr.round_number) === Number(r.round_number)
            );
            if (matched) {
              return { ...r, ...matched, question_pool_count: poolCount || matched.question_pool_count || 0 };
            }
          }
          return { ...r, question_pool_count: poolCount };
        });
      }

      // Authoritative count check: if pool count is 0 or undefined, query /api/questions
      const enrichedRounds = await Promise.all(
        roundsList.map(async (r: ExaminationRound) => {
          if (r.question_pool_count && r.question_pool_count > 0) return r;
          try {
            const qRes = await fetch(`/api/questions?roundId=${r.id}`);
            const qJson = await qRes.json();
            if (qJson.success && Array.isArray(qJson.data)) {
              return { ...r, question_pool_count: qJson.data.length };
            }
          } catch {}
          return r;
        })
      );

      setRounds(enrichedRounds);

      const examRes = await fetch(`/api/examinations/${examId}`);
      const examJson = await examRes.json();
      if (examJson.success && examJson.data) {
        setExam(localExam ? { ...examJson.data, name: localExam.name || examJson.data.name } : examJson.data);
      } else if (localExam) {
        setExam(localExam);
      }
    } catch {
      toast.error('Failed to load rounds');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchRounds();
  }, [examId]);

  const handleAddRound = async () => {
    const maxRound = rounds.length > 0 ? Math.max(...rounds.map((r) => r.round_number)) : 0;
    const nextNumber = maxRound + 1;
    const newRound: Partial<ExaminationRound> = {
      round_number: nextNumber,
      name: `Round ${nextNumber}: Specialized Evaluation`,
      duration_minutes: 60,
      total_questions: 30,
      marks_per_question: 2,
      negative_marks: 0.5,
      qualifying_marks: 24,
      question_selection_strategy: 'random',
      status: 'active',
      auto_qualify: true,
      instructions: `Complete all questions for Round ${nextNumber}.`,
    };

    try {
      const res = await fetch(`/api/examinations/${examId}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRound),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Dynamic Round ${nextNumber} added.`);
        fetchRounds();
      }
    } catch {
      toast.error('Failed to add round');
    }
  };

  const handleUpdateRound = async (round: ExaminationRound) => {
    setSaving(true);
    try {
      const payload = {
        ...round,
        duration_minutes: Number(round.duration_minutes) || 15,
        total_questions: Number(round.total_questions) || 30,
        marks_per_question: Number(round.marks_per_question) || 1,
        negative_marks: Number(round.negative_marks) || 0,
        qualifying_marks: Number(round.qualifying_marks) || 15,
        total_marks: (Number(round.total_questions) || 30) * (Number(round.marks_per_question) || 1),
      };
      const res = await fetch(`/api/examinations/${examId}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.data) {
        toast.success(`Saved changes for ${payload.name}`);
        setRounds((prev) => prev.map((r) => (r.id === payload.id ? { ...r, ...data.data } : r)));

        // Persist to local storage so serverless lambdas can never overwrite it
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem(`mentneo_exam_${examId}`);
            if (stored) {
              const parsed = JSON.parse(stored);
              parsed.rounds = (parsed.rounds || []).map((r: any) =>
                r.id === payload.id || r.round_number === payload.round_number ? { ...r, ...payload, ...data.data } : r
              );
              localStorage.setItem(`mentneo_exam_${examId}`, JSON.stringify(parsed));
            }
          } catch {}
        }
      } else {
        toast.error(data.error || 'Failed to update round');
      }
    } catch {
      toast.error('Failed to update round');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!roundToDelete) return;
    if (rounds.length <= 1) {
      toast.error('An examination must have at least one round.');
      setRoundToDelete(null);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/examinations/${examId}/rounds?roundId=${roundToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted ${roundToDelete.name}`);
        setRoundToDelete(null);
        fetchRounds();
      } else {
        toast.error(data.error || 'Failed to delete round');
      }
    } catch {
      toast.error('Network error deleting round');
    } finally {
      setDeleting(false);
    }
  };

  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleFieldChange = (idx: number, field: keyof ExaminationRound, value: any) => {
    setRounds((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };

      // Immediate auto-save to browser local storage so user never loses their changes
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`mentneo_exam_${examId}`);
          const parsed = stored ? JSON.parse(stored) : { id: examId, rounds: [] };
          parsed.rounds = copy;
          localStorage.setItem(`mentneo_exam_${examId}`, JSON.stringify(parsed));
        } catch {}
      }

      // Debounced background sync to serverless API
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        const roundToSave = copy[idx];
        if (roundToSave) {
          fetch(`/api/examinations/${examId}/rounds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roundToSave),
          }).catch(() => {});
        }
      }, 600);

      return copy;
    });
  };

  // Populate 100 questions into round bank
  const handlePopulateQuestions = async (roundId: string) => {
    setPopulatingRoundId(roundId);
    try {
      const res = await fetch(`/api/examinations/${examId}/rounds/populate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, count: 100 }),
      });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`mentneo_questions_${roundId}`, JSON.stringify(data.questions));
              const storedEx = localStorage.getItem(`mentneo_exam_${examId}`);
              if (storedEx) {
                const parsedEx = JSON.parse(storedEx);
                parsedEx.rounds = (parsedEx.rounds || []).map((r: any) =>
                  r.id === roundId ? { ...r, question_pool_count: data.questions.length } : r
                );
                localStorage.setItem(`mentneo_exam_${examId}`, JSON.stringify(parsedEx));
              }
            } catch {}
          }
          setRounds((prev) =>
            prev.map((r) => (r.id === roundId ? { ...r, question_pool_count: data.questions.length } : r))
          );
        }
        toast.success(data.message || 'Question bank populated with 100 questions.');
        fetchRounds();
      } else {
        toast.error(data.error || 'Failed to populate questions.');
      }
    } catch {
      toast.error('Network error while populating question bank.');
    } finally {
      setPopulatingRoundId(null);
    }
  };

  // Upload Question Paper PDF for OCR Extraction
  const handleUploadPdfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoundForPdf || !pdfFile) {
      toast.error('Please choose a PDF file.');
      return;
    }

    setUploadingPdf(true);
    try {
      const targetRoundId = selectedRoundForPdf.id;
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('roundId', targetRoundId);
      formData.append('count', '100');

      const res = await fetch('/api/questions/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`mentneo_questions_${targetRoundId}`, JSON.stringify(data.questions));
              const storedEx = localStorage.getItem(`mentneo_exam_${examId}`);
              if (storedEx) {
                const parsedEx = JSON.parse(storedEx);
                parsedEx.rounds = (parsedEx.rounds || []).map((r: any) =>
                  r.id === targetRoundId ? { ...r, question_pool_count: data.questions.length } : r
                );
                localStorage.setItem(`mentneo_exam_${examId}`, JSON.stringify(parsedEx));
              }
            } catch {}
          }
          setRounds((prev) =>
            prev.map((r) => (r.id === targetRoundId ? { ...r, question_pool_count: data.questions.length } : r))
          );
        }
        toast.success(data.message || 'Question PDF uploaded and questions extracted successfully.');
        setPdfModalOpen(false);
        setPdfFile(null);
        fetchRounds();
        setTimeout(() => {
          fetchRounds();
        }, 1000);
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Network error during PDF upload');
    } finally {
      setUploadingPdf(false);
    }
  };

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
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dynamic Rounds Configuration</h1>
            <p className="mt-1 text-xs text-gray-500">
              Exam: {exam?.name || 'Loading...'} • Multi-stage assessment, question bank sampling, and proctoring.
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleAddRound}
            className="text-xs uppercase tracking-wider font-semibold gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Next Dynamic Round</span>
          </Button>
        </div>

        {/* Dynamic Rounds Cards List */}
        <div className="space-y-6">
          {rounds.map((round, idx) => {
            const poolCount = round.question_pool_count || 0;
            const isRandomStrategy = round.question_selection_strategy === 'random';
            const isSamplingActive = poolCount > round.total_questions;

            return (
              <Card key={`dynamic-round-config-${round.id || idx}-${idx}`}>
                <CardHeader className="bg-gray-50/50 flex flex-row items-center justify-between pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold font-mono">
                      {round.round_number}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{round.name}</h3>
                      <span className="text-[11px] text-gray-500">
                        {round.round_type === 'coding' ? 'Coding Sandbox' : 'MCQ Assessment'} • Strategy: {round.question_selection_strategy}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={round.status === 'active' ? 'success' : 'neutral'} size="sm">
                      {round.status}
                    </Badge>

                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={saving}
                      onClick={() => handleUpdateRound(round)}
                      className="text-xs uppercase tracking-wider font-semibold gap-1 h-7 px-2.5"
                    >
                      <Save className="w-3 h-3" />
                      <span>Save Round</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRoundToDelete(round)}
                      className="text-xs uppercase tracking-wider font-semibold gap-1 h-7 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200"
                    >
                      <Trash2 className="w-3 h-3 text-rose-600" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 pt-5">
                  {/* Question Pool & Problem Management Status Bar */}
                  {round.round_type === 'coding' ? (
                    <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Code2 className="w-4 h-4 text-indigo-700 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-gray-900 block">
                              Coding Sandbox Pool: {poolCount} Coding Problems in Bank
                            </span>
                            <span className="text-[11px] text-gray-500 block">
                              Candidates are served: {round.total_questions} algorithmic problems in interactive sandbox editor (Python 3 & Java)
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            isLoading={populatingRoundId === round.id}
                            onClick={() => handlePopulateQuestions(round.id)}
                            className="text-[11px] h-7 px-2.5 gap-1.5 font-semibold border-indigo-300 text-indigo-700 hover:bg-indigo-100/60"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-600" />
                            <span>Populate Sample Coding Problems</span>
                          </Button>

                          <Link
                            href={`/exam/admin/examinations/${examId}/rounds/${round.id}/questions?action=create`}
                            className="text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-md flex items-center gap-1 shadow-xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Coding Question</span>
                          </Link>

                          <Link
                            href={`/exam/admin/examinations/${examId}/rounds/${round.id}/questions`}
                            className="text-[11px] font-semibold text-gray-700 hover:text-gray-900 px-2.5 py-1 rounded-md border border-gray-200 bg-white flex items-center gap-1"
                          >
                            <span>Manage Round {round.round_number} Coding Bank ({poolCount})</span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                          </Link>
                        </div>
                      </div>

                      {poolCount >= round.total_questions ? (
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong>Coding Sandbox Active:</strong> Bank contains <strong>{poolCount} problems</strong>. Each candidate receives <strong>{round.total_questions} problems</strong> to implement in Python 3 or Java with automated code evaluation.
                          </span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            Bank contains {poolCount} problems (needs {round.total_questions}). Click <strong>Add Coding Question</strong> or <strong>Populate Sample Coding Problems</strong> to add problems for candidates.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Cpu className="w-4 h-4 text-gray-700 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-gray-900 block">
                              Question Bank: {poolCount} Questions in Pool
                            </span>
                            <span className="text-[11px] text-gray-500 block">
                              Candidates are served: {round.total_questions} questions per attempt
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRoundForPdf(round);
                              setPdfModalOpen(true);
                            }}
                            className="text-[11px] h-7 px-2.5 gap-1.5 font-semibold"
                          >
                            <Upload className="w-3 h-3 text-gray-600" />
                            <span>Upload Question PDF</span>
                          </Button>

                          {poolCount < 50 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              isLoading={populatingRoundId === round.id}
                              onClick={() => handlePopulateQuestions(round.id)}
                              className="text-[11px] h-7 px-2.5 gap-1.5 font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            >
                              <Sparkles className="w-3 h-3 text-emerald-600" />
                              <span>Populate 100 Bank</span>
                            </Button>
                          )}

                          <Link
                            href={`/exam/admin/examinations/${examId}/rounds/${round.id}/questions`}
                            className="text-[11px] font-semibold text-gray-700 hover:text-gray-900 px-2 py-1 rounded-sm border border-gray-200 bg-white flex items-center gap-1"
                          >
                            <span>Manage Round {round.round_number} Bank ({poolCount})</span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                          </Link>
                        </div>
                      </div>

                      {/* Random sampling indicator */}
                      {isSamplingActive ? (
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
                          <Shuffle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong>Random Question Sampling Active:</strong> Each candidate receives a unique random subset of <strong>{round.total_questions} questions</strong> drawn from the <strong>{poolCount} questions</strong> in the bank. Question order is randomized per student.
                          </span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            Bank contains {poolCount} questions. Click <strong>Populate 100 Bank</strong> or <strong>Upload Question PDF</strong> so each student can receive a unique random sample of {round.total_questions} questions.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Primary Configuration Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Input
                      label="Round Title"
                      value={round.name}
                      onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                    />

                    <div>
                      <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">
                        Round Assessment Type
                      </label>
                      <select
                        value={round.round_type || 'mcq'}
                        onChange={(e) => handleFieldChange(idx, 'round_type', e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-hidden focus:ring-1 focus:ring-gray-900"
                      >
                        <option value="mcq">MCQ & PDF Question Bank</option>
                        <option value="coding">Algorithmic Coding Sandbox (Python & Java)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">
                        Question Selection Strategy
                      </label>
                      <select
                        value={round.question_selection_strategy || 'random'}
                        onChange={(e) =>
                          handleFieldChange(idx, 'question_selection_strategy', e.target.value as SelectionStrategy)
                        }
                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-hidden focus:ring-1 focus:ring-gray-900"
                      >
                        <option value="random">Random Sample (Unique subset per candidate)</option>
                        <option value="sequential">Sequential (All candidates get same order)</option>
                        <option value="difficulty_balanced">Balanced Random (Easy, Medium, Hard)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">
                        Proctoring & AI Usage Policy
                      </label>
                      <select
                        value={round.allow_tab_switch ? 'open_ai' : 'strict_proctoring'}
                        onChange={(e) =>
                          handleFieldChange(idx, 'allow_tab_switch', e.target.value === 'open_ai')
                        }
                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-hidden focus:ring-1 focus:ring-gray-900"
                      >
                        <option value="strict_proctoring">Strict Anti-Cheating (3 Warnings, No Tab Switch)</option>
                        <option value="open_ai">Open AI & Research Mode (Tab Switching Permitted)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                    <Input
                      label="Duration (Mins)"
                      type="number"
                      value={round.duration_minutes ?? ''}
                      onChange={(e) =>
                        handleFieldChange(idx, 'duration_minutes', e.target.value === '' ? '' : parseInt(e.target.value, 10))
                      }
                    />

                    <Input
                      label="Submit Delay (Mins)"
                      type="number"
                      value={round.min_time_before_submit_minutes ?? ''}
                      onChange={(e) =>
                        handleFieldChange(idx, 'min_time_before_submit_minutes', e.target.value === '' ? '' : parseInt(e.target.value, 10))
                      }
                    />

                    <Input
                      label="Questions per Candidate"
                      type="number"
                      value={round.total_questions ?? ''}
                      onChange={(e) =>
                        handleFieldChange(idx, 'total_questions', e.target.value === '' ? '' : parseInt(e.target.value, 10))
                      }
                    />

                    <Input
                      label="Marks / Correct"
                      type="number"
                      step="0.5"
                      value={round.marks_per_question ?? ''}
                      onChange={(e) =>
                        handleFieldChange(idx, 'marks_per_question', e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                    />

                    <Input
                      label="Negative Marks"
                      type="number"
                      step="0.25"
                      value={round.negative_marks ?? ''}
                      onChange={(e) =>
                        handleFieldChange(idx, 'negative_marks', e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                    />

                    <Input
                      label="Qualifying Marks"
                      type="number"
                      step="0.5"
                      value={round.qualifying_marks ?? ''}
                      onChange={(e) =>
                        handleFieldChange(idx, 'qualifying_marks', e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Custom Success Qualification Message"
                      placeholder="e.g. Congratulations! You have passed the Round 1 qualifications."
                      value={round.success_message || ''}
                      onChange={(e) => handleFieldChange(idx, 'success_message', e.target.value)}
                    />

                    <Input
                      label="Custom Failure Qualification Message"
                      placeholder="e.g. Thank you for applying. You have not passed the basic qualification marks."
                      value={round.failure_message || ''}
                      onChange={(e) => handleFieldChange(idx, 'failure_message', e.target.value)}
                    />
                  </div>

                  <Textarea
                    label="Candidate Instructions"
                    value={round.instructions || ''}
                    onChange={(e) => handleFieldChange(idx, 'instructions', e.target.value)}
                  />

                  <div className="pt-2 flex items-center justify-between text-xs text-gray-600 border-t border-gray-100">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={round.auto_qualify}
                        onChange={(e) => handleFieldChange(idx, 'auto_qualify', e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900"
                      />
                      <span>Automatic Qualification (unlocks next round if score &gt;= {round.qualifying_marks})</span>
                    </label>

                    <span className="text-gray-500 font-mono">
                      Total Marks: {(round.total_questions || 30) * (round.marks_per_question || 2)} pts
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={Boolean(roundToDelete)}
        onClose={() => setRoundToDelete(null)}
        title="Delete Examination Round"
        description="Are you sure you want to permanently remove this round? Any candidate attempts linked to this round will be affected, and subsequent rounds will be automatically re-sequenced."
      >
        <div className="space-y-4 pt-2">
          {roundToDelete && (
            <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-900 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <p className="font-bold">{roundToDelete.name}</p>
                <p className="text-rose-700">Round {roundToDelete.round_number} • {roundToDelete.duration_minutes} minutes</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={() => setRoundToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={deleting}
              onClick={confirmDelete}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Confirm Delete</span>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Upload Question PDF Modal */}
      <Dialog
        isOpen={pdfModalOpen}
        onClose={() => {
          setPdfModalOpen(false);
          setPdfFile(null);
        }}
        title={`Upload Question Paper PDF: ${selectedRoundForPdf?.name}`}
        description="Upload a multi-question PDF. The OCR analysis engine will scan the document, extract question stems, answer options, and populate the round's question pool."
      >
        <form onSubmit={handleUploadPdfSubmit} className="space-y-4 pt-2">
          <div className="p-6 border-2 border-dashed border-gray-300 rounded-xl text-center space-y-3 bg-gray-50/50 hover:border-gray-900 transition-colors">
            <FileText className="w-8 h-8 text-gray-400 mx-auto" />
            <div>
              <label className="text-xs font-semibold text-gray-900 cursor-pointer hover:underline block">
                <span>Select Question Paper PDF</span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-gray-500 mt-1">Supports standard PDF formats up to 25MB.</p>
            </div>
            {pdfFile && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-mono text-gray-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{pdfFile.name} ({(pdfFile.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingPdf}
              onClick={() => {
                setPdfModalOpen(false);
                setPdfFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={uploadingPdf}
              disabled={!pdfFile}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Scan & Extract Questions</span>
            </Button>
          </div>
        </form>
      </Dialog>
    </AdminLayoutWrapper>
  );
}

export default function AdminRoundsConfigPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">Loading rounds configuration...</div>}>
      <AdminRoundsConfigContent />
    </React.Suspense>
  );
}
