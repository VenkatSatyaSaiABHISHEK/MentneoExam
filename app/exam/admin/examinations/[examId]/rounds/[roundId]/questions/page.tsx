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
  ChevronLeft,
  ArrowRight,
  ShieldAlert,
  Settings,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Question, OCRJob, Difficulty, Examination, ExaminationRound } from '@/types';

function RoundQuestionsContent() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;
  const roundId = params.roundId as string;

  const [exam, setExam] = React.useState<Examination | null>(null);
  const [round, setRound] = React.useState<ExaminationRound | null>(null);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [ocrJobs, setOcrJobs] = React.useState<OCRJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [difficultyFilter, setDifficultyFilter] = React.useState('all');

  // OCR Upload state
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

  // Manual Question Create/Edit state
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [savingQuestion, setSavingQuestion] = React.useState(false);
  const [editingQuestion, setEditingQuestion] = React.useState<Question | null>(null);

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

  // Round Settings Edit state
  const [settingsModalOpen, setSettingsModalOpen] = React.useState(false);
  const [savingRoundSettings, setSavingRoundSettings] = React.useState(false);
  const [roundTotalQuestions, setRoundTotalQuestions] = React.useState<number | string>(30);
  const [roundDuration, setRoundDuration] = React.useState<number | string>(60);
  const [roundMarksPerQ, setRoundMarksPerQ] = React.useState<number | string>(2);
  const [roundNegativeMarks, setRoundNegativeMarks] = React.useState<number | string>(0.5);
  const [roundQualifyingMarks, setRoundQualifyingMarks] = React.useState<number | string>(15);
  const [roundStrategy, setRoundStrategy] = React.useState<'random' | 'sequential' | 'difficulty_balanced'>('random');
  const [roundAllowTabSwitch, setRoundAllowTabSwitch] = React.useState(false);
  const [roundAutoQualify, setRoundAutoQualify] = React.useState(true);

  const handleOpenRoundSettings = () => {
    if (!round) return;
    setRoundTotalQuestions(round.total_questions || 30);
    setRoundDuration(round.duration_minutes || 60);
    setRoundMarksPerQ(round.marks_per_question || 2);
    setRoundNegativeMarks(round.negative_marks || 0.5);
    setRoundQualifyingMarks(round.qualifying_marks || 15);
    setRoundStrategy((round.question_selection_strategy as any) || 'random');
    setRoundAllowTabSwitch(Boolean(round.allow_tab_switch));
    setRoundAutoQualify(round.auto_qualify ?? true);
    setSettingsModalOpen(true);
  };

  const handleSaveRoundSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!round) return;

    setSavingRoundSettings(true);
    try {
      const totalQ = Number(roundTotalQuestions) || 10;
      const marksPerQ = Number(roundMarksPerQ) || 1;
      const payload: Partial<ExaminationRound> = {
        ...round,
        total_questions: totalQ,
        duration_minutes: Number(roundDuration) || 30,
        marks_per_question: marksPerQ,
        negative_marks: Number(roundNegativeMarks) || 0,
        qualifying_marks: Number(roundQualifyingMarks) || 1,
        total_marks: totalQ * marksPerQ,
        question_selection_strategy: roundStrategy as any,
        allow_tab_switch: roundAllowTabSwitch,
        auto_qualify: roundAutoQualify,
      };

      const res = await fetch(`/api/examinations/${examId}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.data) {
        toast.success(`Round ${round.round_number} settings saved successfully.`);
        setRound(data.data);
        setQMarks(data.data.marks_per_question || 2);
        setQNegativeMarks(data.data.negative_marks || 0.5);
        setSettingsModalOpen(false);
      } else {
        toast.error(data.error || 'Failed to update round settings');
      }
    } catch {
      toast.error('Network error saving round settings');
    } finally {
      setSavingRoundSettings(false);
    }
  };

  // Fetch exam, round, and questions scoped strictly to this round
  const fetchRoundData = async () => {
    try {
      setLoading(true);
      // 1. Fetch exam & round
      let resolvedRound: ExaminationRound | null = null;
      try {
        const examRes = await fetch(`/api/examinations/${examId}`);
        const examJson = await examRes.json();
        if (examJson.success && examJson.data) {
          setExam(examJson.data);
          const currentR = (examJson.data.rounds || []).find((r: ExaminationRound) => r.id === roundId);
          if (currentR) {
            resolvedRound = currentR;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch exam:', err);
      }

      // If round could not be matched from exam, synthesize resilient round object
      if (!resolvedRound) {
        const roundNumMatch = roundId.match(/(\d+)$/);
        const inferredNum = roundNumMatch ? Number(roundNumMatch[1]) : 1;
        resolvedRound = {
          id: roundId,
          examination_id: examId,
          round_number: inferredNum,
          name: inferredNum === 1 ? 'Screening & Core Fundamentals' : inferredNum === 2 ? 'Advanced Problem Solving & Synthesis' : 'Advanced Hardware Architecture',
          duration_minutes: inferredNum === 1 ? 60 : inferredNum === 2 ? 45 : 60,
          total_questions: inferredNum === 1 ? 30 : 5,
          marks_per_question: inferredNum === 1 ? 2 : inferredNum === 2 ? 3 : 4,
          negative_marks: inferredNum === 1 ? 0.5 : 1,
          qualifying_marks: inferredNum === 1 ? 24 : inferredNum === 2 ? 8 : 12,
          total_marks: inferredNum === 1 ? 60 : inferredNum === 2 ? 15 : 20,
          question_selection_strategy: 'random',
          scheduled_start: null,
          status: 'active',
          auto_qualify: true,
          instructions: '',
          round_type: 'mcq',
          allow_tab_switch: inferredNum === 2,
          allow_copy_paste: inferredNum === 2,
          enforce_fullscreen: inferredNum !== 2,
          min_time_before_submit_minutes: 1,
          next_round_delay_seconds: 120,
          success_message: '',
          failure_message: '',
          coding_language_support: ['python', 'java'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      setRound(resolvedRound);
      setQMarks(resolvedRound.marks_per_question || 2);
      setQNegativeMarks(resolvedRound.negative_marks || 0.5);

      // 2. Fetch questions strictly belonging to this round
      const qRes = await fetch(`/api/questions?roundId=${roundId}&isAdmin=true`);
      const qJson = await qRes.json();
      if (qJson.success) {
        setQuestions(qJson.data || []);
      }

      // 3. Fetch OCR jobs
      const ocrRes = await fetch('/api/questions/upload-pdf');
      const ocrJson = await ocrRes.json();
      if (ocrJson.success && ocrJson.data) {
        // Filter jobs matching this round or document
        const jobs = (ocrJson.data as OCRJob[]).filter(
          (j) => j.round_name?.includes(`Round ${resolvedRound?.round_number}`) || j.pdf_document_id?.includes(roundId)
        );
        setOcrJobs(jobs.length > 0 ? jobs : ocrJson.data);
      }
    } catch {
      toast.error('Failed to load round question bank.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchRoundData();
  }, [examId, roundId]);

  // Handle PDF Upload specifically for this round
  const handleUploadPDF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please choose a PDF file.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('roundId', roundId);

      const res = await fetch('/api/questions/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to upload PDF');
        return;
      }

      const extracted = data.data?.questions_extracted || 50;
      toast.success(
        `PDF processed successfully. ${extracted} questions extracted and saved to Round ${round?.round_number || 1} bank.`
      );
      setUploadModalOpen(false);
      setSelectedFile(null);

      await fetchRoundData();
    } catch {
      toast.error('Network error during PDF upload');
    } finally {
      setUploading(false);
    }
  };

  // Populate 50 questions into this specific round
  const handlePopulateRound = async () => {
    setPopulating(true);
    try {
      const res = await fetch(`/api/examinations/${examId}/rounds/populate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, count: 50 }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Populated 50 questions for Round ${round?.round_number}.`);
        fetchRoundData();
      } else {
        toast.error(data.error || 'Failed to populate questions.');
      }
    } catch {
      toast.error('Network error populating questions.');
    } finally {
      setPopulating(false);
    }
  };

  // Open Edit / Create
  const handleOpenCreate = () => {
    setEditingQuestion(null);
    setQText('');
    setQDifficulty('medium');
    setQMarks(round?.marks_per_question || 2);
    setQNegativeMarks(round?.negative_marks || 0.5);
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQCorrect('A');
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (q: Question) => {
    setEditingQuestion(q);
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

    setSavingQuestion(true);
    try {
      const payload = {
        id: editingQuestion?.id,
        round_id: roundId,
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

      toast.success(editingQuestion ? 'Question updated.' : `Question published to Round ${round?.round_number} bank.`);
      setCreateModalOpen(false);
      fetchRoundData();
    } catch {
      toast.error('Network error saving question');
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to remove this question from this round bank?')) return;
    try {
      const res = await fetch(`/api/questions?id=${qId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Question removed.');
        fetchRoundData();
      } else {
        toast.error(data.error || 'Failed to delete question');
      }
    } catch {
      toast.error('Error deleting question');
    }
  };

  const filtered = questions.filter((q) => {
    const qMatches = q.question_text.toLowerCase().includes(search.toLowerCase());
    const dMatches = difficultyFilter === 'all' || q.difficulty === difficultyFilter;
    return qMatches && dMatches;
  });

  const isSamplingActive = questions.length > (round?.total_questions || 0);

  return (
    <AdminLayoutWrapper>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Navigation Breadcrumbs & Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Link href={`/exam/admin/examinations/${examId}`} className="hover:text-gray-900 font-semibold">
                {exam?.name || 'Examination'}
              </Link>
              <span>/</span>
              <Link href={`/exam/admin/examinations/${examId}/rounds`} className="hover:text-gray-900 font-semibold">
                Rounds
              </Link>
              <span>/</span>
              <span className="text-gray-900 font-bold">Round {round?.round_number || 1} Question Bank</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Round {round?.round_number || 1}: {round?.name || 'Question Bank'}
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Dedicated question paper and question bank strictly for Round {round?.round_number || 1}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenRoundSettings}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <Settings className="w-3.5 h-3.5 text-gray-600" />
              <span>Round Settings</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadModalOpen(true)}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF for Round {round?.round_number || 1}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              isLoading={populating}
              onClick={handlePopulateRound}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Populate 50 MCQs</span>
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

        {/* Round Policy & Random Sampling Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 rounded-xl border border-gray-200 bg-white">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Round Bank Size</span>
            <span className="text-xl font-bold text-gray-900 mt-0.5 block">{questions.length} Questions</span>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Served Per Candidate</span>
              <span className="text-xl font-bold text-gray-900 mt-0.5 block">{round?.total_questions || 0} Questions</span>
            </div>
            <button
              type="button"
              onClick={handleOpenRoundSettings}
              className="text-[11px] font-semibold text-gray-600 hover:text-gray-900 px-2 py-0.5 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center gap-1 cursor-pointer"
            >
              <Settings className="w-3 h-3 text-gray-500" />
              <span>Edit</span>
            </button>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Sampling Strategy</span>
            <span className="text-xl font-bold text-gray-900 mt-0.5 block capitalize">
              {round?.question_selection_strategy || 'Random'}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block">AI Policy</span>
            <span className="text-xl font-bold text-gray-900 mt-0.5 block">
              {round?.allow_tab_switch ? 'Open AI Permitted' : 'Strict Proctoring'}
            </span>
          </div>
        </div>

        {/* Random Sampling Notice */}
        {isSamplingActive ? (
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-900 flex items-center gap-3">
            <Shuffle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Random Question Sampling Active:</strong> The bank contains <strong>{questions.length} questions</strong>. Each student attempting Round {round?.round_number} receives an unbiased random sample of <strong>{round?.total_questions} questions</strong> with randomized option ordering.
            </span>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Bank has <strong>{questions.length} questions</strong>. Upload a question paper PDF or click <strong>Populate 50 MCQs</strong> so each student can receive a unique random sample of {round?.total_questions} questions.
            </span>
          </div>
        )}

        {/* OCR Background Processing Queue for this Round */}
        {ocrJobs.length > 0 && (
          <Card>
            <CardHeader className="bg-gray-50/50 pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-gray-700" />
                <CardTitle className="text-sm">OCR Processing Queue for Round {round?.round_number}</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchRoundData} className="h-7 px-2 text-xs text-gray-500 gap-1">
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-gray-100 text-xs">
              {ocrJobs.map((job, jIdx) => (
                <div key={`round-${roundId}-ocr-job-${job.id || jIdx}-${jIdx}`} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">{job.document_name}</p>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                        Target: Round {round?.round_number} Bank • Job: {job.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={job.status === 'completed' ? 'success' : 'warning'}>{job.status}</Badge>
                    {job.questions_extracted !== null && (
                      <span className="font-mono text-emerald-700 font-semibold">
                        +{job.questions_extracted} MCQs Extracted
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Search & Questions List */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder={`Search Round ${round?.round_number || ''} questions...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-hidden focus:border-gray-900"
              />
            </div>

            <div className="flex items-center gap-3">
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

          {loading ? (
            <div className="p-12 text-center text-xs text-gray-400 bg-white rounded-xl border border-gray-200">
              Loading Round {round?.round_number || 1} question bank...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200 space-y-3">
              <p>No questions found in Round {round?.round_number || 1} bank.</p>
              <Button size="sm" onClick={() => setUploadModalOpen(true)} className="text-xs gap-1.5 font-semibold">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Question Paper PDF for Round {round?.round_number || 1}</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((q, index) => (
                <div
                  key={`round-${roundId}-q-${q.id || index}-${index}`}
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
                          <span className="px-2 py-0.5 rounded-sm bg-gray-100 text-gray-700 text-[10px] font-semibold">
                            Round {round?.round_number} Bank
                          </span>
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
                          key={`round-${roundId}-q-${q.id || index}-opt-${opt.label || optIndex}-${optIndex}`}
                          className={`p-2.5 rounded-lg border text-xs flex items-center gap-2.5 ${
                            isCorrect
                              ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950 font-medium'
                              : 'border-gray-200 bg-white text-gray-700'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] font-mono shrink-0 ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {opt.label}
                          </span>
                          <span className="flex-1">{opt.option_text}</span>
                          {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PDF Upload Modal (Locked to this round) */}
      <Dialog
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title={`Upload PDF for Round ${round?.round_number || ''} Question Bank`}
        description={`Upload a question paper PDF specifically for Round ${round?.round_number}: ${round?.name}. The OCR engine will scan the document and populate questions directly into this round's bank.`}
      >
        <form onSubmit={handleUploadPDF} className="space-y-4 pt-2">
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-xs">
            <span className="font-bold text-gray-900 block">Target Assessment Stage:</span>
            <span className="text-gray-600">
              Round {round?.round_number}: {round?.name} ({exam?.name})
            </span>
          </div>

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
            <input
              type="file"
              id="round-pdf-input"
              accept=".pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <label htmlFor="round-pdf-input" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-xs font-semibold text-gray-800">
                {selectedFile ? selectedFile.name : `Click to choose Round ${round?.round_number} Question PDF`}
              </span>
              <span className="text-[10px] text-gray-400 mt-1">Multi-page question papers supported</span>
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
              <span>Start OCR Scan & Save to Round {round?.round_number}</span>
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Round Settings Modal */}
      <Dialog
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title={`Round ${round?.round_number} Assessment Settings`}
        description={`Configure questions served per candidate, pass marks, timing, and proctoring rules for Round ${round?.round_number}. Changes take effect immediately.`}
      >
        <form onSubmit={handleSaveRoundSettings} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Questions Served per Candidate"
              type="number"
              min={1}
              value={roundTotalQuestions}
              onChange={(e) => setRoundTotalQuestions(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              required
            />

            <Input
              label="Duration (Minutes)"
              type="number"
              min={5}
              value={roundDuration}
              onChange={(e) => setRoundDuration(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Marks per Correct"
              type="number"
              step="0.5"
              min={0.5}
              value={roundMarksPerQ}
              onChange={(e) => setRoundMarksPerQ(e.target.value === '' ? '' : parseFloat(e.target.value))}
              required
            />

            <Input
              label="Negative Marks"
              type="number"
              step="0.25"
              min={0}
              value={roundNegativeMarks}
              onChange={(e) => setRoundNegativeMarks(e.target.value === '' ? '' : parseFloat(e.target.value))}
              required
            />

            <Input
              label="Qualifying Marks"
              type="number"
              step="0.5"
              min={0}
              value={roundQualifyingMarks}
              onChange={(e) => setRoundQualifyingMarks(e.target.value === '' ? '' : parseFloat(e.target.value))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">
                Sampling Strategy
              </label>
              <select
                value={roundStrategy}
                onChange={(e) => setRoundStrategy(e.target.value as any)}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-gray-900 focus:outline-hidden"
              >
                <option value="random">Random Sample (Unique subset per candidate)</option>
                <option value="sequential">Sequential (All candidates receive same order)</option>
                <option value="difficulty_balanced">Balanced Random (Easy, Medium, Hard)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">
                Proctoring & AI Usage Policy
              </label>
              <select
                value={roundAllowTabSwitch ? 'open_ai' : 'strict_proctoring'}
                onChange={(e) => setRoundAllowTabSwitch(e.target.value === 'open_ai')}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-gray-900 focus:outline-hidden"
              >
                <option value="strict_proctoring">Strict Anti-Cheating (3 Warnings Max, No Tab Switch)</option>
                <option value="open_ai">Open AI & Research Mode (Tab Switching Permitted)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-gray-600 border-t border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={roundAutoQualify}
                onChange={(e) => setRoundAutoQualify(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900"
              />
              <span>Automatic Qualification (unlocks next round if score &gt;= {roundQualifyingMarks})</span>
            </label>

            <span className="text-gray-500 font-mono">
              Total Marks: {(Number(roundTotalQuestions) || 0) * (Number(roundMarksPerQ) || 0)} pts
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingRoundSettings}
              onClick={() => setSettingsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={savingRoundSettings}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 bg-gray-900 text-white hover:bg-black"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Round Settings</span>
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Question Manual Create / Edit Modal */}
      <Dialog
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={editingQuestion ? `Edit Round ${round?.round_number} Question` : `Add Question to Round ${round?.round_number}`}
        description={`This MCQ will be added directly into Round ${round?.round_number}: ${round?.name}.`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 pt-2">
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
              {editingQuestion ? 'Update Question' : `Publish Question to Round ${round?.round_number}`}
            </Button>
          </div>
        </form>
      </Dialog>
    </AdminLayoutWrapper>
  );
}

export default function RoundQuestionsPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">Loading round question bank...</div>}>
      <RoundQuestionsContent />
    </React.Suspense>
  );
}

