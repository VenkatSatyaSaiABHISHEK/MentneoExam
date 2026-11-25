'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Radio,
  Users,
  Megaphone,
  Settings2,
  Play,
  Pause,
  StopCircle,
  FileEdit,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  RefreshCw,
  Copy,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  Eye,
  EyeOff,
  Send,
  X,
  Check,
  Award,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTimeRemaining } from '@/lib/utils';

// Double Confirmation Modal State
interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  confirmVariant: 'danger' | 'warning' | 'primary';
  onConfirm: () => Promise<void> | void;
}

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

  // Mobile App Navigation Tab: 'live' | 'students' | 'announce' | 'settings'
  const [activeNav, setActiveNav] = React.useState<'live' | 'students' | 'announce' | 'settings'>('live');

  // Remote telemetry state
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [remoteData, setRemoteData] = React.useState<any>(null);

  // Students Tab State
  const [studentSearch, setStudentSearch] = React.useState('');
  const [studentFilter, setStudentFilter] = React.useState<'all' | 'writing' | 'registered' | 'submitted' | 'qualified'>('all');

  // Announcement State
  const [announcementText, setAnnouncementText] = React.useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = React.useState(false);

  // Settings & PIN Edit State
  const [pinModalOpen, setPinModalOpen] = React.useState(false);
  const [newPinInput, setNewPinInput] = React.useState('');
  const [showCurrentPin, setShowCurrentPin] = React.useState(false);
  const [savingPin, setSavingPin] = React.useState(false);

  // Double Confirmation Modal State
  const [confirmModal, setConfirmModal] = React.useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    confirmVariant: 'primary',
    onConfirm: () => {},
  });
  const [confirmExecuting, setConfirmExecuting] = React.useState(false);

  // Restore cached PIN
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPin = sessionStorage.getItem(`remote_pin_${examSlugOrId}`);
      if (savedPin) {
        setPin(savedPin);
        setIsUnlocked(true);
      }
    }
  }, [examSlugOrId]);

  // Fetch telemetry from remote API
  const fetchRemoteData = React.useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const activePin =
        pin || (typeof window !== 'undefined' ? sessionStorage.getItem(`remote_pin_${examSlugOrId}`) : '') || '12345678';
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

  // Polling loop every 4 seconds when unlocked
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

  // Trigger double confirmation modal helper
  const promptConfirmation = (options: {
    title: string;
    description: string;
    confirmText: string;
    confirmVariant: 'danger' | 'warning' | 'primary';
    action: () => Promise<void> | void;
  }) => {
    setConfirmModal({
      isOpen: true,
      title: options.title,
      description: options.description,
      confirmText: options.confirmText,
      confirmVariant: options.confirmVariant,
      onConfirm: options.action,
    });
  };

  const handleExecuteConfirmedAction = async () => {
    setConfirmExecuting(true);
    try {
      await confirmModal.onConfirm();
    } catch {
      toast.error('Operation failed.');
    } finally {
      setConfirmExecuting(false);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // PIN Unlock submit
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    if (!clean) {
      setPinError('Please enter the remote access PIN.');
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
      toast.success('Remote Control Unlocked.');
    } catch {
      setPinError('Network verification failed. Please try again.');
    } finally {
      setVerifyingPin(false);
    }
  };

  // Lock remote and sign out
  const handleLockRemote = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`remote_pin_${examSlugOrId}`);
    }
    setPin('');
    setPinInput('');
    setIsUnlocked(false);
    toast.info('Remote locked.');
  };

  // Copy remote URL to clipboard
  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Remote URL copied to clipboard.');
    }
  };

  // Toggle admission with Double Confirmation
  const requestToggleAdmission = () => {
    if (!remoteData?.exam) return;
    const isCurrentlyLocked = Boolean(remoteData.exam.admission_locked);
    const targetLocked = !isCurrentlyLocked;

    promptConfirmation({
      title: targetLocked ? 'Confirm Stop Admissions' : 'Confirm Open Admissions',
      description: targetLocked
        ? 'Are you sure you want to CLOSE candidate admission? Candidates attempting to register or log in will be blocked until you reopen entry.'
        : 'Are you sure you want to OPEN candidate admission? Students with the exam link will be able to register and enter.',
      confirmText: targetLocked ? 'Yes, Close Admissions' : 'Yes, Open Admissions',
      confirmVariant: targetLocked ? 'danger' : 'primary',
      action: async () => {
        const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin,
            action: 'toggle_admission',
            data: { locked: targetLocked },
          }),
        });
        const json = await res.json();
        if (json.success) {
          setRemoteData((prev: any) => ({
            ...prev,
            exam: { ...prev.exam, admission_locked: targetLocked },
          }));
          toast.success(targetLocked ? 'Candidate admission closed.' : 'Candidate admission opened.');
        } else {
          toast.error(json.error || 'Failed to update admission status.');
        }
      },
    });
  };

  // Change exam status with Double Confirmation
  const requestSetStatus = (newStatus: 'live' | 'paused' | 'completed' | 'draft') => {
    if (!remoteData?.exam || remoteData.exam.status === newStatus) return;

    const descriptions: Record<string, string> = {
      live: 'Activate this examination session. Eligible candidates will be able to start and submit rounds.',
      paused: 'Pause this examination. Students will temporarily be blocked from progressing until resumed.',
      completed: 'Stop and conclude this examination session. All ongoing attempts will be finalized.',
      draft: 'Switch exam status back to DRAFT mode.',
    };

    const variants: Record<string, 'danger' | 'warning' | 'primary'> = {
      live: 'primary',
      paused: 'warning',
      completed: 'danger',
      draft: 'warning',
    };

    promptConfirmation({
      title: `Confirm Status Change: ${newStatus.toUpperCase()}`,
      description: descriptions[newStatus] || 'Change the operational state of this examination.',
      confirmText: `Yes, Set to ${newStatus.toUpperCase()}`,
      confirmVariant: variants[newStatus] || 'primary',
      action: async () => {
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
        if (json.success) {
          setRemoteData((prev: any) => ({
            ...prev,
            exam: { ...prev.exam, status: newStatus },
          }));
          toast.success(`Exam status set to ${newStatus.toUpperCase()}.`);
        } else {
          toast.error(json.error || 'Failed to update exam status.');
        }
      },
    });
  };

  // Broadcast announcement with Double Confirmation
  const requestBroadcastAnnouncement = () => {
    const text = announcementText.trim();
    if (!text) {
      toast.error('Please enter an announcement message.');
      return;
    }

    promptConfirmation({
      title: 'Confirm Proctor Public Announcement',
      description: `This message will immediately appear as an emergency banner on all candidate screens: "${text}"`,
      confirmText: 'Broadcast Alert Now',
      confirmVariant: 'primary',
      action: async () => {
        setSendingAnnouncement(true);
        try {
          const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pin,
              action: 'set_announcement',
              data: { message: text },
            }),
          });
          const json = await res.json();
          if (json.success) {
            setRemoteData((prev: any) => ({
              ...prev,
              exam: { ...prev.exam, emergency_announcement: text },
            }));
            setAnnouncementText('');
            toast.success('Emergency announcement broadcast to candidates.');
          } else {
            toast.error(json.error || 'Failed to broadcast announcement.');
          }
        } finally {
          setSendingAnnouncement(false);
        }
      },
    });
  };

  // Clear announcement with Double Confirmation
  const requestClearAnnouncement = () => {
    promptConfirmation({
      title: 'Clear Active Public Announcement',
      description: 'Remove the proctor emergency announcement banner from candidate screens?',
      confirmText: 'Yes, Clear Alert',
      confirmVariant: 'warning',
      action: async () => {
        const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin,
            action: 'set_announcement',
            data: { message: null },
          }),
        });
        const json = await res.json();
        if (json.success) {
          setRemoteData((prev: any) => ({
            ...prev,
            exam: { ...prev.exam, emergency_announcement: null },
          }));
          toast.success('Emergency alert banner cleared.');
        } else {
          toast.error(json.error || 'Failed to clear announcement.');
        }
      },
    });
  };

  // Grant +5 Minutes with Double Confirmation
  const requestExtendTime = (candidate: any) => {
    promptConfirmation({
      title: `Grant Extra Time (+5 Min)`,
      description: `Add +5 extra minutes to ${candidate.studentName} (${candidate.rollNumber})? Their deadline will be automatically extended on the server.`,
      confirmText: 'Yes, Grant +5 Min',
      confirmVariant: 'primary',
      action: async () => {
        const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin,
            action: 'extend_time',
            data: { attemptId: candidate.attemptId, minutes: 5 },
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(`Granted +5 minutes to ${candidate.studentName}.`);
          fetchRemoteData(true);
        } else {
          toast.error(json.error || 'Failed to grant time.');
        }
      },
    });
  };

  // Force Submit with Double Confirmation
  const requestForceSubmit = (candidate: any) => {
    promptConfirmation({
      title: `Confirm Force Submission`,
      description: `Are you sure you want to finalize and force-submit ${candidate.studentName}'s examination? Their current answers will be graded and the attempt locked immediately.`,
      confirmText: 'Yes, Force Submit',
      confirmVariant: 'danger',
      action: async () => {
        const res = await fetch(`/api/examinations/${examSlugOrId}/remote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin,
            action: 'force_submit',
            data: { attemptId: candidate.attemptId },
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(`Attempt force-submitted for ${candidate.studentName}.`);
          fetchRemoteData(true);
        } else {
          toast.error(json.error || 'Failed to force submit attempt.');
        }
      },
    });
  };

  // Update Remote PIN
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPinInput.trim();
    if (clean.length < 4 || clean.length > 12) {
      toast.error('PIN must be between 4 and 12 digits.');
      return;
    }

    setSavingPin(true);
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
      if (json.success) {
        setPin(clean);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`remote_pin_${examSlugOrId}`, clean);
        }
        setRemoteData((prev: any) => ({
          ...prev,
          exam: { ...prev.exam, remote_pin: clean },
        }));
        setPinModalOpen(false);
        setNewPinInput('');
        toast.success(`Remote access PIN updated to ${clean}`);
      } else {
        toast.error(json.error || 'Failed to update PIN.');
      }
    } finally {
      setSavingPin(false);
    }
  };

  // Generate random 6-digit PIN helper
  const generateRandomPin = () => {
    const random = Math.floor(100000 + Math.random() * 900000).toString();
    setNewPinInput(random);
  };

  // Candidate filtering
  const allCandidates = remoteData?.candidates || [];
  const filteredCandidates = allCandidates.filter((c: any) => {
    // Status filter
    if (studentFilter === 'writing' && c.attemptStatus !== 'in_progress') return false;
    if (studentFilter === 'registered' && c.attemptStatus !== 'registered') return false;
    if (studentFilter === 'submitted' && c.attemptStatus !== 'submitted' && c.attemptStatus !== 'timed_out') return false;
    if (studentFilter === 'qualified' && c.isQualified !== true) return false;

    // Search query
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      const name = (c.studentName || '').toLowerCase();
      const roll = (c.rollNumber || c.loginId || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      return name.includes(q) || roll.includes(q) || email.includes(q);
    }
    return true;
  });

  const writingCount = allCandidates.filter((c: any) => c.attemptStatus === 'in_progress').length;
  const registeredCount = allCandidates.filter((c: any) => c.attemptStatus === 'registered').length;
  const submittedCount = allCandidates.filter((c: any) => c.attemptStatus === 'submitted' || c.attemptStatus === 'timed_out').length;
  const qualifiedCount = allCandidates.filter((c: any) => c.isQualified === true).length;

  // 1. PIN Lock Screen (White & Classical)
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto shadow-xs">
            <Radio className="w-7 h-7 text-emerald-400" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Exam Remote Control</h1>
            <p className="text-xs text-slate-500 mt-1">
              Enter your authorized invigilator PIN to access examination controls.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                Remote Access PIN
              </label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={12}
                placeholder="Enter 4-8 digit PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
                className="text-center font-mono tracking-widest text-lg h-12 bg-slate-50 border-slate-200 focus:bg-white"
              />
              {pinError && <p className="text-xs text-rose-600 font-medium">{pinError}</p>}
            </div>

            <Button
              type="submit"
              disabled={verifyingPin}
              className="w-full h-11 bg-slate-900 hover:bg-black text-white text-xs font-semibold uppercase tracking-wider gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>{verifyingPin ? 'Verifying PIN...' : 'Unlock Remote'}</span>
            </Button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            PIN configured by super admin in examination settings. Default PIN is <span className="font-mono font-bold text-slate-600">12345678</span>.
          </div>
        </div>
      </div>
    );
  }

  const exam = remoteData?.exam || {};
  const isAdmissionLocked = Boolean(exam.admission_locked);
  const examStatus = exam.status || 'live';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Professional App Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div
                className={`w-3 h-3 rounded-full ${
                  examStatus === 'live'
                    ? 'bg-emerald-500 animate-pulse'
                    : examStatus === 'paused'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none truncate max-w-[190px]">
                  {exam.name || 'Mentneo Exam'}
                </h1>
                <Badge
                  variant={
                    examStatus === 'live'
                      ? 'success'
                      : examStatus === 'paused'
                      ? 'warning'
                      : 'neutral'
                  }
                  className="text-[9px] uppercase px-1.5 py-0 font-bold"
                >
                  {examStatus}
                </Badge>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">/{exam.slug || examSlugOrId}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchRemoteData()}
              disabled={refreshing}
              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              title="Copy Remote URL"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLockRemote}
              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
              title="Lock Remote"
            >
              <Lock className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area (Max Width for authentic mobile feel) */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Active Emergency Broadcast Notification Banner (if any) */}
        {exam.emergency_announcement && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2">
              <Megaphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <p className="font-bold text-[11px] uppercase tracking-wider text-amber-800">Live Broadcast to Candidates</p>
                <p className="text-xs text-amber-950 mt-0.5 leading-relaxed">{exam.emergency_announcement}</p>
              </div>
            </div>
            <button
              onClick={requestClearAnnouncement}
              className="text-[10px] uppercase font-bold text-amber-700 hover:text-rose-700 underline shrink-0 cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {/* ----------------- TAB 1: LIVE MONITOR ----------------- */}
        {activeNav === 'live' && (
          <div className="space-y-4">
            {/* Operational Status Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Examination Status
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-base font-bold text-slate-900 uppercase">{examStatus}</span>
                  <span className="text-xs text-slate-400">&bull;</span>
                  <span
                    className={`text-xs font-semibold ${
                      isAdmissionLocked ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {isAdmissionLocked ? 'Admissions Closed' : 'Admissions Open'}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveNav('settings')}
                className="text-xs font-semibold gap-1.5 border-slate-200 hover:bg-slate-50 h-8"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Change</span>
              </Button>
            </div>

            {/* Telemetry Metric Tiles (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Registered */}
              <div
                onClick={() => {
                  setStudentFilter('all');
                  setActiveNav('students');
                }}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span className="font-semibold uppercase text-[10px] tracking-wider">Registered</span>
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">
                  {allCandidates.length}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Total roster candidates</p>
              </div>

              {/* In Exam / Writing */}
              <div
                onClick={() => {
                  setStudentFilter('writing');
                  setActiveNav('students');
                }}
                className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs cursor-pointer hover:border-amber-300 transition-colors bg-gradient-to-br from-amber-50/40 to-white"
              >
                <div className="flex items-center justify-between text-amber-700 text-xs mb-1">
                  <span className="font-semibold uppercase text-[10px] tracking-wider">Writing Now</span>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                </div>
                <div className="text-2xl font-bold text-amber-900 tracking-tight">
                  {writingCount}
                </div>
                <p className="text-[10px] text-amber-700 mt-1">Active test takers</p>
              </div>

              {/* Submitted */}
              <div
                onClick={() => {
                  setStudentFilter('submitted');
                  setActiveNav('students');
                }}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span className="font-semibold uppercase text-[10px] tracking-wider">Submitted</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">
                  {submittedCount}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Finalized submissions</p>
              </div>

              {/* Qualified */}
              <div
                onClick={() => {
                  setStudentFilter('qualified');
                  setActiveNav('students');
                }}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span className="font-semibold uppercase text-[10px] tracking-wider">Qualified</span>
                  <Award className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">
                  {qualifiedCount}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Passed pass mark</p>
              </div>
            </div>

            {/* Candidate Admission Quick Access Banner */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isAdmissionLocked
                      ? 'bg-rose-50 text-rose-600 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  }`}
                >
                  {isAdmissionLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    {isAdmissionLocked ? 'Admissions Closed' : 'Admissions Open'}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {isAdmissionLocked
                      ? 'No new candidates can register or log in.'
                      : 'Any candidate with link can enter.'}
                  </p>
                </div>
              </div>

              <Button
                variant={isAdmissionLocked ? 'outline' : 'primary'}
                size="sm"
                onClick={requestToggleAdmission}
                className={`text-xs font-semibold h-8 uppercase tracking-wider ${
                  isAdmissionLocked
                    ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {isAdmissionLocked ? 'Reopen' : 'Stop'}
              </Button>
            </div>

            {/* Configured Examination Rounds */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Examination Rounds ({remoteData?.rounds?.length || 0})
                </span>
                <span className="text-[10px] text-slate-400">Sequential</span>
              </div>

              <div className="space-y-2">
                {(remoteData?.rounds || []).map((round: any, i: number) => (
                  <div
                    key={`round-${round.id || i}`}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        R{round.round_number || i + 1}: {round.name}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {round.duration_minutes}m &bull; {round.total_questions || 30} Qs &bull; Pass:{' '}
                        {round.qualifying_marks}m
                      </p>
                    </div>
                    <Badge variant="neutral" className="text-[10px] uppercase font-mono">
                      {round.round_type || 'mcq'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB 2: CANDIDATE ROSTER ----------------- */}
        {activeNav === 'students' && (
          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search candidates by name or roll number..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900 shadow-2xs"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                onClick={() => setStudentFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  studentFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All ({allCandidates.length})
              </button>
              <button
                onClick={() => setStudentFilter('writing')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  studentFilter === 'writing'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Writing ({writingCount})
              </button>
              <button
                onClick={() => setStudentFilter('registered')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  studentFilter === 'registered'
                    ? 'bg-slate-700 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Not Started ({registeredCount})
              </button>
              <button
                onClick={() => setStudentFilter('submitted')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  studentFilter === 'submitted'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Submitted ({submittedCount})
              </button>
              <button
                onClick={() => setStudentFilter('qualified')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  studentFilter === 'qualified'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Qualified ({qualifiedCount})
              </button>
            </div>

            {/* Candidate Cards List */}
            <div className="space-y-2.5">
              {filteredCandidates.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 space-y-1">
                  <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700 text-xs">No candidates match this filter</p>
                  <p className="text-[11px] text-slate-400">Try clearing the search or changing status tab.</p>
                </div>
              ) : (
                filteredCandidates.map((c: any) => {
                  const isWriting = c.attemptStatus === 'in_progress';
                  const isRegisteredOnly = c.attemptStatus === 'registered';
                  const isDone = c.attemptStatus === 'submitted' || c.attemptStatus === 'timed_out';

                  return (
                    <div
                      key={`candidate-card-${c.registrationId || c.attemptId}`}
                      className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-2.5 hover:border-slate-300 transition-colors"
                    >
                      {/* Candidate Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 leading-tight">
                            {c.studentName || 'Candidate'}
                          </h4>
                          <span className="font-mono text-[11px] text-slate-500 block mt-0.5">
                            {c.rollNumber || c.loginId}
                          </span>
                        </div>

                        <div>
                          {isWriting ? (
                            <Badge variant="warning" className="text-[10px] gap-1 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                              <span>Writing</span>
                            </Badge>
                          ) : isDone ? (
                            <Badge variant="success" className="text-[10px] font-semibold">
                              Submitted
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="text-[10px] font-semibold">
                              Not Started
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Candidate Meta Info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <div>
                          Round: <strong className="text-slate-800">R{c.roundNumber || 1}</strong>
                        </div>
                        {isWriting && c.secondsRemaining > 0 && (
                          <div className="flex items-center gap-1 font-mono text-amber-700 font-semibold">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimeRemaining(c.secondsRemaining)}</span>
                          </div>
                        )}
                        {isDone && c.score !== undefined && (
                          <div>
                            Score: <strong className="text-slate-900 font-mono">{c.score}</strong> / {c.totalMarks || 30}
                          </div>
                        )}
                        {c.cheatingWarnings > 0 && (
                          <Badge variant="danger" className="text-[9px] px-1.5 py-0">
                            {c.cheatingWarnings} Warnings
                          </Badge>
                        )}
                      </div>

                      {/* Quick Invigilator Actions (Double Confirmation) */}
                      {isWriting && (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => requestExtendTime(c)}
                            className="flex-1 text-[11px] h-7 font-semibold border-slate-200 hover:bg-slate-50"
                          >
                            +5 Min Time
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => requestForceSubmit(c)}
                            className="flex-1 text-[11px] h-7 font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            Force Submit
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB 3: PROCTOR ANNOUNCEMENT ----------------- */}
        {activeNav === 'announce' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Megaphone className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Proctor Public Announcement
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Broadcast an emergency notice or directive to all students writing this exam. It pops up instantly on their screens.
              </p>

              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="Type an announcement to broadcast to all candidate screens..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900 bg-slate-50/50 resize-none leading-relaxed"
                />

                {/* Quick Announcement Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quick Presets</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      '10 minutes remaining! Please review your answers.',
                      'Do not switch browser tabs. Focus is being monitored.',
                      'Maintain complete silence. Proctors are observing.',
                    ].map((preset, idx) => (
                      <button
                        key={`preset-${idx}`}
                        type="button"
                        onClick={() => setAnnouncementText(preset)}
                        className="text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium text-left transition-colors cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={requestBroadcastAnnouncement}
                  disabled={sendingAnnouncement || !announcementText.trim()}
                  className="w-full h-10 bg-slate-900 hover:bg-black text-white text-xs font-semibold uppercase tracking-wider gap-2 mt-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast to All Screens</span>
                </Button>
              </div>
            </div>

            {/* Current Active Announcement (if any) */}
            {exam.emergency_announcement && (
              <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-xs space-y-2 bg-amber-50/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    Currently Active Banner
                  </span>
                  <Badge variant="warning" className="text-[9px]">Active On Screens</Badge>
                </div>
                <p className="text-xs text-slate-800 font-medium leading-relaxed bg-white p-3 rounded-xl border border-amber-200">
                  {exam.emergency_announcement}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={requestClearAnnouncement}
                  className="w-full text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 h-8"
                >
                  Clear Active Banner
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB 4: SETTINGS & CONTROLS ----------------- */}
        {activeNav === 'settings' && (
          <div className="space-y-4">
            {/* Operational Status Controller with Double Confirmation */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Examination Status Control
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Changing status requires double confirmation to prevent accidental interruption.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => requestSetStatus('live')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    examStatus === 'live'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">LIVE</span>
                    <Play className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Active exam session</p>
                </button>

                <button
                  type="button"
                  onClick={() => requestSetStatus('paused')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    examStatus === 'paused'
                      ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">PAUSE</span>
                    <Pause className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Hold all progress</p>
                </button>

                <button
                  type="button"
                  onClick={() => requestSetStatus('completed')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    examStatus === 'completed'
                      ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-700">STOP</span>
                    <StopCircle className="w-3.5 h-3.5 text-rose-600" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Conclude exam</p>
                </button>

                <button
                  type="button"
                  onClick={() => requestSetStatus('draft')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    examStatus === 'draft'
                      ? 'border-slate-500 bg-slate-100 ring-2 ring-slate-400/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">DRAFT</span>
                    <FileEdit className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Set back to draft</p>
                </button>
              </div>
            </div>

            {/* Candidate Admission Gate (Stop Admissions) with Double Confirmation */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Candidate Admission Gate
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Stop new candidate registrations and entry without stopping the ongoing exam.
                  </p>
                </div>
                <Badge variant={isAdmissionLocked ? 'danger' : 'success'}>
                  {isAdmissionLocked ? 'Closed' : 'Open'}
                </Badge>
              </div>

              <Button
                variant={isAdmissionLocked ? 'outline' : 'primary'}
                onClick={requestToggleAdmission}
                className={`w-full h-10 text-xs font-semibold uppercase tracking-wider gap-2 ${
                  isAdmissionLocked
                    ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {isAdmissionLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{isAdmissionLocked ? 'Reopen Candidate Admissions' : 'Stop Candidate Admissions'}</span>
              </Button>
            </div>

            {/* Remote PIN Management */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Invigilator Remote PIN
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Security PIN required to access this remote control console.
                  </p>
                </div>
                <KeyRound className="w-4 h-4 text-slate-400" />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-semibold block">Current PIN</span>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {showCurrentPin ? exam.remote_pin || pin : '••••••••'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                    className="h-8 w-8 p-0 text-slate-500"
                  >
                    {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewPinInput(exam.remote_pin || pin || '12345678');
                      setPinModalOpen(true);
                    }}
                    className="text-xs font-semibold h-8"
                  >
                    Edit PIN
                  </Button>
                </div>
              </div>
            </div>

            {/* External Quick Links */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Administrative Shortcuts
              </span>

              <a
                href={`/exam/admin/examinations/${exam.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
              >
                <span>Full Examination Admin Console</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <a
                href={`/exam/admin/examinations/${exam.id}/students`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
              >
                <span>Candidate Roster & Credentials</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <a
                href={`/exam/admin/examinations/${exam.id}/results`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
              >
                <span>Official Results Dossier</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            </div>
          </div>
        )}
      </main>

      {/* ----------------- LOWER APP MENU (FIXED BOTTOM NAVIGATION) ----------------- */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-4 h-16">
          <button
            type="button"
            onClick={() => setActiveNav('live')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeNav === 'live' ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Radio className={`w-5 h-5 ${activeNav === 'live' ? 'text-slate-900 stroke-[2.5]' : ''}`} />
            <span className="text-[10px] tracking-tight">Live</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav('students')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeNav === 'students' ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Users className={`w-5 h-5 ${activeNav === 'students' ? 'text-slate-900 stroke-[2.5]' : ''}`} />
            <span className="text-[10px] tracking-tight">Students</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav('announce')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeNav === 'announce' ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Megaphone className={`w-5 h-5 ${activeNav === 'announce' ? 'text-slate-900 stroke-[2.5]' : ''}`} />
            <span className="text-[10px] tracking-tight">Announce</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav('settings')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeNav === 'settings' ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Settings2 className={`w-5 h-5 ${activeNav === 'settings' ? 'text-slate-900 stroke-[2.5]' : ''}`} />
            <span className="text-[10px] tracking-tight">Settings</span>
          </button>
        </div>
      </nav>

      {/* ----------------- DOUBLE CONFIRMATION MODAL ----------------- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.confirmVariant === 'danger'
                    ? 'bg-rose-50 text-rose-600'
                    : confirmModal.confirmVariant === 'warning'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">{confirmModal.title}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{confirmModal.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                disabled={confirmExecuting}
                className="flex-1 text-xs font-semibold h-9"
              >
                Cancel
              </Button>

              <Button
                size="sm"
                onClick={handleExecuteConfirmedAction}
                disabled={confirmExecuting}
                className={`flex-1 text-xs font-semibold h-9 text-white ${
                  confirmModal.confirmVariant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : confirmModal.confirmVariant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-slate-900 hover:bg-black'
                }`}
              >
                {confirmExecuting ? 'Processing...' : confirmModal.confirmText}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- EDIT REMOTE PIN MODAL ----------------- */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Change Remote PIN</h3>
              </div>
              <button
                onClick={() => setPinModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePin} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                  New 4-12 Digit PIN
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="Enter new PIN"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  className="font-mono text-center tracking-widest text-lg h-11"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={generateRandomPin}
                  className="text-xs text-indigo-600 font-semibold hover:underline cursor-pointer"
                >
                  Generate Random 6-Digit PIN
                </button>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPinModalOpen(false)}
                  className="flex-1 text-xs font-semibold h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingPin || !newPinInput.trim()}
                  className="flex-1 text-xs font-semibold h-9 bg-slate-900 hover:bg-black text-white"
                >
                  {savingPin ? 'Saving...' : 'Save PIN'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamRemotePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="text-xs font-semibold text-slate-400 animate-pulse">
            Connecting to Examination Remote Engine...
          </div>
        </div>
      }
    >
      <ExamRemoteContent />
    </React.Suspense>
  );
}
