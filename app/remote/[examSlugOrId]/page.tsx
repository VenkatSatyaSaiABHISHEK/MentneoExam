'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ShieldCheck,
  Radio,
  Play,
  Pause,
  StopCircle,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Copy,
  Lock,
  Unlock,
  KeyRound,
  ChevronRight,
  Search,
  Megaphone,
  PlusCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTimeRemaining } from '@/lib/utils';

function ExamRemoteContent() {
  const params = useParams();
  const router = useRouter();
  const examSlugOrId = params.examSlugOrId as string;

  // PIN authentication state
  const [pin, setPin] = React.useState('');
  const [pinInput, setPinInput] = React.useState('');
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [verifyingPin, setVerifyingPin] = React.useState(false);
  const [pinError, setPinError] = React.useState('');

  // Remote controller state
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [remoteData, setRemoteData] = React.useState<any>(null);
  const [activeTab, setActiveTab] = React.useState<string>('all');
  const [candidateFilter, setCandidateFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Modals & Action States
  const [broadcastModalOpen, setBroadcastModalOpen] = React.useState(false);
  const [announcementText, setAnnouncementText] = React.useState('');
  const [pinModalOpen, setPinModalOpen] = React.useState(false);
  const [newPinInput, setNewPinInput] = React.useState('');
  const [togglingAdmission, setTogglingAdmission] = React.useState(false);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);

  // Check sessionStorage for cached remote PIN
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPin = sessionStorage.getItem(`remote_pin_${examSlugOrId}`);
      if (savedPin) {
        setPin(savedPin);
        setIsUnlocked(true);
      }
    }
  }, [examSlugOrId]);

  // Fetch remote telemetry data
  const fetchRemoteData = React.useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const activePin = pin || (typeof window !== 'undefined' ? sessionStorage.getItem(`remote_pin_${examSlugOrId}`) : '') || '12345678';
      const res = await fetch(`/api/examinations/${examSlugOrId}/remote?pin=${encodeURIComponent(activePin)}`, {
        headers: { 'x-remote-pin': activePin },
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.pinRequired) {
          setIsUnlocked(false);
        } else {
          toast.error(json.error || 'Failed to fetch remote telemetry.');
        }
        return;
      }

      setRemoteData(json.data);
      setIsUnlocked(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`remote_pin_${examSlugOrId}`, activePin);
      }
    } catch {
      if (!silent) toast.error('Connection error with exam server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [examSlugOrId, pin]);

  // Initial load and periodic polling every 4 seconds
  React.useEffect(() => {
    if (isUnlocked) {
      fetchRemoteData();
      const interval = setInterval(() => {
        fetchRemoteData(true);
      }, 4000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [isUnlocked, fetchRemoteData]);

  // Handle PIN Unlock Submit
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    if (!clean) {
      setPinError('Please enter your 8-digit remote PIN.');
      return;
    }

    setVerifyingPin(true);
    setPinError('');

    try {
      const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: clean,
          action: 'verify_pin',
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setPinError(json.error || 'Incorrect remote PIN. Please try again.');
        return;
      }

      setPin(clean);
      setIsUnlocked(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`remote_pin_${examSlugOrId}`, clean);
      }
      toast.success('Exam Remote Control Unlocked.');
    } catch {
      setPinError('Network verification failed. Please try again.');
    } finally {
      setVerifyingPin(false);
    }
  };

  // Toggle Candidate Admission (Open / Locked)
  const handleToggleAdmission = async () => {
    if (!remoteData?.exam || togglingAdmission) return;
    const currentLocked = Boolean(remoteData.exam.admission_locked);
    const nextLocked = !currentLocked;

    setTogglingAdmission(true);
    try {
      const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          action: 'toggle_admission',
          data: { locked: nextLocked },
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to update admission status.');
        return;
      }

      setRemoteData((prev: any) => ({
        ...prev,
        exam: { ...prev.exam, admission_locked: nextLocked },
      }));
      toast.success(nextLocked ? 'Candidate Admission FROZEN.' : 'Candidate Admission OPENED.');
    } catch {
      toast.error('Network error updating admission switch.');
    } finally {
      setTogglingAdmission(false);
    }
  };

  // Change Exam Status (LIVE / PAUSED / COMPLETED / DRAFT)
  const handleSetStatus = async (newStatus: string) => {
    if (!remoteData?.exam || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          action: 'set_status',
          data: { status: newStatus },
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to update status.');
        return;
      }

      setRemoteData((prev: any) => ({
        ...prev,
        exam: { ...prev.exam, status: newStatus },
      }));
      toast.success(`Exam status set to ${newStatus.toUpperCase()}`);
    } catch {
      toast.error('Failed to change exam status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Broadcast Emergency Alert Announcement
  const handleBroadcastAnnouncement = async () => {
    try {
      const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          action: 'set_announcement',
          data: { message: announcementText.trim() },
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to broadcast alert.');
        return;
      }

      setRemoteData((prev: any) => ({
        ...prev,
        exam: { ...prev.exam, emergency_announcement: announcementText.trim() || null },
      }));
      setBroadcastModalOpen(false);
      toast.success(announcementText.trim() ? 'Emergency alert broadcast to candidates.' : 'Alert cleared.');
    } catch {
      toast.error('Network failure sending announcement.');
    }
  };

  // Grant Extra Time (+5 Mins)
  const handleExtendTime = async (attemptId: string) => {
    try {
      const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          action: 'extend_time',
          data: { attemptId, minutes: 5 },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to grant extra time.');
        return;
      }
      toast.success('+5 minutes added to candidate session.');
      fetchRemoteData(true);
    } catch {
      toast.error('Failed to communicate with exam server.');
    }
  };

  // Force Submit Attempt
  const handleForceSubmit = async (attemptId: string) => {
    if (!confirm('Are you sure you want to finalize and auto-submit this candidate attempt?')) return;
    try {
      const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          action: 'force_submit',
          data: { attemptId },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to force submit.');
        return;
      }
      toast.success('Candidate attempt finalized and evaluated.');
      fetchRemoteData(true);
    } catch {
      toast.error('Failed to submit candidate attempt.');
    }
  };

  // Update Remote PIN
  const handleUpdatePin = async () => {
    const clean = newPinInput.trim();
    if (clean.length < 4 || clean.length > 12) {
      toast.error('PIN must be 4 to 12 digits.');
      return;
    }
    try {
      const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          action: 'update_pin',
          data: { newPin: clean },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to update PIN.');
        return;
      }
      setPin(clean);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`remote_pin_${examSlugOrId}`, clean);
      }
      setPinModalOpen(false);
      setNewPinInput('');
      toast.success('Remote Access PIN updated.');
    } catch {
      toast.error('Network failure updating PIN.');
    }
  };

  // Copy remote link to clipboard
  const handleCopyRemoteLink = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
      toast.success('Remote Control URL copied to clipboard.');
    }
  };

  // PIN Gate Screen
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Radio className="w-7 h-7 animate-pulse" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Exam Remote Control</h1>
            <p className="text-xs text-slate-400">
              Enter the authorized access PIN to remotely control this live examination session.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Operator PIN</label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={12}
                placeholder="Enter 8-digit PIN (default 12345678)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="bg-slate-950 border-slate-700 text-center tracking-widest text-lg font-mono text-white focus:border-indigo-500 h-12"
                autoFocus
              />
              {pinError && <p className="text-xs text-rose-400 font-medium">{pinError}</p>}
            </div>

            <Button
              type="submit"
              disabled={verifyingPin}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-11"
            >
              {verifyingPin ? 'Verifying Authorization...' : 'Unlock Exam Remote'}
            </Button>
          </form>

          <div className="pt-2 text-center">
            <p className="text-[11px] text-slate-500">
              Default operator PIN is <span className="font-mono text-slate-400 font-bold">12345678</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const exam = remoteData?.exam || {};
  const summary = remoteData?.summary || {
    totalRegistered: 0,
    totalWriting: 0,
    totalSubmitted: 0,
    totalQualified: 0,
    totalFailed: 0,
  };
  const rounds = remoteData?.rounds || [];
  const candidates = remoteData?.candidates || [];

  // Filter candidates based on activeTab, filter, and search
  const filteredCandidates = candidates.filter((c: any) => {
    if (activeTab !== 'all') {
      const rNum = parseInt(activeTab, 10);
      if (c.roundNumber !== rNum) return false;
    }

    if (candidateFilter === 'writing' && c.attemptStatus !== 'in_progress') return false;
    if (candidateFilter === 'qualified' && c.isQualified !== true) return false;
    if (candidateFilter === 'failed' && c.isQualified !== false) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.studentName?.toLowerCase().includes(q);
      const matchRoll = c.rollNumber?.toLowerCase().includes(q);
      const matchLogin = c.loginId?.toLowerCase().includes(q);
      if (!matchName && !matchRoll && !matchLogin) return false;
    }

    return true;
  });

  const isAdmissionLocked = Boolean(exam.admission_locked);
  const examStatus = exam.status || 'live';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16 selection:bg-indigo-500 selection:text-white">
      {/* Top Remote Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-none flex items-center gap-1.5">
              <span>{exam.name || 'Mentneo Exam'}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700">
                Remote
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">/{exam.slug || examSlugOrId}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRemoteData(false)}
            disabled={refreshing}
            className="h-8 w-8 p-0 bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyRemoteLink}
            className="h-8 px-2.5 bg-slate-800 border-slate-700 text-slate-300 hover:text-white text-xs gap-1"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPinModalOpen(true)}
            className="h-8 px-2.5 bg-slate-800 border-slate-700 text-slate-300 hover:text-white text-xs gap-1 font-mono"
          >
            <KeyRound className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">PIN</span>
          </Button>
        </div>
      </header>

      {/* Emergency Announcement Banner (if active) */}
      {exam.emergency_announcement && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-amber-300 text-xs">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-400 animate-bounce shrink-0" />
            <span className="font-semibold">{exam.emergency_announcement}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAnnouncementText('');
              handleBroadcastAnnouncement();
            }}
            className="h-6 text-[10px] text-amber-400 hover:bg-amber-500/20 px-2"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Main Remote Body */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* ========================================================= */}
        {/* SECTION 1: MASTER HARDWARE-STYLE REMOTE SWITCHES           */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Switch 1: Student Admission Gate */}
          <div
            onClick={handleToggleAdmission}
            className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.98] select-none ${
              isAdmissionLocked
                ? 'bg-rose-950/40 border-rose-800/80 hover:bg-rose-900/30'
                : 'bg-emerald-950/40 border-emerald-800/80 hover:bg-emerald-900/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Candidate Admission Gate
              </span>
              <span
                className={`w-3 h-3 rounded-full ${
                  isAdmissionLocked ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 animate-pulse'
                }`}
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  {isAdmissionLocked ? <Lock className="w-4 h-4 text-rose-400" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
                  <span>{isAdmissionLocked ? 'LOCKED / CLOSED' : 'OPEN / ACCEPTING'}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isAdmissionLocked ? 'No new candidates can sign in' : 'Candidates can register & verify'}
                </p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-bold border font-mono ${
                  isAdmissionLocked
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-emerald-600 text-white border-emerald-500'
                }`}
              >
                {togglingAdmission ? 'Updating...' : 'TAP TO TOGGLE'}
              </div>
            </div>
          </div>

          {/* Switch 2: Broadcast Alert to Candidate Screens */}
          <div
            onClick={() => {
              setAnnouncementText(exam.emergency_announcement || '');
              setBroadcastModalOpen(true);
            }}
            className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-900 cursor-pointer transition-all active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Proctor Public Announcement
              </span>
              <Megaphone className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  {exam.emergency_announcement ? 'ALERT ACTIVE' : 'BROADCAST ALERT'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  {exam.emergency_announcement || 'Push announcement to all student screens'}
                </p>
              </div>
              <div className="px-3 py-1 rounded-full text-xs font-bold border font-mono bg-indigo-600 text-white border-indigo-500">
                COMPOSE
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: EXAM STATUS STATE BUTTONS                      */}
        {/* ========================================================= */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Examination Operational Status</span>
            <span className="font-mono text-slate-300">Current: <strong className="text-white uppercase">{examStatus}</strong></span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'live', label: 'LIVE', icon: Play, color: 'hover:bg-emerald-600 border-emerald-700 text-emerald-400', active: 'bg-emerald-600 text-white' },
              { id: 'paused', label: 'PAUSE', icon: Pause, color: 'hover:bg-amber-600 border-amber-700 text-amber-400', active: 'bg-amber-600 text-white' },
              { id: 'completed', label: 'STOP', icon: StopCircle, color: 'hover:bg-rose-600 border-rose-700 text-rose-400', active: 'bg-rose-600 text-white' },
              { id: 'draft', label: 'DRAFT', icon: Lock, color: 'hover:bg-slate-700 border-slate-700 text-slate-400', active: 'bg-slate-700 text-white' },
            ].map((btn) => {
              const Icon = btn.icon;
              const isActive = examStatus === btn.id;
              return (
                <button
                  key={btn.id}
                  onClick={() => handleSetStatus(btn.id)}
                  disabled={updatingStatus}
                  className={`h-11 rounded-lg border font-bold text-xs flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                    isActive ? btn.active + ' shadow-md' : 'bg-slate-950/60 ' + btn.color
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 3: LIVE TELEMETRY METRIC TILES                    */}
        {/* ========================================================= */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
          <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Registered</span>
            <span className="text-xl font-black text-white font-mono">{summary.totalRegistered}</span>
          </div>

          <div className="bg-amber-950/30 border border-amber-800/40 p-2.5 rounded-xl">
            <span className="text-[10px] text-amber-400 block font-semibold uppercase flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Writing
            </span>
            <span className="text-xl font-black text-amber-300 font-mono">{summary.totalWriting}</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Submitted</span>
            <span className="text-xl font-black text-slate-200 font-mono">{summary.totalSubmitted}</span>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-800/40 p-2.5 rounded-xl">
            <span className="text-[10px] text-emerald-400 block font-semibold uppercase">Qualified</span>
            <span className="text-xl font-black text-emerald-300 font-mono">{summary.totalQualified}</span>
          </div>

          <div className="bg-rose-950/30 border border-rose-800/40 p-2.5 rounded-xl col-span-3 sm:col-span-1">
            <span className="text-[10px] text-rose-400 block font-semibold uppercase">Failed</span>
            <span className="text-xl font-black text-rose-300 font-mono">{summary.totalFailed}</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 4: CANDIDATE INSPECTOR & CONTROLS                  */}
        {/* ========================================================= */}
        <div className="space-y-3 pt-2">
          {/* Round Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Rounds ({candidates.length})
            </button>
            {rounds.map((rnd: any) => (
              <button
                key={`tab-round-${rnd.id}`}
                onClick={() => setActiveTab(String(rnd.round_number))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  activeTab === String(rnd.round_number)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>R{rnd.round_number}: {rnd.name}</span>
                <span className="text-[10px] font-mono opacity-70">({candidates.filter((c: any) => c.roundNumber === rnd.round_number).length})</span>
              </button>
            ))}
          </div>

          {/* Search & Sub-Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <Input
                placeholder="Search by student name or roll number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border-slate-800 pl-9 text-xs h-9 text-white"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'writing', label: 'Writing' },
                { id: 'qualified', label: 'Passed' },
                { id: 'failed', label: 'Failed' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setCandidateFilter(f.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    candidateFilter === f.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Candidate Card Stream */}
          <div className="space-y-2">
            {filteredCandidates.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
                No candidates matching the selected filters.
              </div>
            ) : (
              filteredCandidates.map((c: any, index: number) => {
                const isWriting = c.attemptStatus === 'in_progress';
                const isPassed = c.isQualified === true;
                const isFailed = c.isQualified === false;
                const isRegisteredOnly = c.attemptStatus === 'registered';

                return (
                  <div
                    key={`remote-cand-${c.attemptId || index}`}
                    className="p-3.5 rounded-xl border border-slate-800/90 bg-slate-900/80 hover:bg-slate-900 transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-white tracking-tight">{c.studentName}</h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {c.rollNumber || c.loginId}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            R{c.roundNumber} ({c.roundType})
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isWriting ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800 animate-pulse font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Writing • {formatTimeRemaining(c.secondsRemaining)}
                          </span>
                        ) : isRegisteredOnly ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            Not Started
                          </span>
                        ) : isPassed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Qualified
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800">
                            <XCircle className="w-3 h-3 text-rose-400" />
                            Not Qualified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                            {c.attemptStatus}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats bar & Quick proctor action buttons */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                      <div className="flex items-center gap-3 font-mono text-slate-400 text-[11px]">
                        <span>
                          Score: <strong className="text-white">{c.score !== null ? `${c.score}/${c.totalMarks}` : '—'}</strong>
                        </span>
                        {c.cheatingWarnings > 0 && (
                          <span className="text-rose-400 font-bold">
                            Warnings: {c.cheatingWarnings}
                          </span>
                        )}
                      </div>

                      {/* Proctor Action Triggers */}
                      <div className="flex items-center gap-1.5">
                        {isWriting && (
                          <>
                            <button
                              onClick={() => handleExtendTime(c.attemptId)}
                              className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all"
                              title="Add +5 minutes to this candidate"
                            >
                              +5 Mins
                            </button>
                            <button
                              onClick={() => handleForceSubmit(c.attemptId)}
                              className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 transition-all"
                              title="Force submit candidate attempt"
                            >
                              Submit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Broadcast Modal */}
      {broadcastModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-indigo-400" />
              <span>Broadcast Announcement</span>
            </h3>
            <p className="text-xs text-slate-400">
              This message will flash prominently across all active candidate screens immediately.
            </p>
            <Input
              placeholder="e.g. Please remain seated. 10 minutes left."
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white text-xs h-10"
              autoFocus
            />
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBroadcastModalOpen(false)}
                className="flex-1 bg-slate-800 border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleBroadcastAnnouncement}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                Broadcast
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <span>Change Remote PIN</span>
            </h3>
            <p className="text-xs text-slate-400">
              Set a new 4 to 12 digit operator PIN for accessing this exam remote control.
            </p>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="Enter new PIN"
              value={newPinInput}
              onChange={(e) => setNewPinInput(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white font-mono text-center text-base h-11"
              autoFocus
            />
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPinModalOpen(false)}
                className="flex-1 bg-slate-800 border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleUpdatePin}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold"
              >
                Save PIN
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamRemotePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">Loading Exam Remote Control...</div>}>
      <ExamRemoteContent />
    </React.Suspense>
  );
}
