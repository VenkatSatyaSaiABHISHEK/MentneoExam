'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  ChevronLeft,
  Activity,
  Download,
  Search,
  RefreshCw,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Code2,
  Trophy,
  Copy,
  Check,
  Layers,
  Sparkles,
  Award,
  Users,
  Eye,
  RotateCcw,
  FileText,
  Terminal,
  Radio,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatTimeRemaining } from '@/lib/utils';

interface MonitoringRow {
  attemptId: string;
  registrationId?: string;
  studentName: string;
  rollNumber: string;
  loginId: string;
  email: string;
  attributes: Record<string, string>;
  roundId: string;
  roundName: string;
  roundNumber: number;
  roundType: 'mcq' | 'coding' | 'hybrid';
  attemptStatus: 'in_progress' | 'submitted' | 'timed_out' | 'terminated' | 'registered';
  cheatingWarnings: number;
  score: number | null;
  totalMarks: number;
  qualifyingMarks: number;
  isQualified: boolean | null;
  codeSnippet: string | null;
  codeLanguage: string | null;
  secondsRemaining: number;
  startedAt: string;
  submittedAt: string | null;
  roundAttempts?: MonitoringRow[];
  totalCumulativeScore?: number;
  roundsAttemptedCount?: number;
  roundScores?: Record<number, { score: number; total: number }>;
  overallPercentage?: number;
}

interface RoundSummary {
  roundId: string;
  roundNumber: number;
  name: string;
  roundType: 'mcq' | 'coding' | 'hybrid';
  appeared: number;
  passed: number;
  failed: number;
  inProgress: number;
  passPercentage: number;
}

