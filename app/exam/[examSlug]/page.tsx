'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/common/navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Layers,
  Clock,
  Award,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  UserCheck,
  KeyRound,
  AlertCircle,
  RotateCcw,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Examination, ExaminationRound, Student } from '@/types';
import { formatDuration } from '@/lib/utils';

function ExamRegistrationContent() {
  const params = useParams();
  const router = useRouter();
  const slug = params.examSlug as string;

  const [exam, setExam] = React.useState<Examination | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  // Roster-based Login Authentication State
  const [loginIdInput, setLoginIdInput] = React.useState('');
  const [loginError, setLoginError] = React.useState('');
  const [verifiedStudent, setVerifiedStudent] = React.useState<Student | null>(null);
  const [verifiedRegId, setVerifiedRegId] = React.useState<string | null>(null);

  // Open Registration Form State (used when auth_mode === 'open')
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [rollNumber, setRollNumber] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [branch, setBranch] = React.useState('');
  const [specialization, setSpecialization] = React.useState('');
  const [college, setCollege] = React.useState('');
  const [yearOfStudy, setYearOfStudy] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [registeredRegId, setRegisteredRegId] = React.useState<string | null>(null);
  const [storedStudentData, setStoredStudentData] = React.useState<Student | null>(null);
  const [hasCompletedAttempt, setHasCompletedAttempt] = React.useState(false);
  const [completedAttemptId, setCompletedAttemptId] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadExam() {
      try {
        setLoading(true);
        const res = await fetch(`/api/examinations/by-slug/${slug}`);
        const json = await res.json();
        if (json.success && json.data) {
          const found = json.data;
          setExam(found);

          // Check localStorage for existing session
          const savedReg = localStorage.getItem(`exam_reg_${found.id}`);
          const savedStudent = localStorage.getItem(`exam_student_${found.id}`);
          if (savedReg) {
            setRegisteredRegId(savedReg);
            if (savedStudent) {
              try {
                setStoredStudentData(JSON.parse(savedStudent));
              } catch {
                // ignore
              }
            }

            // Check if this candidate has already completed an attempt (prevent rewrite)
            try {
              const resCheck = await fetch(`/api/examinations/${found.id}/results`);
              const resJson = await resCheck.json();
              if (resJson.success && Array.isArray(resJson.data)) {
                const foundResult = resJson.data.find((r: any) => r.registration_id === savedReg);
                if (foundResult) {
                  setHasCompletedAttempt(true);
                  setCompletedAttemptId(foundResult.attempt_id);
                }
              }
            } catch {}
          }
        }
      } catch {
        toast.error('Failed to load examination details.');
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [slug]);

  // Handler for Roster Mode Login ID Verification
  const handleVerifyLoginId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exam) return;

    const trimmed = loginIdInput.trim();
    if (!trimmed) {
      setLoginError(`Please enter your ${exam.login_identifier_label || 'Login ID'}`);
      return;
    }

    setLoginError('');
    setSubmitting(true);

    try {
      const res = await fetch(`/api/examinations/${exam.id}/verify-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: trimmed }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.verified) {
        setLoginError(
          data.error ||
            `Candidate identifier "${trimmed}" was not found in the authorized roster for this examination.`
        );
        return;
      }

      setVerifiedStudent(data.data.student);
      setVerifiedRegId(data.data.registrationId);

      if (data.hasCompletedAttempt && data.completedAttemptId) {
        setHasCompletedAttempt(true);
        setCompletedAttemptId(data.completedAttemptId);
        toast.info('You have already submitted this examination. Re-attempts are prohibited.');
      } else {
        toast.success('Candidate identity verified.');
      }
    } catch {
      setLoginError('Network verification error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm verified identity and proceed to instructions
  const handleConfirmAndProceed = () => {
    if (!exam || !verifiedStudent || !verifiedRegId) return;

    localStorage.setItem(`exam_reg_${exam.id}`, verifiedRegId);
    localStorage.setItem(`exam_student_${exam.id}`, JSON.stringify(verifiedStudent));
    setRegisteredRegId(verifiedRegId);
    setStoredStudentData(verifiedStudent);
    router.push(`/exam/${slug}/instructions`);
  };

  // Handler for Open Registration Form
  const handleOpenRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exam) return;

    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Valid email is required';
    }
    if (!rollNumber.trim()) newErrors.rollNumber = 'Roll number is required';

    const configuredFields = exam.registration_fields || [];
    for (const field of configuredFields) {
      if (field.enabled && field.required) {
        if (field.key === 'phone' && !phone.trim()) {
          newErrors.phone = `${field.label || 'Phone number'} is required`;
        }
        if (field.key === 'branch' && !branch.trim()) {
          newErrors.branch = `${field.label || 'Branch / Department'} is required`;
        }
        if (field.key === 'specialization' && !specialization.trim()) {
          newErrors.specialization = `${field.label || 'Specialization'} is required`;
        }
        if (field.key === 'college' && !college.trim()) {
          newErrors.college = `${field.label || 'College name'} is required`;
        }
        if (field.key === 'year_of_study' && !yearOfStudy.trim()) {
          newErrors.yearOfStudy = `${field.label || 'Year / Semester'} is required`;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const res = await fetch('/api/students/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: exam.id,
          fullName: fullName.trim(),
          email: email.trim(),
          rollNumber: rollNumber.trim(),
          phone: phone.trim() || undefined,
          branch: branch.trim() || undefined,
          specialization: specialization.trim() || undefined,
          college: college.trim() || undefined,
          yearOfStudy: yearOfStudy.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Registration failed.');
        return;
      }

      const regId = data.data.registrationId;
      localStorage.setItem(`exam_reg_${exam.id}`, regId);
      localStorage.setItem(`exam_student_${exam.id}`, JSON.stringify(data.data.student));
      setRegisteredRegId(regId);
      setStoredStudentData(data.data.student);
      toast.success(data.data.isNew ? 'Registration completed successfully.' : 'Registration confirmed and verified.');
    } catch {
      toast.error('Network error during registration.');
    } finally {
      setSubmitting(false);
    }
  };

  // Sign out / reset candidate session
  const handleSwitchCandidate = () => {
    if (exam) {
      localStorage.removeItem(`exam_reg_${exam.id}`);
      localStorage.removeItem(`exam_student_${exam.id}`);
    }
    setRegisteredRegId(null);
    setStoredStudentData(null);
    setVerifiedStudent(null);
    setVerifiedRegId(null);
    setLoginIdInput('');
    setLoginError('');
    setFullName('');
    setEmail('');
    setRollNumber('');
    setPhone('');
    setBranch('');
    setSpecialization('');
    setCollege('');
    setYearOfStudy('');
    setErrors({});
  };

  const handleProceedToInstructions = () => {
    router.push(`/exam/${slug}/instructions`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/50">
        <Navbar />
        <div className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-12 animate-pulse space-y-6">
          <div className="h-8 w-2/5 bg-gray-200 rounded-md" />
          <div className="h-4 w-4/5 bg-gray-200 rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="h-64 bg-gray-200 rounded-xl" />
            <div className="h-64 bg-gray-200 rounded-xl col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/50">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <ShieldAlert className="w-12 h-12 text-gray-400 mb-3" />
          <h2 className="text-xl font-bold text-gray-900">Examination Not Found</h2>
          <p className="mt-1 text-sm text-gray-500 max-w-sm">
            The requested examination slug &quot;{slug}&quot; does not exist or has been archived.
          </p>
          <Button variant="outline" size="sm" className="mt-6" onClick={() => router.push('/exam')}>
            Return to Mentneo Portal
          </Button>
        </div>
      </div>
    );
  }

  const rounds = (exam.rounds || []).sort((a: ExaminationRound, b: ExaminationRound) => a.round_number - b.round_number);
  const isRosterAuth = (exam.auth_mode ?? 'roster') === 'roster';
  const loginIdentifierLabel = exam.login_identifier_label || exam.login_identifier_field || 'Roll Number';

  const registrationFields = exam.registration_fields || [];
  const showPhone = registrationFields.some((f) => f.key === 'phone' && f.enabled);
  const reqPhone = registrationFields.some((f) => f.key === 'phone' && f.enabled && f.required);
  const labelPhone = registrationFields.find((f) => f.key === 'phone')?.label || 'Phone Number';

  const showBranch = registrationFields.some((f) => f.key === 'branch' && f.enabled);
  const reqBranch = registrationFields.some((f) => f.key === 'branch' && f.enabled && f.required);
  const labelBranch = registrationFields.find((f) => f.key === 'branch')?.label || 'Branch / Department';

  const showSpec = registrationFields.some((f) => f.key === 'specialization' && f.enabled);
  const reqSpec = registrationFields.some((f) => f.key === 'specialization' && f.enabled && f.required);
  const labelSpec = registrationFields.find((f) => f.key === 'specialization')?.label || 'Specialization';

  const showCollege = registrationFields.some((f) => f.key === 'college' && f.enabled);
  const reqCollege = registrationFields.some((f) => f.key === 'college' && f.enabled && f.required);
  const labelCollege = registrationFields.find((f) => f.key === 'college')?.label || 'College / University';

  const showYear = registrationFields.some((f) => f.key === 'year_of_study' && f.enabled);
  const reqYear = registrationFields.some((f) => f.key === 'year_of_study' && f.enabled && f.required);
  const labelYear = registrationFields.find((f) => f.key === 'year_of_study')?.label || 'Year / Semester';

  const totalDuration = rounds.reduce((acc: number, r: ExaminationRound) => acc + r.duration_minutes, 0);
  const totalMarks = rounds.reduce((acc: number, r: ExaminationRound) => acc + Number(r.total_marks), 0);

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-[#faf9fe] dark:bg-[#0d0c1d] text-[#1d1a4a] dark:text-[#f4f3ff] transition-colors">
      <Navbar />

      <main className="flex-1 w-full px-4 sm:px-8 lg:px-12 py-4 sm:py-6 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Card: Examination Overview & Configured Rounds */}
          <div className="lg:col-span-7 flex flex-col min-h-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 shadow-xs">
            {/* Top Examination Meta */}
            <div className="shrink-0 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <Badge variant={exam.status === 'live' ? 'success' : 'neutral'} size="sm">
                  Status: {exam.status}
                </Badge>
                <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">/{exam.slug}</span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                {exam.name}
              </h1>
              {exam.description && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                  {exam.description}
                </p>
              )}

              {/* Badges row */}
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700/60">
                  <Layers className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="font-semibold">{rounds.length} Dynamic Rounds</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700/60">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="font-semibold">{formatDuration(totalDuration)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700/60">
                  <Award className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="font-semibold">{totalMarks} Total Marks</span>
                </div>
              </div>
            </div>

            {/* Configured Rounds Header */}
            <div className="mt-3 flex items-center justify-between shrink-0 mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Configured Rounds</h2>
              <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">Sequential Qualification</span>
            </div>

            {/* Rounds List */}
            <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-0">
              {rounds.map((round: ExaminationRound) => (
                <div
                  key={round.id}
                  className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-white dark:hover:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
                        {round.round_number}
                      </span>
                      <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{round.name}</h3>
                    </div>
                    <Badge variant={round.status === 'active' ? 'success' : 'neutral'} size="sm" className="shrink-0 text-[10px]">
                      {round.status}
                    </Badge>
                  </div>

                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 py-1.5 px-2.5 bg-white dark:bg-zinc-900 rounded border border-zinc-100 dark:border-zinc-800 text-[11px]">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block font-medium">Duration</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{round.duration_minutes}m</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block font-medium">Questions</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{round.total_questions} MCQs</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block font-medium">Marks / Q</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">+{round.marks_per_question} / -{round.negative_marks}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block font-medium">Qualifying</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">{round.qualifying_marks} / {round.total_marks}</span>
                    </div>
                  </div>

                  {round.instructions && (
                    <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 leading-normal">
                      {round.instructions}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Card: Candidate Admission & Authentication */}
          <div className="lg:col-span-5 flex flex-col justify-start">
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs h-full flex flex-col justify-between">
              <div>
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    <UserCheck className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                    <span>Student Admission</span>
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-bold mt-1">
                    {isRosterAuth ? 'Candidate Authentication' : 'Candidate Registration'}
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {isRosterAuth
                      ? `Enter your assigned ${loginIdentifierLabel} to verify your examination authorization.`
                      : 'Enter your credentials to register and take this examination.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-1 space-y-3">
                {/* 1. Already Logged In / Verified in LocalStorage */}
                {registeredRegId ? (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-emerald-900">Candidate Identity Confirmed</p>
                          <p className="mt-0.5 text-emerald-700">
                            You are verified and authorized for this examination.
                          </p>
                        </div>
                      </div>

                      {storedStudentData && (
                        <div className="pt-2 border-t border-emerald-200/60 space-y-1.5 text-[11px] text-emerald-950">
                          <div>Candidate: <strong>{storedStudentData.full_name}</strong></div>
                          <div>{loginIdentifierLabel}: <strong className="font-mono">{storedStudentData.login_id || storedStudentData.roll_number}</strong></div>
                          <div>Email: {storedStudentData.email}</div>
                          {storedStudentData.phone && <div>Phone: <span className="font-mono">{storedStudentData.phone}</span></div>}
                          {storedStudentData.branch && <div>Branch: <strong>{storedStudentData.branch}</strong></div>}
                          {storedStudentData.specialization && <div>Specialization: <strong>{storedStudentData.specialization}</strong></div>}
                          {storedStudentData.college && <div>College: {storedStudentData.college}</div>}
                          {storedStudentData.year_of_study && <div>Year / Sem: {storedStudentData.year_of_study}</div>}
                          {storedStudentData.attributes && Object.keys(storedStudentData.attributes).length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {Object.entries(storedStudentData.attributes).map(([k, v]) => (
                                <span key={k} className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px]">
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {hasCompletedAttempt ? (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900 space-y-1">
                          <p className="font-bold flex items-center gap-1.5 text-amber-950">
                            <ShieldAlert className="w-4 h-4 text-amber-600" />
                            <span>Examination Already Completed</span>
                          </p>
                          <p className="text-[11px] text-amber-800">
                            You have already finalized and submitted this examination. Retakes and duplicate submissions are strictly prohibited by examination policy.
                          </p>
                        </div>

                        <Button
                          onClick={() => router.push(`/exam/${slug}/result?attemptId=${completedAttemptId}`)}
                          className="w-full text-xs font-semibold uppercase tracking-wider gap-2 h-10 font-mono"
                        >
                          <span>View Examination Results</span>
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={handleProceedToInstructions}
                        className="w-full text-xs font-semibold uppercase tracking-wider gap-2 h-10"
                      >
                        <span>Proceed to Instructions</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={handleSwitchCandidate}
                      className="w-full text-center text-xs text-gray-500 hover:text-gray-900 py-1 transition-colors cursor-pointer"
                    >
                      Switch Candidate / Enter Different ID
                    </button>
                  </div>
                ) : isRosterAuth ? (
                  /* 2. Roster Mode: Step 1 or Step 2 */
                  verifiedStudent ? (
                    /* Step 2: Verification Review Screen */
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-xs space-y-2">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Candidate Record Found</span>
                        </div>

                        <div className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                          <div>
                            <span className="text-[10px] uppercase text-zinc-400 dark:text-zinc-500 font-semibold block">Full Name</span>
                            <span className="font-bold text-zinc-900 dark:text-white text-sm">{verifiedStudent.full_name}</span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-zinc-400 dark:text-zinc-500 font-semibold block">
                              {loginIdentifierLabel}
                            </span>
                            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                              {verifiedStudent.login_id || verifiedStudent.roll_number}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-zinc-400 dark:text-zinc-500 font-semibold block">Official Email</span>
                            <span className="text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">{verifiedStudent.email}</span>
                          </div>

                          {verifiedStudent.attributes && Object.keys(verifiedStudent.attributes).length > 0 && (
                            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                              <span className="text-[10px] uppercase text-zinc-400 dark:text-zinc-500 font-semibold block mb-1">
                                Roster Metadata
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(verifiedStudent.attributes).map(([k, v]) => (
                                  <span key={k} className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-[10px] text-zinc-700 dark:text-zinc-300 font-medium">
                                    {k}: {String(v)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        onClick={handleConfirmAndProceed}
                        className="w-full text-xs font-semibold uppercase tracking-wider gap-2 h-10"
                      >
                        <span>Confirm & Enter Examination</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>

                      <button
                        type="button"
                        onClick={() => {
                          setVerifiedStudent(null);
                          setVerifiedRegId(null);
                        }}
                        className="w-full text-center text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white py-1 transition-colors cursor-pointer"
                      >
                        Not you? Enter a different ID
                      </button>
                    </div>
                  ) : (
                    /* Step 1: Login ID Input Form */
                    <form onSubmit={handleVerifyLoginId} className="space-y-3">
                      <div>
                        <Input
                          label={loginIdentifierLabel}
                          placeholder={`Enter your ${loginIdentifierLabel.toLowerCase()} (e.g. CS2026-042)`}
                          value={loginIdInput}
                          onChange={(e) => {
                            setLoginIdInput(e.target.value);
                            setLoginError('');
                          }}
                          required
                          autoFocus
                        />
                        <p className="mt-1.5 text-[11px] text-gray-500">
                          Please enter the identifier registered in your official student roster.
                        </p>
                      </div>

                      {loginError && (
                        <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>{loginError}</span>
                        </div>
                      )}

                      <Button
                        type="submit"
                        isLoading={submitting}
                        className="w-full text-xs font-semibold uppercase tracking-wider gap-2 h-10"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>Verify & Enter Examination</span>
                      </Button>

                      <p className="text-[11px] text-gray-400 text-center">
                        This examination requires pre-authorized admission credentials. Proctoring telemetry is enforced.
                      </p>
                    </form>
                  )
                ) : (
                  /* 3. Open Registration Mode */
                  <form onSubmit={handleOpenRegisterSubmit} className="space-y-3.5">
                    <Input
                      label="Candidate Full Name"
                      placeholder="e.g. Aarav Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      error={errors.fullName}
                      required
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Official Email Address"
                        type="email"
                        placeholder="e.g. aarav@example.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={errors.email}
                        required
                      />

                      <Input
                        label={loginIdentifierLabel}
                        placeholder="e.g. CS2026-042"
                        value={rollNumber}
                        onChange={(e) => setRollNumber(e.target.value)}
                        error={errors.rollNumber}
                        required
                      />
                    </div>

                    {(showPhone || showBranch) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {showPhone && (
                          <Input
                            label={`${labelPhone}${reqPhone ? '' : ' (Optional)'}`}
                            type="tel"
                            placeholder="e.g. +91 9876543210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            error={errors.phone}
                            required={reqPhone}
                          />
                        )}
                        {showBranch && (
                          <Input
                            label={`${labelBranch}${reqBranch ? '' : ' (Optional)'}`}
                            placeholder="e.g. Computer Science, ECE, IT"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            error={errors.branch}
                            required={reqBranch}
                          />
                        )}
                      </div>
                    )}

                    {(showSpec || showCollege) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {showSpec && (
                          <Input
                            label={`${labelSpec}${reqSpec ? '' : ' (Optional)'}`}
                            placeholder="e.g. AI & ML, Data Science"
                            value={specialization}
                            onChange={(e) => setSpecialization(e.target.value)}
                            error={errors.specialization}
                            required={reqSpec}
                          />
                        )}
                        {showCollege && (
                          <Input
                            label={`${labelCollege}${reqCollege ? '' : ' (Optional)'}`}
                            placeholder="e.g. College of Engineering"
                            value={college}
                            onChange={(e) => setCollege(e.target.value)}
                            error={errors.college}
                            required={reqCollege}
                          />
                        )}
                      </div>
                    )}

                    {showYear && (
                      <Input
                        label={`${labelYear}${reqYear ? '' : ' (Optional)'}`}
                        placeholder="e.g. 3rd Year / 6th Semester"
                        value={yearOfStudy}
                        onChange={(e) => setYearOfStudy(e.target.value)}
                        error={errors.yearOfStudy}
                        required={reqYear}
                      />
                    )}

                    <div className="pt-2">
                      <Button
                        type="submit"
                        isLoading={submitting}
                        className="w-full text-xs font-semibold uppercase tracking-wider gap-2 h-10"
                      >
                        <span>Register & Enter Examination</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>

                    <p className="text-[11px] text-gray-400 text-center">
                      By registering, you acknowledge that proctoring telemetry will monitor browser focus and window state.
                    </p>
                  </form>
                )}
              </CardContent>
            </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ExamRegistrationPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">
          Loading candidate portal...
        </div>
      }
    >
      <ExamRegistrationContent />
    </React.Suspense>
  );
}
