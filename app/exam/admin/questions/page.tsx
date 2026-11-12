'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog } from '@/components/ui/dialog';
import {
  Upload,
  Cpu,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Sparkles,
  Layers,
  Shuffle,
  HelpCircle,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { Question, OCRJob, Difficulty, Examination, ExaminationRound } from '@/types';

function AdminQuestionsContent() {
  const searchParams = useSearchParams();
  const initialRoundId = searchParams.get('roundId');

  const [examinations, setExaminations] = React.useState<Examination[]>([]);
  const [selectedExamId, setSelectedExamId] = React.useState<string>('');
  const [selectedRoundId, setSelectedRoundId] = React.useState<string>(initialRoundId || 'all');

  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [ocrJobs, setOcrJobs] = React.useState<OCRJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [difficultyFilter, setDifficultyFilter] = React.useState('all');

  // OCR Upload state
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [targetUploadRoundId, setTargetUploadRoundId] = React.useState<string>('');

  // Manual Question Create/Edit state
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [savingQuestion, setSavingQuestion] = React.useState(false);
  const [editingQuestion, setEditingQuestion] = React.useState<Question | null>(null);
  const [targetCreateRoundId, setTargetCreateRoundId] = React.useState<string>('');

  // Form fields for create/edit
  const [qText, setQText] = React.useState('');
  const [qDifficulty, setQDifficulty] = React.useState<Difficulty>('medium');
  const [qMarks, setQMarks] = React.useState(2);
  const [qNegativeMarks, setQNegativeMarks] = React.useState(0.5);
  const [qOptA, setQOptA] = React.useState('');
  const [qOptB, setQOptB] = React.useState('');
  const [qOptC, setQOptC] = React.useState('');
  const [qOptD, setQOptD] = React.useState('');
  const [qCorrect, setQCorrect] = React.useState('A');

  // Populating questions state
  const [populating, setPopulating] = React.useState(false);

  // Fetch examinations list
  const fetchExaminations = async () => {
    try {
      const res = await fetch('/api/examinations');
      const json = await res.json();
      if (json.success && json.data) {
        setExaminations(json.data);
        if (json.data.length > 0 && !selectedExamId) {
          // If query param roundId exists, find its exam
          if (initialRoundId) {
            for (const ex of json.data) {
              if (ex.rounds?.some((r: ExaminationRound) => r.id === initialRoundId)) {
                setSelectedExamId(ex.id);
                setSelectedRoundId(initialRoundId);
                return;
              }
            }
          }
          setSelectedExamId(json.data[0].id);
        }
      }
    } catch {
      // Ignore
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const qRes = await fetch('/api/questions?isAdmin=true');
      const qJson = await qRes.json();
      if (qJson.success) {
        setQuestions(qJson.data || []);
      }

      const ocrRes = await fetch('/api/questions/upload-pdf');
      const ocrJson = await ocrRes.json();
      if (ocrJson.success) {
        setOcrJobs(ocrJson.data || []);
      }
    } catch {
      toast.error('Failed to load questions and OCR pipeline');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchExaminations();
    fetchData();
  }, []);

  const currentExam = examinations.find((e) => e.id === selectedExamId) || examinations[0];
  const examRounds: ExaminationRound[] = currentExam?.rounds || [];
  const activeRound = examRounds.find((r) => r.id === selectedRoundId);

  // Update target round when selected round changes
  React.useEffect(() => {
    if (selectedRoundId !== 'all') {
      setTargetUploadRoundId(selectedRoundId);
      setTargetCreateRoundId(selectedRoundId);
    } else if (examRounds.length > 0) {
      setTargetUploadRoundId(examRounds[0].id);
      setTargetCreateRoundId(examRounds[0].id);
    }
  }, [selectedRoundId, examRounds]);

  // PDF Upload & OCR trigger
  const handleUploadPDF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please choose a PDF file.');
      return;
    }

    if (!targetUploadRoundId) {
      toast.error('Please select the target examination round for this PDF.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('roundId', targetUploadRoundId);

      const res = await fetch('/api/questions/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to upload PDF');
        return;
      }

      const targetRound = examRounds.find((r) => r.id === targetUploadRoundId);
      toast.success(
        `Question paper PDF uploaded for ${targetRound?.name || 'selected round'}. OCR background pipeline enqueued.`
      );
      setUploadModalOpen(false);
      setSelectedFile(null);

      // Refresh after short simulated processing delay
      setTimeout(() => {
        fetchData();
      }, 3200);
    } catch {
      toast.error('Network error during upload');
    } finally {
      setUploading(false);
    }
  };

  // Open Edit / Create
  const handleOpenCreate = () => {
    setEditingQuestion(null);
    setQText('');
    setQDifficulty('medium');
    setQMarks(2);
    setQNegativeMarks(0.5);
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQCorrect('A');
    if (selectedRoundId !== 'all') {
      setTargetCreateRoundId(selectedRoundId);
    } else if (examRounds.length > 0) {
      setTargetCreateRoundId(examRounds[0].id);
    }
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (q: Question) => {
    setEditingQuestion(q);
    setTargetCreateRoundId(q.round_id || (examRounds[0]?.id ?? ''));
    setQText(q.question_text);
    setQDifficulty(q.difficulty);
    setQMarks(q.marks);
    setQNegativeMarks(q.negative_marks);
    const opts = q.options || [];
    setQOptA(opts.find((o) => o.label === 'A')?.option_text || '');
    setQOptB(opts.find((o) => o.label === 'B')?.option_text || '');
    setQOptC(opts.find((o) => o.label === 'C')?.option_text || '');
    setQOptD(opts.find((o) => o.label === 'D')?.option_text || '');
    setQCorrect(q.correct_option_label || 'A');
    setCreateModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qText.trim() || !qOptA.trim() || !qOptB.trim()) {
      toast.error('Question text and at least options A and B are required.');
      return;
    }

    if (!targetCreateRoundId) {
      toast.error('Please assign this question to an examination round.');
      return;
    }

    setSavingQuestion(true);
    try {
      const payload = {
        id: editingQuestion?.id,
        round_id: targetCreateRoundId,
        question_text: qText.trim(),
        difficulty: qDifficulty,
        marks: Number(qMarks),
        negative_marks: Number(qNegativeMarks),
        correct_option_label: qCorrect,
        status: 'approved',
        options: [
          { label: 'A', option_text: qOptA.trim(), sort_order: 1 },
          { label: 'B', option_text: qOptB.trim(), sort_order: 2 },
          { label: 'C', option_text: qOptC.trim(), sort_order: 3 },
          { label: 'D', option_text: qOptD.trim(), sort_order: 4 },
        ].filter((o) => Boolean(o.option_text)),
      };

      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to save question');
        return;
      }

      toast.success(editingQuestion ? 'Question updated.' : 'Question published to round bank.');
      setCreateModalOpen(false);
      fetchData();
    } catch {
      toast.error('Network error saving question');
    } finally {
      setSavingQuestion(false);
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to remove this question from the bank?')) return;
    try {
      const res = await fetch(`/api/questions?id=${qId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Question removed.');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete question');
      }
    } catch {
      toast.error('Error deleting question');
    }
  };

  // Populate Questions into current round
  const handlePopulateBank = async () => {
    const roundId = selectedRoundId !== 'all' ? selectedRoundId : examRounds[0]?.id;
    if (!roundId) {
      toast.error('Please select an examination round first.');
      return;
    }

    setPopulating(true);
    try {
      const res = await fetch(`/api/examinations/${selectedExamId}/rounds/populate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, count: 50 }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Populated 50 questions into bank.');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to populate questions.');
      }
    } catch {
      toast.error('Network error populating question bank.');
    } finally {
      setPopulating(false);
    }
  };

  // Filter questions based on examination, round, difficulty, search
  const filtered = questions.filter((q) => {
    const qMatches = q.question_text.toLowerCase().includes(search.toLowerCase());
    const dMatches = difficultyFilter === 'all' || q.difficulty === difficultyFilter;
    let roundMatches = true;
    if (selectedRoundId !== 'all') {
      roundMatches = q.round_id === selectedRoundId;
    } else if (selectedExamId && examRounds.length > 0) {
      const examRoundIds = new Set(examRounds.map((r) => r.id));
      roundMatches = Boolean(q.round_id && examRoundIds.has(q.round_id));
    }
    return qMatches && dMatches && roundMatches;
  });

  return (
    <AdminLayoutWrapper>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Question Bank & OCR Pipeline</h1>
            <p className="mt-1 text-xs text-gray-500">
              Upload multi-page question PDFs for OCR extraction, curate MCQs, and configure per-round question pools.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedRoundId !== 'all') setTargetUploadRoundId(selectedRoundId);
                else if (examRounds.length > 0) setTargetUploadRoundId(examRounds[0].id);
                setUploadModalOpen(true);
              }}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Question PDF</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              isLoading={populating}
              onClick={handlePopulateBank}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Populate Bank (50 MCQs)</span>
            </Button>

            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 bg-gray-900 text-white hover:bg-black"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Question</span>
            </Button>
          </div>
        </div>

        {/* Examination & Round Selector Control Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                  Examination
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => {
                    setSelectedExamId(e.target.value);
                    setSelectedRoundId('all');
                  }}
                  className="h-9 px-3 rounded-lg border border-gray-300 text-xs text-gray-900 bg-white font-semibold focus:outline-hidden focus:border-gray-900"
                >
                  {examinations.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                  Assessment Stage / Round
                </label>
                <select
                  value={selectedRoundId}
                  onChange={(e) => setSelectedRoundId(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-300 text-xs text-gray-900 bg-white font-semibold focus:outline-hidden focus:border-gray-900"
                >
                  <option value="all">All Examination Stages</option>
                  {examRounds.map((r) => (
                    <option key={r.id} value={r.id}>
                      Round {r.round_number}: {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stage Summary Pill */}
            {activeRound && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs">
                <Layers className="w-4 h-4 text-gray-600 shrink-0" />
                <div>
                  <span className="font-bold text-gray-900 block">
                    Round {activeRound.round_number}: {activeRound.name}
                  </span>
                  <span className="text-[11px] text-gray-500 block">
                    Bank Pool: <strong>{filtered.length} questions</strong> • Candidate Receives: <strong>{activeRound.total_questions} questions</strong> • Strategy: <strong>{activeRound.question_selection_strategy}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* OCR Background Jobs Monitor */}
        <Card>
          <CardHeader className="bg-gray-50/50 pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-gray-700" />
              <CardTitle className="text-sm">OCR Background Processing Queue</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="h-7 px-2 text-xs text-gray-500 gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sync Status</span>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {ocrJobs.length === 0 ? (
              <p className="p-6 text-xs text-center text-gray-400">No active or historical OCR jobs found.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {ocrJobs.map((job, jIdx) => {
                  const statusVariant = {
                    uploaded: 'info',
                    queued: 'warning',
                    processing: 'warning',
                    completed: 'success',
                    failed: 'danger',
                  }[job.status] as 'info' | 'warning' | 'success' | 'danger';

                  return (
                    <div key={job.id || `job-${jIdx}`} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-gray-900">{job.document_name}</p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            Target: {job.round_name || 'General Bank'} • Job ID: {job.id}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-28 text-right">
                          <span className="text-[11px] font-mono text-gray-500 mr-2">
                            {job.status === 'processing' ? `${job.progress_percent}%` : ''}
                          </span>
                          <Badge variant={statusVariant}>{job.status}</Badge>
                        </div>
                        {job.questions_extracted !== null && (
                          <span className="font-mono text-emerald-700 font-semibold">
                            +{job.questions_extracted} MCQs Extracted
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Question Review & Search Bar */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search questions by text or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-hidden focus:border-gray-900"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white focus:outline-hidden focus:border-gray-900"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
                {filtered.length} Question(s)
              </span>
            </div>
          </div>

          {/* Question Cards List */}
          {loading ? (
            <div className="p-12 text-center text-xs text-gray-400 bg-white rounded-xl border border-gray-200">
              Loading question bank...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200 space-y-3">
              <p>No questions found in this bank.</p>
              <Button size="sm" onClick={handlePopulateBank} className="text-xs gap-1.5 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Populate Bank with 50 MCQs</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((q, index) => {
                const round = examRounds.find((r) => r.id === q.round_id);
                return (
                  <div
                    key={`bank-q-${q.id || index}-${index}`}
                    className="p-5 rounded-xl border border-gray-200 bg-white space-y-3 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-md bg-gray-100 text-gray-700 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 leading-snug">
                            {q.question_text}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {round ? (
                              <span className="px-2 py-0.5 rounded-sm bg-gray-100 text-gray-700 text-[10px] font-semibold">
                                Round {round.round_number}: {round.name}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-sm bg-gray-100 text-gray-500 text-[10px]">
                                General Bank
                              </span>
                            )}
                            <Badge variant={q.difficulty === 'hard' ? 'danger' : q.difficulty === 'medium' ? 'warning' : 'neutral'} size="sm">
                              {q.difficulty}
                            </Badge>
                            <span className="text-[11px] text-gray-400 font-mono">
                              +{q.marks} pts / -{q.negative_marks} pts
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(q)}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <Edit className="w-3 h-3 text-gray-500" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600" />
                        </Button>
                      </div>
                    </div>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                      {q.options?.map((opt, optIndex) => {
                        const isCorrect = opt.label === q.correct_option_label;
                        return (
                          <div
                            key={`bank-q-${q.id || index}-opt-${opt.label || optIndex}-${optIndex}`}
                            className={`p-2.5 rounded-lg border text-xs flex items-center gap-2.5 ${
                              isCorrect
                                ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950 font-medium'
                                : 'border-gray-200 bg-white text-gray-700'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] font-mono shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {opt.label}
                            </span>
                            <span className="flex-1">{opt.option_text}</span>
                            {isCorrect && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* PDF Upload Modal */}
      <Dialog
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload Question Paper PDF for OCR Scanning"
        description="Select the examination stage (Round 1 or Round 2) and upload your question PDF. The OCR analysis engine will scan the document and populate questions directly into that round's bank."
      >
        <form onSubmit={handleUploadPDF} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">
              Target Examination
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => {
                setSelectedExamId(e.target.value);
                const ex = examinations.find((x) => x.id === e.target.value);
                if (ex?.rounds?.[0]) {
                  setTargetUploadRoundId(ex.rounds[0].id);
                }
              }}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-900 font-semibold"
            >
              {examinations.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">
              Target Assessment Stage / Round
            </label>
            <select
              value={targetUploadRoundId}
              onChange={(e) => setTargetUploadRoundId(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-900 font-semibold"
            >
              {examRounds.map((r) => (
                <option key={r.id} value={r.id}>
                  Round {r.round_number}: {r.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Select Round 1 to upload Round 1 questions, or select Round 2 for a different paper.
            </p>
          </div>

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
            <input
              type="file"
              id="pdf-input"
              accept=".pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <label htmlFor="pdf-input" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-xs font-semibold text-gray-800">
                {selectedFile ? selectedFile.name : 'Click to browse or drop Question PDF here'}
              </span>
              <span className="text-[10px] text-gray-400 mt-1">Accepts multi-page PDFs up to 50MB</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => setUploadModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={uploading}
              disabled={!selectedFile}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Start OCR Scan & Extract</span>
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Question Manual Create / Edit Modal */}
      <Dialog
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={editingQuestion ? 'Review & Edit Question' : 'Create New MCQ Question'}
        description="Configure question prompt, answer options, correct key, and target examination round."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">
                Target Examination
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-900 font-semibold"
              >
                {examinations.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">
                Target Round
              </label>
              <select
                value={targetCreateRoundId}
                onChange={(e) => setTargetCreateRoundId(e.target.value)}
                required
                className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-900 font-semibold"
              >
                {examRounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    Round {r.round_number}: {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Textarea
            label="Question Stem / Statement"
            placeholder="Type question prompt..."
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            required
          />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">Difficulty</label>
              <select
                value={qDifficulty}
                onChange={(e) => setQDifficulty(e.target.value as Difficulty)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-900"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <Input
              label="Marks / Correct"
              type="number"
              step="0.5"
              value={qMarks}
              onChange={(e) => setQMarks(parseFloat(e.target.value) || 1)}
              required
            />

            <Input
              label="Negative Marks"
              type="number"
              step="0.25"
              value={qNegativeMarks}
              onChange={(e) => setQNegativeMarks(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
              Options & Answer Key
            </span>

            <Input
              label="Option A"
              placeholder="Text for option A"
              value={qOptA}
              onChange={(e) => setQOptA(e.target.value)}
              required
            />

            <Input
              label="Option B"
              placeholder="Text for option B"
              value={qOptB}
              onChange={(e) => setQOptB(e.target.value)}
              required
            />

            <Input
              label="Option C"
              placeholder="Text for option C"
              value={qOptC}
              onChange={(e) => setQOptC(e.target.value)}
            />

            <Input
              label="Option D"
              placeholder="Text for option D"
              value={qOptD}
              onChange={(e) => setQOptD(e.target.value)}
            />

            <div>
              <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">
                Correct Answer Key
              </label>
              <select
                value={qCorrect}
                onChange={(e) => setQCorrect(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-900 font-bold"
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingQuestion}
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={savingQuestion}
              className="text-xs uppercase tracking-wider font-semibold"
            >
              {editingQuestion ? 'Update Question' : 'Publish Question to Round'}
            </Button>
          </div>
        </form>
      </Dialog>
    </AdminLayoutWrapper>
  );
}

export default function AdminQuestionsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">
          Loading question bank...
        </div>
      }
    >
      <AdminQuestionsContent />
    </React.Suspense>
  );
}