function AdminLiveResultsContent() {
  const params = useParams();
  const examId = params.examId as string;

  const [loading, setLoading] = React.useState(true);
  const [monitoringData, setMonitoringData] = React.useState<{
    rounds: any[];
    rows: MonitoringRow[];
    roundSummaries: RoundSummary[];
    summary: { totalWriting: number; totalSubmitted: number; totalQualified: number };
  } | null>(null);

  const [search, setSearch] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [refreshing, setRefreshing] = React.useState(false);

  // Code inspection modal state
  const [inspectedCodeRow, setInspectedCodeRow] = React.useState<MonitoringRow | null>(null);
  const [copiedCode, setCopiedCode] = React.useState(false);

  // Student detailed dossier modal state
  const [selectedDossierCandidate, setSelectedDossierCandidate] = React.useState<{
    registrationId: string;
    studentName: string;
  } | null>(null);
  const [detailedRecord, setDetailedRecord] = React.useState<any | null>(null);
  const [loadingDetailedRecord, setLoadingDetailedRecord] = React.useState(false);
  const [dossierRoundIndex, setDossierRoundIndex] = React.useState(0);
  const [reconducting, setReconducting] = React.useState(false);

  const fetchResults = async (silent = false) => {
    try {
      if (!silent && !monitoringData) setLoading(true);
      else setRefreshing(true);

      const res = await fetch(`/api/examinations/${examId}/results`);
      const json = await res.json();
      if (json.success && json.data) {
        setMonitoringData(json.data);
        try {
          localStorage.setItem(`mentneo_live_results_${examId}`, JSON.stringify(json.data));
        } catch {}
      }
    } catch {
      toast.error('Failed to load live examination telemetry');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openCandidateDossier = async (registrationId: string, studentName: string) => {
    setSelectedDossierCandidate({ registrationId, studentName });
    setLoadingDetailedRecord(true);
    setDetailedRecord(null);
    setDossierRoundIndex(0);
    try {
      const res = await fetch(`/api/examinations/${examId}/students/${registrationId}/record`);
      const json = await res.json();
      if (json.success && json.data) {
        setDetailedRecord(json.data);
      } else {
        toast.error(json.error || 'Failed to load candidate record');
      }
    } catch {
      toast.error('Network error loading candidate record');
    } finally {
      setLoadingDetailedRecord(false);
    }
  };

  const handleReconductRound = async (registrationId: string, roundId: string, roundNumber: number) => {
    const confirmed = window.confirm(
      `Are you sure you want to reconduct Round ${roundNumber} for this candidate? Their attempt for this round will be reset, allowing them to re-enter and retake the round.`
    );
    if (!confirmed) return;

    setReconducting(true);
    try {
      const res = await fetch(`/api/examinations/${examId}/students/${registrationId}/reconduct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || `Round ${roundNumber} has been reopened for candidate.`);
        fetchResults(true);
        if (selectedDossierCandidate) {
          openCandidateDossier(registrationId, selectedDossierCandidate.studentName);
        }
      } else {
        toast.error(json.error || 'Failed to reconduct round');
      }
    } catch {
      toast.error('Network error executing reconduct');
    } finally {
      setReconducting(false);
    }
  };

  const handleResetWarnings = async (registrationId: string) => {
    try {
      const res = await fetch(`/api/examinations/${examId}/students/${registrationId}/reset-warnings`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Candidate infraction warnings reset to 0.');
        fetchResults(true);
        if (selectedDossierCandidate) {
          openCandidateDossier(registrationId, selectedDossierCandidate.studentName);
        }
      } else {
        toast.error(json.error || 'Failed to reset warnings');
      }
    } catch {
      toast.error('Network error resetting warnings');
    }
  };

  // Hydrate from localStorage first so page refresh never flickers to 0
  React.useEffect(() => {
    try {
      const cached = localStorage.getItem(`mentneo_live_results_${examId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
          setMonitoringData(parsed);
          setLoading(false);
        }
      }
    } catch {}
  }, [examId]);

  React.useEffect(() => {
    fetchResults();
    const interval = setInterval(() => {
      fetchResults(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [examId]);

  const rows = monitoringData?.rows || [];
  const rounds = monitoringData?.rounds || [];
  const roundSummaries = monitoringData?.roundSummaries || [];
  const uniqueStudentCount = React.useMemo(() => new Set(rows.map((r) => r.loginId || r.registrationId || r.studentName)).size, [rows]);

  // Filter rows based on activeTab, search, and status
  const currentTabRows = React.useMemo(() => {
    let list: MonitoringRow[] = [];
    if (activeTab === 'all') {
      list = [...rows];
    } else if (activeTab === 'rankings') {
      // Final Merit Rankings:
      // STRICT FILTER: Only candidates who qualified ALL examination rounds are ranked.
      // Candidates who failed Round 1 or Round 2 or did not complete are excluded.
      const candidateMap = new Map<string, MonitoringRow>();
      const maxConfiguredRoundNum = rounds.length > 0
        ? Math.max(...rounds.map((r: any) => r.round_number || 1))
        : 1;

      // Group all attempts per student
      const studentAttemptsMap = new Map<string, MonitoringRow[]>();
      for (const r of rows) {
        const key = r.loginId || r.registrationId || r.studentName;
        if (!studentAttemptsMap.has(key)) {
          studentAttemptsMap.set(key, []);
        }
        studentAttemptsMap.get(key)!.push(r);
      }

      for (const [key, studentRows] of studentAttemptsMap.entries()) {
        // Candidate must have passed every attempted round
        const allAttemptsPassed = studentRows.every((att) => att.isQualified === true);
        const highestRoundReached = Math.max(...studentRows.map((att) => att.roundNumber));

        // Must have passed the final configured round of the exam (or highest round)
        const passedFinalRound = studentRows.some(
          (att) => att.roundNumber === maxConfiguredRoundNum && att.isQualified === true
        );

        // Strict criteria: Must have passed all rounds including the final round
        if (allAttemptsPassed && (passedFinalRound || highestRoundReached >= maxConfiguredRoundNum)) {
          const baseRow = studentRows[studentRows.length - 1];
          const roundScores: Record<number, { score: number; total: number }> = {};
          let totalCumScore = 0;
          let totalCumMax = 0;
          let totalWarnings = 0;

          studentRows.forEach((att) => {
            const sc = att.score ?? 0;
            const tot = att.totalMarks || 30;
            roundScores[att.roundNumber] = { score: sc, total: tot };
            totalCumScore += sc;
            totalCumMax += tot;
            totalWarnings += att.cheatingWarnings || 0;
          });

          const overallPct = totalCumMax > 0 ? Math.round((totalCumScore / totalCumMax) * 100) : 0;

          candidateMap.set(key, {
            ...baseRow,
            roundAttempts: studentRows,
            totalCumulativeScore: totalCumScore,
            totalMarks: totalCumMax,
            roundScores,
            overallPercentage: overallPct,
            cheatingWarnings: totalWarnings,
            isQualified: true,
          });
        }
      }
      list = Array.from(candidateMap.values());
    } else if (activeTab === 'students') {
      const candidateMap = new Map<string, MonitoringRow>();
      for (const r of rows) {
        const key = r.loginId || r.registrationId || r.studentName;
        const existing = candidateMap.get(key);
        if (!existing) {
          candidateMap.set(key, {
            ...r,
            roundAttempts: [r],
            totalCumulativeScore: r.score ?? 0,
            roundsAttemptedCount: 1,
          });
        } else {
          existing.roundAttempts = existing.roundAttempts || [];
          existing.roundAttempts.push(r);
          existing.totalCumulativeScore = (existing.totalCumulativeScore ?? 0) + (r.score ?? 0);
          existing.roundsAttemptedCount = (existing.roundsAttemptedCount ?? 0) + 1;
          if (r.roundNumber > existing.roundNumber) {
            existing.roundNumber = r.roundNumber;
            existing.roundName = r.roundName;
            existing.isQualified = r.isQualified;
            existing.attemptStatus = r.attemptStatus;
            existing.attemptId = r.attemptId;
            existing.roundId = r.roundId;
          }
        }
      }
      list = Array.from(candidateMap.values());
    } else {
      // Numeric round number
      const roundNum = parseInt(activeTab, 10);
      list = rows.filter((r) => r.roundNumber === roundNum);
    }

    // Sort ranked by score desc, then warnings asc
    list.sort((a, b) => {
      const scoreA = (a.totalCumulativeScore ?? a.score) ?? -1;
      const scoreB = (b.totalCumulativeScore ?? b.score) ?? -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.cheatingWarnings - b.cheatingWarnings;
    });

    return list;
  }, [rows, activeTab]);

  const filtered = currentTabRows.filter((r) => {
    const q = search.toLowerCase();
    const nameMatch = r.studentName.toLowerCase().includes(q);
    const rollMatch = r.rollNumber.toLowerCase().includes(q);
    const loginMatch = r.loginId.toLowerCase().includes(q);
    const deptMatch = Object.values(r.attributes).some((v) => v.toLowerCase().includes(q));
    const searchMatch = nameMatch || rollMatch || loginMatch || deptMatch;

    let statusMatch = true;
    if (statusFilter === 'qualified') statusMatch = r.isQualified === true;
    else if (statusFilter === 'failed') statusMatch = r.isQualified === false;
    else if (statusFilter === 'in_progress') statusMatch = r.attemptStatus === 'in_progress';
    else if (statusFilter !== 'all') statusMatch = r.attemptStatus === statusFilter;

    return searchMatch && statusMatch;
  });

  // Calculate dynamic summary for the selected view
  const currentSummary = React.useMemo(() => {
    if (activeTab === 'all') {
      const activeRows = rows.filter((r) => r.attemptStatus !== 'registered');
      const uniqueAppeared = new Set(activeRows.map((r) => r.loginId || r.registrationId)).size;
      const uniquePassed = new Set(rows.filter((r) => r.isQualified === true).map((r) => r.loginId || r.registrationId)).size;
      const uniqueFailed = new Set(rows.filter((r) => r.isQualified === false).map((r) => r.loginId || r.registrationId)).size;
      const uniqueInProgress = new Set(rows.filter((r) => r.attemptStatus === 'in_progress').map((r) => r.loginId || r.registrationId)).size;
      const totalCandidates = new Set(rows.map((r) => r.loginId || r.registrationId)).size;

      return {
        appeared: uniqueAppeared || totalCandidates,
        passed: uniquePassed,
        failed: uniqueFailed,
        inProgress: uniqueInProgress,
        passPercentage: uniqueAppeared > 0 ? Math.round((uniquePassed / uniqueAppeared) * 100) : 0,
      };
    } else if (activeTab === 'rankings' || activeTab === 'students') {
      const qualified = currentTabRows.filter((r) => r.isQualified === true).length;
      const activeTabRows = currentTabRows.filter((r) => r.attemptStatus !== 'registered');
      return {
        appeared: activeTabRows.length || currentTabRows.length,
        passed: qualified,
        failed: activeTabRows.length - qualified,
        inProgress: currentTabRows.filter((r) => r.attemptStatus === 'in_progress').length,
        passPercentage: activeTabRows.length > 0 ? Math.round((qualified / activeTabRows.length) * 100) : 0,
      };
    } else {
      const roundNum = parseInt(activeTab, 10);
      const s = roundSummaries.find((sum) => sum.roundNumber === roundNum);
      const roundRows = rows.filter((r) => r.roundNumber === roundNum);
      const activeRoundRows = roundRows.filter((r) => r.attemptStatus !== 'registered');
      const passed = roundRows.filter((r) => r.isQualified === true).length;
      return {
        appeared: s?.appeared || activeRoundRows.length || roundRows.length,
        passed: s?.passed ?? passed,
        failed: s?.failed ?? roundRows.filter((r) => r.isQualified === false).length,
        inProgress: s?.inProgress ?? roundRows.filter((r) => r.attemptStatus === 'in_progress').length,
        passPercentage: s?.passPercentage ?? (activeRoundRows.length > 0 ? Math.round((passed / activeRoundRows.length) * 100) : 0),
      };
    }
  }, [activeTab, rows, currentTabRows, roundSummaries]);

  // Export to Excel (.xlsx)
  const handleExportExcel = (qualifiedOnly: boolean = false) => {
    let dataToExport = filtered;
    if (qualifiedOnly) {
      dataToExport = dataToExport.filter((r) => r.isQualified === true);
    }

    if (dataToExport.length === 0) {
      toast.info(qualifiedOnly ? 'No qualified candidates found to export.' : 'No candidates to export.');
      return;
    }

    const exportRows = dataToExport.map((r, index) => {
      const dept = r.attributes?.Department || r.attributes?.department || r.attributes?.Dept || 'General';
      const batch = r.attributes?.Batch || r.attributes?.batch || '2026';

      return {
        Rank: index + 1,
        'Candidate Name': r.studentName,
        'Roll Number': r.rollNumber,
        'Login Identifier': r.loginId,
        Email: r.email,
        Department: dept,
        Batch: batch,
        Round: `Round ${r.roundNumber}: ${r.roundName}`,
        'Round Type': r.roundType.toUpperCase(),
        Status: r.attemptStatus.toUpperCase(),
        Score: r.score ?? 'N/A',
        'Total Marks': r.totalMarks,
        'Qualifying Marks': r.qualifyingMarks,
        'Percentage (%)': r.score !== null && r.totalMarks > 0 ? `${Math.round((r.score / r.totalMarks) * 100)}%` : 'N/A',
        'Qualification Result': r.isQualified === null ? 'Evaluating' : r.isQualified ? 'QUALIFIED' : 'NOT QUALIFIED',
        'Proctoring Warnings': r.cheatingWarnings,
        'Code Language': r.codeLanguage || 'N/A',
        'Started At': r.startedAt,
        'Submitted At': r.submittedAt ?? 'In Progress',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();

    let sheetName = 'Telemetry';
    if (activeTab === 'rankings') sheetName = 'Merit_List';
    else if (activeTab !== 'all') sheetName = `Round_${activeTab}_Results`;

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));

    const prefix = qualifiedOnly ? 'passed_candidates' : 'results';
    const filename = `${prefix}_${examId}_${sheetName.toLowerCase()}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success(`Exported ${exportRows.length} candidate record(s) to ${filename}`);
  };

  // Export to CSV
  const handleExportCSV = (qualifiedOnly: boolean = false) => {
    let dataToExport = filtered;
    if (qualifiedOnly) {
      dataToExport = dataToExport.filter((r) => r.isQualified === true);
    }

    if (dataToExport.length === 0) {
      toast.info('No results to export.');
      return;
    }

    const headers = [
      'Rank',
      'Candidate Name',
      'Roll Number',
      'Login ID',
      'Email',
      'Department',
      'Round',
      'Round Type',
      'Attempt Status',
      'Score',
      'Total Marks',
      'Qualification',
      'Proctoring Warnings',
      'Code Language',
      'Started At',
      'Submitted At',
    ];

    const exportRows = dataToExport.map((r, index) => {
      const dept = r.attributes?.Department || r.attributes?.department || r.attributes?.Dept || 'General';
      return [
        index + 1,
        r.studentName,
        r.rollNumber,
        r.loginId,
        r.email,
        dept,
        `Round ${r.roundNumber}`,
        r.roundType,
        r.attemptStatus,
        r.score ?? 'N/A',
        r.totalMarks,
        r.isQualified === null ? 'Pending' : r.isQualified ? 'Qualified' : 'Not Qualified',
        r.cheatingWarnings,
        r.codeLanguage || 'N/A',
        r.startedAt,
        r.submittedAt ?? 'In Progress',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...exportRows.map((e) => e.map((x) => `"${x}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const prefix = qualifiedOnly ? 'passed_candidates' : 'telemetry';
    link.setAttribute('download', `${prefix}_${examId}_tab_${activeTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${exportRows.length} record(s) to CSV.`);
  };

  const copyCodeToClipboard = () => {
    if (!inspectedCodeRow?.codeSnippet) return;
    navigator.clipboard.writeText(inspectedCodeRow.codeSnippet);
    setCopiedCode(true);
    toast.success('Code copied to clipboard.');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <AdminLayoutWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
          <div>
            <Link
              href={`/exam/admin/examinations/${examId}`}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 uppercase font-semibold tracking-wider mb-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Examination</span>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Examination Results & Telemetry</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Stream Active
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Round-by-round qualification analytics, LeetCode-style code inspection, and downloadable merit spreadsheets.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            <Link href={`/remote/${examId}`} target="_blank">
              <Button size="sm" className="text-xs uppercase tracking-wider font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Exam Remote</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              isLoading={refreshing}
              onClick={() => fetchResults(false)}
              className="col-span-2 sm:col-span-1 text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Telemetry</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportExcel(true)}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Passed (.xlsx)</span>
            </Button>

            <Button
              size="sm"
              onClick={() => handleExportExcel(false)}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 bg-gray-900 text-white hover:bg-black"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Full (.xlsx)</span>
            </Button>
          </div>
        </div>

        {/* Round Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>All Monitoring</span>
            <span className="text-[10px] py-0.2 px-1.5 rounded-full bg-white/20 text-current font-mono">
              {rows.length}
            </span>
          </button>

          {rounds.map((r: any) => {
            const summary = roundSummaries.find((s) => s.roundNumber === r.round_number);
            return (
              <button
                key={`round-tab-${r.id || r.round_number}`}
                onClick={() => setActiveTab(String(r.round_number))}
                className={`px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === String(r.round_number)
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {r.round_type === 'coding' ? (
                  <Code2 className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                )}
                <span>Round {r.round_number}: {r.name.replace(/^Round \d+:\s*/, '')}</span>
                {summary && (
                  <span className="text-[10px] py-0.2 px-1.5 rounded-full bg-white/20 text-current font-mono">
                    {summary.passed}/{summary.appeared}
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'students'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Students Record</span>
            <span className="text-[10px] py-0.2 px-1.5 rounded-full bg-white/20 text-current font-mono">
              {uniqueStudentCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rankings')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'rankings'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Final Merit Rankings</span>
          </button>
        </div>

        {/* Top Confirmation Banner for Rankings & Round Stages */}
        {activeTab === 'rankings' && (
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <span>Official Final Merit Rankings</span>
                  <Badge variant="success" size="sm">Fully Qualified</Badge>
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Only candidates who successfully qualified all {rounds.length || 2} evaluation stages are ranked below. Candidates who failed Round 1 or Round 2 are strictly excluded.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 font-mono text-xs">
              <span className="font-bold text-amber-900 bg-white px-3 py-1 rounded-lg border border-amber-200">
                {currentSummary.passed} Final Qualifiers
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Funnel & Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="p-3 sm:p-4 rounded-xl border border-gray-200 bg-white">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 block truncate">
              {activeTab === 'all'
                ? 'Total Appeared'
                : activeTab === 'rankings'
                ? 'Evaluated'
                : activeTab === 'students'
                ? 'Enrolled'
                : `Round ${activeTab} Appeared`}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 block font-mono">
              {currentSummary.appeared}
            </span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl border border-emerald-200 bg-emerald-50/30">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 block truncate">
                Passed
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800">
                {currentSummary.passPercentage}%
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 block font-mono">
              {currentSummary.passed}
            </span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl border border-gray-200 bg-white">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-rose-600 block truncate">
              Not Qualified
            </span>
            <span className="text-xl sm:text-2xl font-bold text-rose-600 mt-1 block font-mono">
              {currentSummary.failed}
            </span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl border border-gray-200 bg-white">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-600 block truncate">
              Writing
            </span>
            <span className="text-xl sm:text-2xl font-bold text-amber-600 mt-1 flex items-center gap-2 font-mono">
              {currentSummary.inProgress > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
              {currentSummary.inProgress}
            </span>
          </div>
        </div>

        {/* Qualification Funnel Progress Bar */}
        <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-700">
              {activeTab === 'rankings'
                ? 'Final Selection Funnel'
                : activeTab === 'students'
                ? 'Multi-Round Stage Qualification Conversion'
                : activeTab === 'all'
                ? 'Overall Qualification Conversion'
                : `Round ${activeTab} Qualification Ratio`}
            </span>
            <span className="text-gray-500 font-mono">
              {currentSummary.passed} qualified out of {currentSummary.appeared} candidates ({currentSummary.passPercentage}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${currentSummary.passPercentage}%` }}
            />
            <div
              className="h-full bg-rose-400 transition-all duration-500"
              style={{
                width: `${
                  currentSummary.appeared > 0
                    ? Math.round((currentSummary.failed / currentSummary.appeared) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search student name, roll number, login ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-hidden focus:border-gray-900"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 sm:flex-initial h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white focus:outline-hidden focus:border-gray-900"
            >
              <option value="all">All Statuses</option>
              <option value="qualified">Qualified</option>
              <option value="failed">Not Qualified</option>
              <option value="in_progress">Writing</option>
              <option value="submitted">Submitted</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCSV(false)}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span>CSV</span>
            </Button>
          </div>
        </div>

        {/* Mobile Candidate Card Feed (Phones & Small Viewports) */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="p-8 text-center bg-white rounded-xl border border-gray-200 text-xs text-gray-400">
              Loading authoritative telemetry...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-gray-200 text-xs text-gray-500">
              No candidate records found matching current criteria.
            </div>
          ) : activeTab === 'students' || activeTab === 'rankings' ? (
            filtered.map((r, index) => {
              const dept = r.attributes?.Department || r.attributes?.department || r.attributes?.Dept || 'General';
              const roundAttempts = r.roundAttempts || [r];
              const r3Round = rounds.find((rnd: any) => rnd.round_number === 3);
              const r3Attempt = roundAttempts.find((a) => a.roundNumber === 3);
              const isTopRank = activeTab === 'rankings' && index < 3;

              return (
                <div
                  key={`mob-cand-card-${r.loginId || index}`}
                  className={`p-4 rounded-xl border bg-white shadow-xs space-y-3 ${
                    isTopRank ? 'border-amber-300 ring-1 ring-amber-400/30 bg-amber-50/10' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-mono font-bold ${
                            isTopRank
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          #{index + 1}
                        </span>
                        <h4 className="font-bold text-sm text-gray-900">{r.studentName}</h4>
                      </div>
                      <span className="text-[11px] text-gray-500 font-mono block mt-0.5">{r.loginId} • {dept}</span>
                    </div>

                    <div>
                      {activeTab === 'rankings' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          <Trophy className="w-3 h-3 text-amber-600" />
                          Rank #{index + 1}
                        </span>
                      ) : r.isQualified === true ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Qualified
                        </span>
                      ) : r.isQualified === false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Not Qualified
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          In Progress
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stage Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {rounds.map((rnd: any) => {
                      const att = roundAttempts.find((a) => a.roundId === rnd.id || a.roundNumber === rnd.round_number);
                      const isCoding = rnd.round_type === 'coding';
                      const isPassed = att?.isQualified === true;
                      const isFailed = att?.isQualified === false;
                      const isInProg = att?.attemptStatus === 'in_progress';

                      return (
                        <span
                          key={`mob-stage-${rnd.id}`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono ${
                            isPassed
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isFailed
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : isInProg
                              ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                              : 'bg-gray-50 text-gray-400 border-gray-200'
                          }`}
                        >
                          {isCoding ? <Code2 className="w-2.5 h-2.5" /> : <Layers className="w-2.5 h-2.5" />}
                          <span>R{rnd.round_number}:</span>
                          <span>{att ? (att.score !== null ? `${att.score}m` : 'In Prog') : '—'}</span>
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                    <span className="text-gray-500 font-mono">
                      Cumulative: <strong className="text-gray-900">{r.totalCumulativeScore ?? r.score ?? 0}m</strong>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCandidateDossier(r.registrationId || r.loginId, r.studentName)}
                        className="text-xs h-7 px-2.5 gap-1 font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Dossier</span>
                      </Button>

                      {r3Attempt && r3Round && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={reconducting}
                          onClick={() => handleReconductRound(r.registrationId || r.loginId, r3Round.id, 3)}
                          className="text-xs h-7 px-2 gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-600" />
                          <span>R3</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            filtered.map((r, index) => {
              const statusVariant = {
                in_progress: 'warning',
                submitted: 'success',
                timed_out: 'neutral',
                terminated: 'danger',
                registered: 'neutral',
              }[r.attemptStatus as string] as 'warning' | 'success' | 'neutral' | 'danger';

              const isTopRank = index < 3 && r.isQualified === true;
              const dept = r.attributes?.Department || r.attributes?.department || r.attributes?.Dept || 'General';

              return (
                <div
                  key={`mob-attempt-card-${r.attemptId || index}`}
                  className={`p-4 rounded-xl border border-gray-200 bg-white shadow-xs space-y-2.5 ${
                    isTopRank ? 'ring-1 ring-amber-400/40 bg-amber-50/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold ${
                        isTopRank ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        #{index + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">{r.studentName}</h4>
                        <span className="text-[11px] text-gray-400 font-mono">{r.loginId} • {dept}</span>
                      </div>
                    </div>

                    <div>
                      {r.isQualified === null ? (
                        r.attemptStatus === 'registered' ? (
                          <Badge variant="neutral" size="sm">Pending</Badge>
                        ) : (
                          <span className="text-amber-600 font-semibold text-[11px] flex items-center gap-1 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Writing
                          </span>
                        )
                      ) : r.isQualified ? (
                        <Badge variant="success" size="sm">Qualified</Badge>
                      ) : (
                        <Badge variant="danger" size="sm">Not Qualified</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50/70 p-2.5 rounded-lg font-mono">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Round</span>
                      <span className="font-semibold text-gray-800">
                        R{r.roundNumber} ({r.roundType})
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Score / Total</span>
                      <span className="font-bold text-gray-900">
                        {r.score !== null ? `${r.score} / ${r.totalMarks}` : '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Warnings</span>
                      <span className={r.cheatingWarnings > 0 ? 'font-bold text-rose-600' : 'text-gray-500'}>
                        {r.cheatingWarnings > 0 ? `${r.cheatingWarnings} warnings` : '0 warnings'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Status</span>
                      <span className="text-gray-700 font-semibold">
                        {r.attemptStatus === 'in_progress' ? formatTimeRemaining(r.secondsRemaining) : r.attemptStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    {r.codeSnippet && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInspectedCodeRow(r)}
                        className="text-[11px] h-7 px-2 font-mono gap-1 border-gray-300 text-gray-800"
                      >
                        <Code2 className="w-3.5 h-3.5 text-gray-600" />
                        <span>Code ({r.codeLanguage || 'py'})</span>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCandidateDossier(r.registrationId || r.loginId, r.studentName)}
                      className="text-[11px] h-7 px-2.5 gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Answers</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live Monitoring & Results Table (Desktop & Tablets) */}
        <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                {activeTab === 'rankings' ? (
                  <tr>
                    <th className="py-3.5 px-4 w-14 text-center">Merit Rank</th>
                    <th className="py-3.5 px-6">Candidate</th>
                    <th className="py-3.5 px-4">Login Identifier</th>
                    <th className="py-3.5 px-4">Department</th>
                    {rounds.map((rnd: any) => (
                      <th key={`hdr-round-${rnd.id}`} className="py-3.5 px-4 text-center">
                        Round {rnd.round_number} Score
                      </th>
                    ))}
                    <th className="py-3.5 px-4 text-center">Total Score</th>
                    <th className="py-3.5 px-4 text-center">Overall %</th>
                    <th className="py-3.5 px-4 text-center">Merit Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                ) : activeTab === 'students' ? (
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-6">Candidate</th>
                    <th className="py-3.5 px-4">Login Identifier</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Multi-Round Stage Progression</th>
                    <th className="py-3.5 px-4 text-center">Cumulative Score</th>
                    <th className="py-3.5 px-4 text-center">Final Result</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">Rank</th>
                    <th className="py-3.5 px-6">Candidate</th>
                    <th className="py-3.5 px-4">Login Identifier</th>
                    <th className="py-3.5 px-4">Academic Attributes</th>
                    <th className="py-3.5 px-4">Round</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Timer / Time</th>
                    <th className="py-3.5 px-4">Warnings</th>
                    <th className="py-3.5 px-4">Score</th>
                    <th className="py-3.5 px-4 text-center">Submissions & Code</th>
                    <th className="py-3.5 px-6 text-right">Qualification</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={activeTab === 'rankings' ? (7 + rounds.length) : activeTab === 'students' ? 8 : 11} className="py-12 text-center text-gray-400">
                      Loading authoritative telemetry...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'rankings' ? (7 + rounds.length) : activeTab === 'students' ? 8 : 11} className="py-12 text-center text-gray-500 text-xs">
                      {activeTab === 'rankings'
                        ? 'No candidates have passed all examination rounds yet.'
                        : 'No candidate records found matching current criteria.'}
                    </td>
                  </tr>
                ) : activeTab === 'rankings' ? (
                  filtered.map((r, index) => {
                    const dept = r.attributes?.Department || r.attributes?.department || r.attributes?.Dept || 'General';
                    const roundScores = r.roundScores || {};

                    return (
                      <tr
                        key={`ranking-row-${r.loginId || index}`}
                        className={`hover:bg-gray-50/50 transition-colors ${
                          index === 0
                            ? 'bg-amber-50/30'
                            : index === 1
                            ? 'bg-slate-50/40'
                            : index === 2
                            ? 'bg-orange-50/20'
                            : ''
                        }`}
                      >
                        <td className="py-4 px-4 text-center font-mono font-bold">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono font-bold ${
                              index === 0
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                                : index === 1
                                ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                : index === 2
                                ? 'bg-orange-100 text-orange-900 border border-orange-300'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            #{index + 1}
                          </span>
                        </td>

                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            {index === 0 && <Trophy className="w-4 h-4 text-amber-500 shrink-0" />}
                            <div>
                              <span className="font-bold text-gray-900 block">{r.studentName}</span>
                              <span className="text-[11px] text-gray-400 font-mono">{r.email}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-mono font-semibold text-gray-900 block">{r.loginId}</span>
                          {r.rollNumber !== r.loginId && (
                            <span className="text-[10px] text-gray-400 font-mono block">Roll: {r.rollNumber}</span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-gray-100 text-gray-700 text-[11px] font-medium">
                            {dept}
                          </span>
                        </td>

                        {rounds.map((rnd: any) => {
                          const rScore = roundScores[rnd.round_number];
                          return (
                            <td key={`cell-score-${rnd.id}-${r.loginId}`} className="py-4 px-4 text-center font-mono">
                              {rScore ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>{rScore.score} / {rScore.total}</span>
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="py-4 px-4 text-center font-bold text-gray-900 font-mono">
                          <span className="text-sm">{r.totalCumulativeScore}</span>
                          <span className="block text-[10px] font-normal text-gray-400">/ {r.totalMarks}</span>
                        </td>

                        <td className="py-4 px-4 text-center font-bold font-mono">
                          <span className="text-sm text-emerald-700">{r.overallPercentage ?? 0}%</span>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            All Rounds Passed
                          </span>
                        </td>

                        <td className="py-4 px-6 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCandidateDossier(r.registrationId || r.loginId, r.studentName)}
                            className="text-xs h-7 px-2.5 gap-1 font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Dossier</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : activeTab === 'students' ? (
                  filtered.map((r, index) => {
                    const dept = r.attributes?.Department || r.attributes?.department || r.attributes?.Dept || 'General';
                    const roundAttempts = r.roundAttempts || [r];
                    const r3Round = rounds.find((rnd: any) => rnd.round_number === 3);
                    const r3Attempt = roundAttempts.find((a) => a.roundNumber === 3);

                    return (
                      <tr key={`student-dossier-row-${r.loginId || index}`} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-4 text-center font-mono font-bold text-gray-500">
                          {index + 1}
                        </td>

                        <td className="py-4 px-6">
                          <span className="font-bold text-gray-900 block">{r.studentName}</span>
                          <span className="text-[11px] text-gray-400 font-mono">{r.email}</span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-mono font-semibold text-gray-900 block">{r.loginId}</span>
                          {r.rollNumber !== r.loginId && (
                            <span className="text-[10px] text-gray-400 font-mono block">Roll: {r.rollNumber}</span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-gray-100 text-gray-700 text-[11px] font-medium">
                            {dept}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {rounds.map((rnd: any) => {
                              const att = roundAttempts.find((a) => a.roundId === rnd.id || a.roundNumber === rnd.round_number);
                              const isCoding = rnd.round_type === 'coding';
                              const isPassed = att?.isQualified === true;
                              const isFailed = att?.isQualified === false;
                              const isInProg = att?.attemptStatus === 'in_progress';

                              return (
                                <span
                                  key={`stage-badge-${rnd.id}`}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border font-mono ${
                                    isPassed
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : isFailed
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : isInProg
                                      ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                                      : 'bg-gray-50 text-gray-400 border-gray-200'
                                  }`}
                                >
                                  {isCoding ? <Code2 className="w-2.5 h-2.5" /> : <Layers className="w-2.5 h-2.5" />}
                                  <span>R{rnd.round_number}:</span>
                                  <span>
                                    {att ? (att.score !== null ? `${att.score}m` : 'In Prog') : 'Not Started'}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        <td className="py-4 px-4 text-center font-bold text-gray-900 font-mono">
                          <span className="text-sm">{r.totalCumulativeScore ?? r.score ?? 0}</span>
                          <span className="block text-[10px] font-normal text-gray-400">Total Marks</span>
                        </td>

                        <td className="py-4 px-4 text-center">
                          {r.isQualified === true ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Qualified
                            </span>
                          ) : r.isQualified === false ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              Not Qualified
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px]">In Progress</span>
                          )}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCandidateDossier(r.registrationId || r.loginId, r.studentName)}
                              className="text-xs h-7 px-2.5 gap-1 font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>See More / Answers</span>
                            </Button>

                            {r3Attempt && r3Round && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={reconducting}
                                onClick={() => handleReconductRound(r.registrationId || r.loginId, r3Round.id, 3)}
                                title="Reset candidate attempt for Round 3"
                                className="text-xs h-7 px-2 gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
                              >
                                <RotateCcw className="w-3 h-3 text-amber-600" />
                                <span>Reconduct R3</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  filtered.map((r, index) => {
                    const statusVariant = {
                      in_progress: 'warning',
                      submitted: 'success',
                      timed_out: 'neutral',
                      terminated: 'danger',
                      registered: 'neutral',
                    }[r.attemptStatus as string] as 'warning' | 'success' | 'neutral' | 'danger';

                    const isTopRank = index < 3 && r.isQualified === true;
                    const dept = r.attributes?.Department || r.attributes?.department || r.attributes?.Dept;

                    return (
                      <tr
                        key={`result-row-${r.attemptId || index}`}
                        className={`hover:bg-gray-50/50 transition-colors ${
                          isTopRank ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="py-4 px-4 text-center font-mono font-bold">
                          {isTopRank ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs">
                              {index + 1}
                            </span>
                          ) : (
                            <span className="text-gray-500">{index + 1}</span>
                          )}
                        </td>

                        <td className="py-4 px-6">
                          <span className="font-bold text-gray-900 block">{r.studentName}</span>
                          <span className="text-[11px] text-gray-400 font-mono">{r.email}</span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-mono font-semibold text-gray-900 block">{r.loginId}</span>
                          {r.rollNumber !== r.loginId && (
                            <span className="text-[10px] text-gray-400 font-mono block">Roll: {r.rollNumber}</span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          {dept ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-gray-100 text-gray-700 text-[11px] font-medium">
                              {dept}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px]">General</span>
                          )}
                        </td>

                        <td className="py-4 px-4 font-medium text-gray-700">
                          <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                            R{r.roundNumber}
                          </span>
                          <span className="text-[10px] text-gray-400 block uppercase">
                            {r.roundType}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <Badge variant={statusVariant}>
                            {r.attemptStatus === 'registered' ? 'Registered' : r.attemptStatus}
                          </Badge>
                        </td>

                        <td className="py-4 px-4 font-mono font-medium text-gray-700">
                          {r.attemptStatus === 'in_progress' ? (
                            <span className="inline-flex items-center gap-1.5 text-gray-900 font-bold">
                              <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                              {formatTimeRemaining(r.secondsRemaining)}
                            </span>
                          ) : r.attemptStatus === 'registered' ? (
                            <span className="text-gray-400 text-[11px]">Not Started</span>
                          ) : r.submittedAt ? (
                            <span className="text-gray-500 text-[11px]">
                              {new Date(r.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          {r.cheatingWarnings > 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-600 font-mono">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              {r.cheatingWarnings}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-mono">0</span>
                          )}
                        </td>

                        <td className="py-4 px-4 font-bold text-gray-900 font-mono">
                          {r.score !== null ? (
                            <div>
                              <span>{r.score} / {r.totalMarks}</span>
                              <span className="block text-[10px] font-normal text-gray-400">
                                Pass: {r.qualifyingMarks}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {r.codeSnippet && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInspectedCodeRow(r)}
                                className="text-[11px] h-7 px-2 font-mono gap-1 border-gray-300 hover:border-gray-900 text-gray-800"
                              >
                                <Code2 className="w-3.5 h-3.5 text-gray-600" />
                                <span>Code ({r.codeLanguage || 'py'})</span>
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCandidateDossier(r.registrationId || r.loginId, r.studentName)}
                              className="text-[11px] h-7 px-2 gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Answers</span>
                            </Button>
                          </div>
                        </td>

                        <td className="py-4 px-6 text-right">
                          {r.isQualified === null ? (
                            r.attemptStatus === 'registered' ? (
                              <span className="text-gray-400 text-[11px]">Pending</span>
                            ) : (
                              <span className="text-amber-600 font-semibold text-[11px] flex items-center justify-end gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Writing
                              </span>
                            )
                          ) : r.isQualified ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Qualified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                              <XCircle className="w-3.5 h-3.5 text-rose-500" />
                              Not Qualified
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Round Progression & Next Round Eligibility Form */}
        {activeTab !== 'all' && activeTab !== 'rankings' && activeTab !== 'students' && (
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Round {activeTab} Evaluation &amp; Progression Form</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Authoritative stage data for Round {activeTab}. Candidates who cleared this round advance to subsequent stages.
                </p>
              </div>
              <Badge variant="neutral" size="sm">
                Stage {activeTab} of {rounds.length}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/40">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                  Passed Round {activeTab}
                </span>
                <span className="text-xl font-bold text-emerald-700 mt-1 block font-mono">
                  {currentSummary.passed} Candidates
                </span>
                <span className="text-[11px] text-emerald-600 block mt-1">
                  {parseInt(activeTab, 10) < rounds.length
                    ? `Eligible to advance to Round ${parseInt(activeTab, 10) + 1}`
                    : 'Awarded Final Examination Qualification'}
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/40">
                <span className="text-[10px] uppercase font-bold text-rose-800 block">
                  Failed Round {activeTab}
                </span>
                <span className="text-xl font-bold text-rose-700 mt-1 block font-mono">
                  {currentSummary.failed} Candidates
                </span>
                <span className="text-[11px] text-rose-600 block mt-1">
                  Disqualified from subsequent examination stages
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/40">
                <span className="text-[10px] uppercase font-bold text-amber-800 block">
                  Currently Writing
                </span>
                <span className="text-xl font-bold text-amber-700 mt-1 block font-mono">
                  {currentSummary.inProgress} Candidates
                </span>
                <span className="text-[11px] text-amber-600 block mt-1">
                  Active live examination sessions
                </span>
              </div>
            </div>

            {parseInt(activeTab, 10) === 2 && rounds.length === 2 && (
              <div className="p-3.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Final Round Completed:</strong> There is no Round 3. All {currentSummary.passed} candidates who passed Round 2 constitute the Final Institutional Merit Rankings.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab('rankings')}
                  className="shrink-0 text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                >
                  View Final Merit Rankings
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Code Inspection Modal */}
        <Dialog
          isOpen={!!inspectedCodeRow}
          onClose={() => setInspectedCodeRow(null)}
          title={`Candidate Code Submission: ${inspectedCodeRow?.studentName}`}
          description={`Login ID: ${inspectedCodeRow?.loginId} • Round ${inspectedCodeRow?.roundNumber}: ${inspectedCodeRow?.roundName}`}
          maxWidth="xl"
        >
          {inspectedCodeRow && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                    Language:
                  </span>
                  <span className="px-2 py-0.5 rounded-sm bg-gray-100 font-mono text-xs font-bold text-gray-800">
                    {inspectedCodeRow.codeLanguage?.toUpperCase() || 'PYTHON'}
                  </span>
                  <span className="text-xs text-gray-400">
                    • Score: {inspectedCodeRow.score} / {inspectedCodeRow.totalMarks}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyCodeToClipboard}
                  className="text-xs gap-1.5 h-8 font-semibold"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-gray-600" />
                      <span>Copy Solution</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Code Container */}
              <div className="relative rounded-xl bg-gray-950 p-4 font-mono text-xs text-gray-100 overflow-x-auto max-h-[500px]">
                <pre className="leading-relaxed">
                  <code>{inspectedCodeRow.codeSnippet}</code>
                </pre>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-200">
                <span>
                  Submitted at: {inspectedCodeRow.submittedAt ? new Date(inspectedCodeRow.submittedAt).toLocaleString() : 'N/A'}
                </span>
                <span className="font-semibold text-emerald-600">
                  Status: {inspectedCodeRow.isQualified ? 'Passed Qualification Benchmark' : 'Did Not Meet Benchmark'}
                </span>
              </div>
            </div>
          )}
        </Dialog>

        {/* Candidate Multi-Round Detailed Dossier Modal */}
        <Dialog
          isOpen={!!selectedDossierCandidate}
          onClose={() => setSelectedDossierCandidate(null)}
          title={`Candidate Dossier: ${detailedRecord?.studentName || selectedDossierCandidate?.studentName}`}
          description={`Login: ${detailedRecord?.loginId || 'N/A'} • Roll: ${detailedRecord?.rollNumber || 'N/A'} • Email: ${detailedRecord?.email || 'N/A'}`}
          maxWidth="4xl"
        >
          {loadingDetailedRecord ? (
            <div className="py-16 text-center text-xs text-gray-500 space-y-2">
              <RefreshCw className="w-5 h-5 mx-auto animate-spin text-gray-400" />
              <p>Loading candidate multi-round questions and submitted code...</p>
            </div>
          ) : !detailedRecord ? (
            <div className="py-12 text-center text-xs text-gray-400">
              No examination records found for this candidate.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stage Stepper Tabs */}
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
                {detailedRecord.rounds.map((rnd: any, idx: number) => {
                  const isSelected = dossierRoundIndex === idx;
                  const isCoding = rnd.roundType === 'coding';
                  const isPassed = rnd.isQualified === true;

                  return (
                    <button
                      key={`dossier-round-${rnd.roundId || idx}`}
                      onClick={() => setDossierRoundIndex(idx)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'bg-gray-900 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {isCoding ? (
                        <Code2 className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                      )}
                      <span>Round {rnd.roundNumber}: {rnd.roundName.replace(/^Round \d+:\s*/, '')}</span>
                      {rnd.result ? (
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-sm ${
                          isPassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {rnd.result.score}/{rnd.totalMarks}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">Not Attempted</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Round Details */}
              {(() => {
                const curRound = detailedRecord.rounds[dossierRoundIndex];
                if (!curRound) return null;
                const isCoding = curRound.roundType === 'coding';
                const hasAttempt = Boolean(curRound.attempt);

                return (
                  <div className="space-y-5">
                    {/* Round Summary Card */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">
                            Round {curRound.roundNumber}: {curRound.roundName}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-gray-200 text-gray-700">
                            {curRound.roundType}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Total Marks: {curRound.totalMarks} • Qualifying Benchmark: {curRound.qualifyingMarks} Marks • Duration: {curRound.durationMinutes} mins
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {curRound.isQualified === true ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Passed Benchmark
                          </span>
                        ) : curRound.isQualified === false ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            Did Not Qualify
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
                            {curRound.attempt?.status || 'Pending'}
                          </span>
                        )}

                        {/* Reconduct Button for HR */}
                        {hasAttempt && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetWarnings(detailedRecord.registrationId)}
                              className="text-xs h-8 gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50 cursor-pointer"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                              <span>Reset Infractions (0)</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={reconducting}
                              onClick={() => handleReconductRound(detailedRecord.registrationId, curRound.roundId, curRound.roundNumber)}
                              className="text-xs h-8 gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                              <span>Reconduct Round {curRound.roundNumber}</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stat Metrics Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-white border border-gray-200 rounded-lg">
                        <span className="text-[10px] uppercase text-gray-400 font-semibold block">Total Score</span>
                        <span className="text-lg font-bold text-gray-900 font-mono mt-0.5 block">
                          {curRound.result ? `${curRound.result.score} / ${curRound.totalMarks}` : '—'}
                        </span>
                      </div>
                      <div className="p-3 bg-white border border-gray-200 rounded-lg">
                        <span className="text-[10px] uppercase text-gray-400 font-semibold block">Accuracy Rate</span>
                        <span className="text-lg font-bold text-gray-900 font-mono mt-0.5 block">
                          {curRound.stats.accuracyPercentage}%
                        </span>
                      </div>
                      <div className="p-3 bg-white border border-gray-200 rounded-lg">
                        <span className="text-[10px] uppercase text-emerald-600 font-semibold block">Correct Answers</span>
                        <span className="text-lg font-bold text-emerald-700 font-mono mt-0.5 block">
                          {curRound.stats.correctCount}
                        </span>
                      </div>
                      <div className="p-3 bg-white border border-gray-200 rounded-lg">
                        <span className="text-[10px] uppercase text-rose-600 font-semibold block">Incorrect / Negative</span>
                        <span className="text-lg font-bold text-rose-600 font-mono mt-0.5 block">
                          {curRound.stats.wrongCount}
                        </span>
                      </div>
                    </div>

                    {/* Questions or Coding Simulator Body */}
                    {!hasAttempt ? (
                      <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500">
                        Candidate has not yet initialized or attempted Round {curRound.roundNumber}.
                      </div>
                    ) : isCoding ? (
                      /* CODING SIMULATOR ROUND 3 */
                      <div className="space-y-4">
                        {curRound.questions.map((q: any) => (
                          <div key={q.questionId} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs uppercase text-gray-400">Problem {q.index}</span>
                                <span className="px-2 py-0.5 rounded-sm bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-bold">
                                  SIMULATOR: {q.codeLanguage?.toUpperCase() || 'PYTHON 3'}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-gray-900">
                                {q.earnedMarks} / {q.marksPerQuestion} Marks
                              </span>
                            </div>

                            {/* Problem Text */}
                            <div className="prose prose-sm max-w-none text-xs text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-100 whitespace-pre-wrap font-sans">
                              {q.questionText}
                            </div>

                            {/* Submitted Code Viewer */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                                  <Terminal className="w-3.5 h-3.5 text-gray-500" />
                                  Candidate Simulator Code:
                                </span>
                                {q.codeSnippet && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(q.codeSnippet);
                                      toast.success('Code copied to clipboard.');
                                    }}
                                    className="text-[11px] h-7 gap-1 font-mono"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Code</span>
                                  </Button>
                                )}
                              </div>

                              {q.codeSnippet ? (
                                <div className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-100 overflow-x-auto max-h-80 border border-slate-800">
                                  <pre className="leading-relaxed">
                                    <code>{q.codeSnippet}</code>
                                  </pre>
                                </div>
                              ) : (
                                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-400 italic">
                                  No code was submitted in the sandbox editor for this question.
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* MCQ QUESTIONS ROUND 1 & 2 */
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {curRound.questions.map((q: any) => {
                          return (
                            <div
                              key={q.questionId}
                              className={`p-4 rounded-xl border bg-white space-y-3 transition-colors ${
                                q.isCorrect === true
                                  ? 'border-emerald-200 bg-emerald-50/10'
                                  : q.isCorrect === false
                                  ? 'border-rose-200 bg-rose-50/10'
                                  : 'border-gray-200'
                              }`}
                            >
                              {/* Question Header */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-sm bg-gray-100 text-gray-700">
                                    Q{q.index}
                                  </span>
                                  <span className="text-[10px] uppercase font-semibold text-gray-400 font-mono">
                                    {q.difficulty}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {q.isCorrect === true ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-sm">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      +{q.earnedMarks} Marks (Correct)
                                    </span>
                                  ) : q.isCorrect === false ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-sm">
                                      <XCircle className="w-3.5 h-3.5" />
                                      {q.earnedMarks} Marks (Incorrect)
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-sm">
                                      Unanswered (0 Marks)
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Question Text */}
                              <p className="text-xs font-medium text-gray-900 leading-relaxed">
                                {q.questionText}
                              </p>

                              {/* Options Matrix */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {q.options.map((opt: any) => {
                                  const isSelected = q.selectedOption === opt.label;
                                  const isCorrect = q.correctOption === opt.label;

                                  let optClass = 'border-gray-200 bg-white text-gray-700';
                                  if (isSelected && isCorrect) {
                                    optClass = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-500';
                                  } else if (isSelected && !isCorrect) {
                                    optClass = 'border-rose-500 bg-rose-50 text-rose-900 font-semibold ring-1 ring-rose-500';
                                  } else if (!isSelected && isCorrect) {
                                    optClass = 'border-emerald-300 bg-emerald-50/40 text-emerald-800';
                                  }

                                  return (
                                    <div
                                      key={opt.id || opt.label}
                                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${optClass}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center font-mono ${
                                          isSelected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                          {opt.label}
                                        </span>
                                        <span className="text-xs leading-snug">{opt.option_text}</span>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {isSelected && (
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-gray-900 text-white">
                                            Candidate Choice
                                          </span>
                                        )}
                                        {isCorrect && (
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-emerald-600 text-white">
                                            Correct Key
                                          </span>
                                        )}
                                      </div>
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
                );
              })()}
            </div>
          )}
        </Dialog>
      </div>
    </AdminLayoutWrapper>
  );
}

export default function AdminLiveResultsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center text-xs text-gray-400">
          Loading telemetry and results...
        </div>
      }
    >
      <AdminLiveResultsContent />
    </React.Suspense>
  );
}
