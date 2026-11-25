'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import {
  ChevronLeft,
  Search,
  Download,
  Upload,
  UserCheck,
  ShieldCheck,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Settings2,
  Plus,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Registration, Examination, RegistrationFieldConfig } from '@/types';

function AdminStudentsContent() {
  const params = useParams();
  const examId = params.examId as string;

  const [exam, setExam] = React.useState<Examination | null>(null);
  const [registrations, setRegistrations] = React.useState<Registration[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');

  // Add Single Candidate Modal State
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [addFullName, setAddFullName] = React.useState('');
  const [addRollNumber, setAddRollNumber] = React.useState('');
  const [addEmail, setAddEmail] = React.useState('');
  const [addPhone, setAddPhone] = React.useState('');
  const [addBranch, setAddBranch] = React.useState('');
  const [addSpec, setAddSpec] = React.useState('');
  const [savingCandidate, setSavingCandidate] = React.useState(false);

  // Import Modal State
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [parsedRows, setParsedRows] = React.useState<any[]>([]);
  const [detectedColumns, setDetectedColumns] = React.useState<string[]>([]);
  const [loginField, setLoginField] = React.useState('');
  const [loginLabel, setLoginLabel] = React.useState('');
  const [nameField, setNameField] = React.useState('');
  const [emailField, setEmailField] = React.useState('');
  const [replaceExisting, setReplaceExisting] = React.useState(true);
  const [importing, setImporting] = React.useState(false);

  // Clear Roster Modal State
  const [clearModalOpen, setClearModalOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  // Auth Mode Modal State
  const [settingsModalOpen, setSettingsModalOpen] = React.useState(false);
  const [targetAuthMode, setTargetAuthMode] = React.useState<'roster' | 'open'>('roster');
  const [customLoginLabel, setCustomLoginLabel] = React.useState('');
  const [targetRegFields, setTargetRegFields] = React.useState<RegistrationFieldConfig[]>([
    { key: 'phone', label: 'Phone Number', required: true, enabled: true },
    { key: 'branch', label: 'Branch / Department', required: true, enabled: true },
    { key: 'specialization', label: 'Specialization', required: false, enabled: true },
    { key: 'college', label: 'College / University', required: false, enabled: false },
    { key: 'year_of_study', label: 'Year / Semester', required: false, enabled: false },
  ]);
  const [savingSettings, setSavingSettings] = React.useState(false);

  const fetchExamAndStudents = async () => {
    try {
      setLoading(true);

      // Check localStorage for cached candidate roster
      let localRegs: Registration[] = [];
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`mentneo_students_${examId}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              localRegs = parsed;
              setRegistrations(parsed);
            }
          }
        } catch {}
      }

      // Fetch exam details
      const examRes = await fetch(`/api/examinations/${examId}`);
      const examJson = await examRes.json();
      if (examJson.success && examJson.data) {
        setExam(examJson.data);
        setTargetAuthMode(examJson.data.auth_mode || 'roster');
        setCustomLoginLabel(examJson.data.login_identifier_label || examJson.data.login_identifier_field || 'Candidate Roll Number');
        if (Array.isArray(examJson.data.registration_fields) && examJson.data.registration_fields.length > 0) {
          setTargetRegFields(examJson.data.registration_fields);
        }
      }

      // Fetch students
      const res = await fetch(`/api/examinations/${examId}/students`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRegistrations(json.data);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`mentneo_students_${examId}`, JSON.stringify(json.data));
          } catch {}
        }
      }
    } catch {
      toast.error('Failed to load registered candidates.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchExamAndStudents();
    const interval = setInterval(() => {
      fetchExamAndStudents();
    }, 8000);
    return () => clearInterval(interval);
  }, [examId]);

  // Handle spreadsheet file selection and browser parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (json.length === 0) {
          toast.error('Spreadsheet is empty or could not be read.');
          return;
        }

        const columns = Object.keys(json[0]);
        setParsedRows(json);
        setDetectedColumns(columns);

        // Smart column auto-detection
        const autoLogin = columns.find((c) => /roll|reg|id|login|code|enrollment/i.test(c)) || columns[1] || columns[0];
        const autoName = columns.find((c) => /name|candidate|student/i.test(c)) || columns[0];
        const autoEmail = columns.find((c) => /email|mail/i.test(c)) || '';

        setLoginField(autoLogin);
        setLoginLabel(autoLogin.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()));
        setNameField(autoName);
        setEmailField(autoEmail);
      } catch (err) {
        console.error('File parsing error:', err);
        toast.error('Failed to parse spreadsheet file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Submit roster import to backend
  const handleConfirmImport = async () => {
    if (!loginField || !nameField) {
      toast.error('Please map the Candidate Name and Login ID fields.');
      return;
    }

    if (parsedRows.length === 0) {
      toast.error('No candidate records found to import.');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`/api/examinations/${examId}/import-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: parsedRows,
          loginIdentifierField: loginField,
          loginIdentifierLabel: loginLabel || loginField,
          nameField,
          emailField: emailField || undefined,
          authMode: 'roster',
          replaceExisting,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Import failed.');
        return;
      }

      if (Array.isArray(json.registrations) && json.registrations.length > 0) {
        setRegistrations(json.registrations);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`mentneo_students_${examId}`, JSON.stringify(json.registrations));
          } catch {}
        }
      }

      toast.success(`Successfully imported ${json.data.importedCount} candidates into the examination roster.`);
      setImportModalOpen(false);
      setSelectedFile(null);
      setParsedRows([]);
      fetchExamAndStudents();
    } catch {
      toast.error('Network error during roster import.');
    } finally {
      setImporting(false);
    }
  };

  // Add individual candidate manually
  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const roll = addRollNumber.trim();
    if (!roll) {
      toast.error('Candidate identifier / Roll Number is required.');
      return;
    }

    setSavingCandidate(true);
    try {
      const res = await fetch(`/api/examinations/${examId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: addFullName.trim() || `Candidate ${roll}`,
          rollNumber: roll,
          email: addEmail.trim(),
          phone: addPhone.trim() || undefined,
          branch: addBranch.trim() || undefined,
          specialization: addSpec.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const newReg: Registration = data.data || {
          id: `reg-${examId}-${Date.now()}`,
          examination_id: examId,
          student_id: data.student?.id || `student-${roll}`,
          login_id: roll,
          registered_at: new Date().toISOString(),
          status: 'registered',
          student: data.student || {
            id: `student-${roll}`,
            full_name: addFullName.trim() || `Candidate ${roll}`,
            roll_number: roll,
            login_id: roll,
            email: addEmail.trim(),
            created_at: new Date().toISOString(),
          },
        };

        const updated = Array.isArray(data.registrations) && data.registrations.length > 0
          ? data.registrations
          : [newReg, ...registrations.filter((r) => r.login_id !== roll)];

        setRegistrations(updated);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`mentneo_students_${examId}`, JSON.stringify(updated));
          } catch {}
        }

        toast.success(`Candidate ${addFullName.trim() || roll} enrolled in roster.`);
        setAddModalOpen(false);
        setAddFullName('');
        setAddRollNumber('');
        setAddEmail('');
      } else {
        toast.error(data.error || 'Failed to add candidate.');
      }
    } catch {
      toast.error('Network error adding candidate.');
    } finally {
      setSavingCandidate(false);
    }
  };

  // Remove individual candidate
  const handleDeleteCandidate = async (regId: string, roll: string) => {
    if (!confirm(`Are you sure you want to remove candidate "${roll}" from the roster?`)) return;

    try {
      await fetch(`/api/examinations/${examId}/students?id=${regId}`, {
        method: 'DELETE',
      });
      const updated = registrations.filter((r) => r.id !== regId);
      setRegistrations(updated);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`mentneo_students_${examId}`, JSON.stringify(updated));
        } catch {}
      }
      toast.success('Candidate removed from roster.');
    } catch {
      toast.error('Failed to remove candidate.');
    }
  };

  // Clear all candidates in this exam's roster
  const handleClearRoster = async () => {
    setClearing(true);
    try {
      const res = await fetch(`/api/examinations/${examId}/clear-students`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setRegistrations([]);
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(`mentneo_students_${examId}`);
          } catch {}
        }
        toast.success('Examination roster cleared.');
        setClearModalOpen(false);
        fetchExamAndStudents();
      } else {
        toast.error(json.error || 'Failed to clear roster.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setClearing(false);
    }
  };

  // Update Exam Auth Configuration
  const handleSaveAuthSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/examinations/${examId}/auth-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authMode: targetAuthMode,
          loginIdentifierLabel: customLoginLabel,
          loginIdentifierField: exam?.login_identifier_field || 'roll_number',
          registrationFields: targetRegFields,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Authentication & registration policy updated.');
        setSettingsModalOpen(false);
        fetchExamAndStudents();
      } else {
        toast.error(json.error || 'Failed to update settings.');
      }
    } catch {
      toast.error('Network error updating settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportCSV = () => {
    if (registrations.length === 0) {
      toast.info('No students to export.');
      return;
    }
    const headers = [
      'Full Name',
      'Roll Number',
      'Email',
      'Phone',
      'Branch',
      'Specialization',
      'College',
      'Year of Study',
      'Registration Date',
      'Status',
    ];
    const rows = registrations.map((r) => [
      r.student?.full_name || 'N/A',
      r.login_id || r.student?.roll_number || 'N/A',
      r.student?.email || 'N/A',
      r.student?.phone || 'N/A',
      r.student?.branch || 'N/A',
      r.student?.specialization || 'N/A',
      r.student?.college || 'N/A',
      r.student?.year_of_study || 'N/A',
      new Date(r.registered_at).toLocaleString(),
      r.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((x) => `"${x}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `roster_${examId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Student roster exported as CSV.');
  };

  const filtered = registrations.filter((r) => {
    const q = search.toLowerCase();
    const nameMatch = r.student?.full_name.toLowerCase().includes(q);
    const rollMatch = (r.login_id || r.student?.roll_number || '').toLowerCase().includes(q);
    const emailMatch = (r.student?.email || '').toLowerCase().includes(q);
    return nameMatch || rollMatch || emailMatch;
  });

  const isRosterAuth = (exam?.auth_mode ?? 'roster') === 'roster';
  const loginLabelDisplay = exam?.login_identifier_label || exam?.login_identifier_field || 'Roll Number';

  return (
    <AdminLayoutWrapper>
      <div className="space-y-6">
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
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Candidate Roster & Authentication</h1>
            <p className="mt-1 text-xs text-gray-500">
              Manage authorized student records, import spreadsheets (.xlsx / .csv), and configure student Login ID credentials.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/examinations/sample-template"
              download="student_roster_sample_template.csv"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span>Sample Template</span>
            </a>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportModalOpen(true)}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Excel / CSV</span>
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={() => setAddModalOpen(true)}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 bg-gray-900 text-white hover:bg-black"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Candidate</span>
            </Button>
          </div>
        </div>

        {/* Configuration Overview Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">
                  {isRosterAuth ? 'Roster-Restricted Admission (Strict)' : 'Open Candidate Registration'}
                </h3>
                <Badge variant={isRosterAuth ? 'success' : 'neutral'}>
                  {isRosterAuth ? 'Roster Mode' : 'Open Mode'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isRosterAuth
                  ? `Only students pre-registered in this roster can write the exam using their ${loginLabelDisplay}.`
                  : 'Any candidate with the link can register and write the examination.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsModalOpen(true)}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Configure Auth</span>
            </Button>

            {registrations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setClearModalOpen(true)}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Roster</span>
              </Button>
            )}
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={`Search by candidate name, ${loginLabelDisplay}, or email...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-hidden focus:border-gray-900"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
            <span>Roster Total: <strong className="text-gray-900">{registrations.length}</strong> candidates</span>
            <span>Filtered: <strong className="text-gray-900">{filtered.length}</strong></span>
          </div>
        </div>

        {/* Candidates Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Candidate Name</th>
                  <th className="py-3.5 px-4">{loginLabelDisplay}</th>
                  <th className="py-3.5 px-4">Email Address</th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4">Branch & Specialization</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      Loading candidates...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-500 text-xs">
                      <div className="max-w-sm mx-auto space-y-2">
                        <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="font-semibold text-gray-900">No candidates in roster</p>
                        <p className="text-gray-400 text-[11px]">
                          Upload an Excel (.xlsx) or CSV file with your student details to authorize them for this exam.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setAddModalOpen(true)}
                            className="text-xs uppercase tracking-wider bg-gray-900 text-white hover:bg-black gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Candidate Manually</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setImportModalOpen(true)}
                            className="text-xs uppercase tracking-wider"
                          >
                            Import Student Roster
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const statusVariant = {
                      registered: 'info',
                      started: 'warning',
                      completed: 'success',
                      disqualified: 'danger',
                    }[r.status] as 'info' | 'warning' | 'success' | 'danger';

                    const studentAttrs = r.student?.attributes || {};
                    const attrKeys = Object.keys(studentAttrs);

                    return (
                      <tr key={`student-reg-${r.id}`} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 font-bold text-gray-900">
                          {r.student?.full_name || 'N/A'}
                        </td>
                        <td className="py-4 px-4 font-mono font-semibold text-gray-800">
                          <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200">
                            {r.login_id || r.student?.roll_number}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-600">{r.student?.email || 'N/A'}</td>
                        <td className="py-4 px-4 font-mono text-[11px] text-gray-700">
                          {r.student?.phone || <span className="text-gray-400 font-sans italic">None</span>}
                        </td>
                        <td className="py-4 px-4 text-gray-700">
                          {r.student?.branch ? (
                            <div>
                              <span className="font-semibold text-gray-900">{r.student.branch}</span>
                              {r.student.specialization && (
                                <span className="text-[10px] text-gray-500 block">{r.student.specialization}</span>
                              )}
                            </div>
                          ) : attrKeys.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {attrKeys.slice(0, 2).map((k) => (
                                <span
                                  key={`attr-${r.id}-${k}`}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-600 font-medium"
                                >
                                  {k}: {String(studentAttrs[k])}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[11px] italic">Standard</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant={statusVariant}>{r.status}</Badge>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {r.status !== 'disqualified' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (!confirm(`Are you sure you want to DISQUALIFY candidate "${r.student?.full_name || r.login_id}"? Their test access will be revoked immediately.`)) return;
                                  try {
                                    const res = await fetch(`/api/examinations/${examId}/students`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ registrationId: r.id, status: 'disqualified' }),
                                    });
                                    const json = await res.json();
                                    if (json.success) {
                                      r.status = 'disqualified';
                                      const updated = [...registrations];
                                      setRegistrations(updated);
                                      if (typeof window !== 'undefined') {
                                        try {
                                          localStorage.setItem(`mentneo_students_${examId}`, JSON.stringify(updated));
                                        } catch {}
                                      }
                                      toast.error(`Candidate ${r.login_id || r.student?.roll_number} disqualified and access revoked.`);
                                    } else {
                                      toast.error(json.error || 'Failed to update candidate status.');
                                    }
                                  } catch {
                                    toast.error('Network error.');
                                  }
                                }}
                                className="text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7 px-2"
                              >
                                Disqualify
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCandidate(r.id, r.login_id || r.student?.roll_number || 'Candidate')}
                              className="text-[11px] text-gray-400 hover:text-rose-600 hover:bg-rose-50 h-7 px-2"
                              title="Remove candidate from roster"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* ADD SINGLE CANDIDATE DIALOG                         */}
        {/* ---------------------------------------------------- */}
        <Dialog
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          title="Add Candidate to Examination Roster"
          description={`Enroll an individual student into this examination roster. The candidate will authenticate using their ${loginLabelDisplay}.`}
        >
          <form onSubmit={handleAddCandidate} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                {loginLabelDisplay} *
              </label>
              <Input
                value={addRollNumber}
                onChange={(e) => setAddRollNumber(e.target.value)}
                placeholder="e.g. 2026CS001, REG-1049, STU-55"
                required
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Candidate will use this identifier to log in and write their examination.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Candidate Full Name *
              </label>
              <Input
                value={addFullName}
                onChange={(e) => setAddFullName(e.target.value)}
                placeholder="e.g. John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Email Address (Optional)
              </label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="e.g. student@college.edu"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Phone (Optional)
                </label>
                <Input
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Branch (Optional)
                </label>
                <Input
                  value={addBranch}
                  onChange={(e) => setAddBranch(e.target.value)}
                  placeholder="e.g. CSE, ECE"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Specialization (Optional)
                </label>
                <Input
                  value={addSpec}
                  onChange={(e) => setAddSpec(e.target.value)}
                  placeholder="e.g. AI/ML, Data Sci"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingCandidate || !addRollNumber.trim()}
                className="bg-gray-900 text-white hover:bg-black text-xs font-semibold uppercase tracking-wider"
              >
                {savingCandidate ? 'Saving...' : 'Add Candidate'}
              </Button>
            </div>
          </form>
        </Dialog>

        {/* ---------------------------------------------------- */}
        {/* IMPORT SPREADSHEET DIALOG                           */}
        {/* ---------------------------------------------------- */}
        <Dialog
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          title="Import Student Roster Spreadsheet"
          description="Upload an Excel (.xlsx, .xls) or CSV file. Map the candidate columns to configure their designated Login ID."
        >
          <div className="space-y-5">
            {/* File Dropzone */}
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-gray-400 transition-colors bg-gray-50/50">
              <input
                type="file"
                id="roster-file-input"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="roster-file-input" className="cursor-pointer block space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto" />
                <div className="text-xs font-semibold text-gray-800">
                  {selectedFile ? selectedFile.name : 'Click to select or drag and drop spreadsheet'}
                </div>
                <p className="text-[11px] text-gray-400">
                  Supported formats: .xlsx, .xls, .csv. First row must contain column headers.
                </p>
              </label>
            </div>

            {/* Column Mapping Section (Only shown once file is parsed) */}
            {detectedColumns.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                    Column Mapping ({parsedRows.length} candidates detected)
                  </h4>
                  <Badge variant="neutral">{detectedColumns.length} Columns</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Login ID Column */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Login ID Field (Mandatory)
                    </label>
                    <select
                      value={loginField}
                      onChange={(e) => {
                        setLoginField(e.target.value);
                        setLoginLabel(e.target.value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()));
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-900 focus:outline-hidden focus:border-gray-900"
                    >
                      {detectedColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Field students type to log in to this exam (e.g. Roll No, Reg ID).
                    </span>
                  </div>

                  {/* Login ID User-Facing Label */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Login Field Display Label
                    </label>
                    <input
                      type="text"
                      value={loginLabel}
                      onChange={(e) => setLoginLabel(e.target.value)}
                      placeholder="e.g. Candidate Roll Number"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-900 focus:outline-hidden focus:border-gray-900"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Text displayed on the student login input box.
                    </span>
                  </div>

                  {/* Candidate Name Column */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Candidate Full Name Field
                    </label>
                    <select
                      value={nameField}
                      onChange={(e) => setNameField(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-900 focus:outline-hidden focus:border-gray-900"
                    >
                      {detectedColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Email Column (Optional) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Email Address Field (Optional)
                    </label>
                    <select
                      value={emailField}
                      onChange={(e) => setEmailField(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-900 focus:outline-hidden focus:border-gray-900"
                    >
                      <option value="">-- No Email Column (Auto-generate) --</option>
                      {detectedColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="pt-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Preview (First 3 Records)
                  </span>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                        <tr>
                          <th className="py-2 px-3">Name ({nameField})</th>
                          <th className="py-2 px-3">Login ID ({loginField})</th>
                          <th className="py-2 px-3">Email ({emailField || 'auto'})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedRows.slice(0, 3).map((row, idx) => (
                          <tr key={idx} className="bg-white">
                            <td className="py-2 px-3 font-semibold text-gray-900">{String(row[nameField] || '')}</td>
                            <td className="py-2 px-3 font-mono text-gray-800">{String(row[loginField] || '')}</td>
                            <td className="py-2 px-3 text-gray-500">
                              {emailField ? String(row[emailField] || '') : 'auto@student.exam'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Replace toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 pt-1">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span>Replace existing roster records for this examination</span>
                </label>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportModalOpen(false)}
                disabled={importing}
                className="text-xs uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmImport}
                disabled={detectedColumns.length === 0}
                isLoading={importing}
                className="text-xs uppercase tracking-wider font-semibold gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Import {parsedRows.length} Candidates</span>
              </Button>
            </div>
          </div>
        </Dialog>

        {/* ---------------------------------------------------- */}
        {/* CLEAR ROSTER CONFIRMATION DIALOG                     */}
        {/* ---------------------------------------------------- */}
        <Dialog
          isOpen={clearModalOpen}
          onClose={() => setClearModalOpen(false)}
          title="Clear Examination Roster"
          description="Are you sure you want to remove all candidates from this examination? This will remove their authorization to enter the exam."
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>This action cannot be undone. All candidate registrations for this exam will be removed.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={clearing}
                onClick={() => setClearModalOpen(false)}
                className="text-xs uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={clearing}
                onClick={handleClearRoster}
                className="text-xs uppercase tracking-wider font-semibold"
              >
                Clear Entire Roster
              </Button>
            </div>
          </div>
        </Dialog>

        {/* ---------------------------------------------------- */}
        {/* AUTH SETTINGS DIALOG                                */}
        {/* ---------------------------------------------------- */}
        <Dialog
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          title="Examination Authentication Mode"
          description="Configure how students access this examination."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Admission Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetAuthMode('roster')}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    targetAuthMode === 'roster'
                      ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                      : 'border-gray-200 bg-white hover:border-gray-400'
                  }`}
                >
                  <p className="text-xs font-bold text-gray-900">Roster Mode (Strict)</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Only students in the uploaded roster can enter with their Login ID.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetAuthMode('open')}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    targetAuthMode === 'open'
                      ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                      : 'border-gray-200 bg-white hover:border-gray-400'
                  }`}
                >
                  <p className="text-xs font-bold text-gray-900">Open Registration</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Any candidate visiting the link can self-register.
                  </p>
                </button>
              </div>
            </div>

            {targetAuthMode === 'roster' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Login Identifier Display Label
                </label>
                <input
                  type="text"
                  value={customLoginLabel}
                  onChange={(e) => setCustomLoginLabel(e.target.value)}
                  placeholder="e.g. Candidate Roll Number"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-hidden focus:border-gray-900"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  The label candidates see when asked to enter their credential.
                </span>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-0.5">
                    Required Candidate Registration Fields
                  </label>
                  <p className="text-[11px] text-gray-500">
                    Candidate Name, Email, and Roll Number are always collected. Configure additional fields:
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                  {targetRegFields.map((f, idx) => (
                    <div key={f.key} className="p-3 bg-white flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-gray-900">{f.label}</span>
                        <span className="text-[10px] text-gray-400 block font-mono">Field: {f.key}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={f.enabled}
                            onChange={(e) => {
                              const updated = [...targetRegFields];
                              updated[idx] = { ...updated[idx], enabled: e.target.checked };
                              setTargetRegFields(updated);
                            }}
                            className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                          <span>Collect</span>
                        </label>
                        <label className={`flex items-center gap-1.5 text-xs ${f.enabled ? 'cursor-pointer text-gray-700' : 'opacity-40 pointer-events-none'}`}>
                          <input
                            type="checkbox"
                            checked={f.required}
                            disabled={!f.enabled}
                            onChange={(e) => {
                              const updated = [...targetRegFields];
                              updated[idx] = { ...updated[idx], required: e.target.checked };
                              setTargetRegFields(updated);
                            }}
                            className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                          <span>Mandatory</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsModalOpen(false)}
                disabled={savingSettings}
                className="text-xs uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAuthSettings}
                isLoading={savingSettings}
                className="text-xs uppercase tracking-wider font-semibold"
              >
                Save Settings
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </AdminLayoutWrapper>
  );
}

export default function AdminStudentsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">
          Loading candidate roster...
        </div>
      }
    >
      <AdminStudentsContent />
    </React.Suspense>
  );
}
