'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowRight, Save, Layers, Clock, Shield, Award, Users, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { slugify } from '@/lib/utils';
import { SelectionStrategy, RegistrationFieldConfig } from '@/types';

interface DynamicRoundForm {
  round_number: number;
  name: string;
  duration_minutes: number;
  total_questions: number;
  marks_per_question: number;
  negative_marks: number;
  qualifying_marks: number;
  question_selection_strategy: SelectionStrategy;
  auto_qualify: boolean;
  instructions: string;
}

export default function CreateExaminationPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  // Exam general info
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [studentLimit, setStudentLimit] = React.useState<number | ''>(250);
  const [maxCheatingWarnings, setMaxCheatingWarnings] = React.useState(3);
  const [showMarksToStudents, setShowMarksToStudents] = React.useState(true);
  const [instructions, setInstructions] = React.useState('');

  // Admission & Registration Configuration
  const [authMode, setAuthMode] = React.useState<'open' | 'roster'>('open');
  const [loginIdentifierLabel, setLoginIdentifierLabel] = React.useState('Roll Number');
  const [registrationFields, setRegistrationFields] = React.useState<RegistrationFieldConfig[]>([
    { key: 'phone', label: 'Phone Number', required: true, enabled: true },
    { key: 'branch', label: 'Branch / Department', required: true, enabled: true },
    { key: 'specialization', label: 'Specialization', required: false, enabled: true },
    { key: 'college', label: 'College / University', required: false, enabled: false },
    { key: 'year_of_study', label: 'Year / Semester', required: false, enabled: false },
  ]);

  // Dynamic rounds builder state - starts with 2 dynamic rounds, can add unlimited!
  const [rounds, setRounds] = React.useState<DynamicRoundForm[]>([
    {
      round_number: 1,
      name: 'Round 1: Screening & Core Fundamentals',
      duration_minutes: 45,
      total_questions: 20,
      marks_per_question: 1,
      negative_marks: 0.25,
      qualifying_marks: 8,
      question_selection_strategy: 'random',
      auto_qualify: true,
      instructions: 'Preliminary screening round. Qualify to advance to Round 2.',
    },
    {
      round_number: 2,
      name: 'Round 2: Advanced Problem Solving & Synthesis',
      duration_minutes: 60,
      total_questions: 25,
      marks_per_question: 2,
      negative_marks: 0.5,
      qualifying_marks: 20,
      question_selection_strategy: 'random',
      auto_qualify: true,
      instructions: 'Comprehensive technical round for qualified candidates.',
    },
  ]);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(slugify(val));
  };

  const handleAddRound = () => {
    const nextNumber = rounds.length + 1;
    const newRound: DynamicRoundForm = {
      round_number: nextNumber,
      name: `Round ${nextNumber}: Specialization Assessment`,
      duration_minutes: 60,
      total_questions: 30,
      marks_per_question: 1,
      negative_marks: 0,
      qualifying_marks: 15,
      question_selection_strategy: 'random',
      auto_qualify: true,
      instructions: `Round ${nextNumber} instructions for candidates.`,
    };
    setRounds([...rounds, newRound]);
    toast.success(`Dynamic Round ${nextNumber} added.`);
  };

  const handleRemoveRound = (idx: number) => {
    if (rounds.length <= 1) {
      toast.error('An examination must have at least one round.');
      return;
    }
    const updated = rounds
      .filter((_, i) => i !== idx)
      .map((r, i) => ({ ...r, round_number: i + 1 }));
    setRounds(updated);
    toast.info('Round removed.');
  };

  const handleRoundFieldChange = (idx: number, field: keyof DynamicRoundForm, val: any) => {
    setRounds((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Examination name is required');
      return;
    }
    if (!slug.trim()) {
      toast.error('URL slug is required');
      return;
    }
    if (rounds.length === 0) {
      toast.error('Please configure at least one examination round');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        student_limit: studentLimit === '' ? null : Number(studentLimit),
        max_cheating_warnings: Number(maxCheatingWarnings),
        show_marks_to_students: Boolean(showMarksToStudents),
        instructions: instructions.trim(),
        status: 'published',
        auth_mode: authMode,
        login_identifier_field: 'roll_number',
        login_identifier_label: loginIdentifierLabel,
        registration_fields: authMode === 'open' ? registrationFields : [],
        rounds: rounds.map((r) => {
          const totalQ = Number(r.total_questions) || 10;
          const marksPerQ = Number(r.marks_per_question) || 1;
          return {
            ...r,
            total_questions: totalQ,
            duration_minutes: Number(r.duration_minutes) || 30,
            marks_per_question: marksPerQ,
            negative_marks: Number(r.negative_marks) || 0,
            qualifying_marks: Number(r.qualifying_marks) || 1,
            total_marks: totalQ * marksPerQ,
          };
        }),
      };

      const res = await fetch('/api/examinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to create examination');
        return;
      }

      if (typeof window !== 'undefined' && data.data?.id) {
        try {
          localStorage.setItem(`mentneo_exam_${data.data.id}`, JSON.stringify(data.data));
        } catch {}
      }

      toast.success('Examination created and published successfully.');
      router.push(`/exam/admin/examinations/${data.data.id}`);
    } catch {
      toast.error('Network error during creation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayoutWrapper>
      <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create Examination</h1>
            <p className="mt-1 text-xs text-gray-500">
              Configure dynamic examination settings, scheduling, and multi-round qualification rules.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push('/exam/admin/examinations')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={submitting}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Publish Examination</span>
            </Button>
          </div>
        </div>

        {/* 1. General Examination Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-700" />
              <span>General Examination Configuration</span>
            </CardTitle>
            <CardDescription>Public metadata and admission constraints for this examination.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Examination Title"
                placeholder="e.g. Computer Science & Software Engineering Assessment 2026"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />

              <Input
                label="URL Slug (/exam/[slug])"
                placeholder="e.g. cs-engineering-assessment-2026"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                required
              />
            </div>

            <Textarea
              label="Public Description"
              placeholder="Outline examination scope, prerequisites, and evaluation objectives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <Input
                label="Candidate Limit (Concurrent)"
                type="number"
                placeholder="250"
                value={studentLimit}
                onChange={(e) => setStudentLimit(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              />

              <Input
                label="Max Cheating Warnings"
                type="number"
                min={1}
                max={10}
                value={maxCheatingWarnings}
                onChange={(e) => setMaxCheatingWarnings(parseInt(e.target.value, 10) || 3)}
              />

              <div className="flex flex-col gap-1.5 justify-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={showMarksToStudents}
                    onChange={(e) => setShowMarksToStudents(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span>Display Detailed Marks on Result Screen</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Candidate Admission & Registration Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-gray-700" />
              <span>Candidate Admission & Registration Policy</span>
            </CardTitle>
            <CardDescription>
              Select how students enter this examination and customize candidate registration data collection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setAuthMode('open')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  authMode === 'open'
                    ? 'border-gray-900 bg-gray-50/60 ring-1 ring-gray-900'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-900">Open Registration</span>
                  <Badge variant={authMode === 'open' ? 'success' : 'neutral'}>Recommended</Badge>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Students register directly using the exam URL link. The system collects their profile data based on your requirements.
                </p>
              </div>

              <div
                onClick={() => setAuthMode('roster')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  authMode === 'roster'
                    ? 'border-gray-900 bg-gray-50/60 ring-1 ring-gray-900'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-900">Roster Mode (Strict)</span>
                  <Badge variant={authMode === 'roster' ? 'info' : 'neutral'}>Pre-Screened</Badge>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Only candidates pre-uploaded via Excel / CSV can access the examination using their assigned identifier.
                </p>
              </div>
            </div>

            {authMode === 'open' ? (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                    Candidate Profile Fields Configuration
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Full Name, Email Address, and Roll Number are always collected. Check the additional fields you want to collect and make mandatory:
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden bg-white">
                  {registrationFields.map((field, idx) => (
                    <div key={field.key} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          <span>{field.label}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {field.key}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400">
                          {field.key === 'phone' && 'Collect candidate phone or WhatsApp contact number'}
                          {field.key === 'branch' && 'Collect candidate academic department or branch (e.g. CSE, ECE)'}
                          {field.key === 'specialization' && 'Collect technical focus or domain (e.g. AI & ML, Data Science)'}
                          {field.key === 'college' && 'Collect candidate institution or college name'}
                          {field.key === 'year_of_study' && 'Collect academic year or semester of study'}
                        </span>
                      </div>

                      <div className="flex items-center gap-5 shrink-0">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={field.enabled}
                            onChange={(e) => {
                              const updated = [...registrationFields];
                              updated[idx] = { ...updated[idx], enabled: e.target.checked };
                              setRegistrationFields(updated);
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                          <span>Collect Field</span>
                        </label>

                        <label
                          className={`flex items-center gap-1.5 text-xs font-medium ${
                            field.enabled ? 'cursor-pointer text-gray-700' : 'opacity-40 pointer-events-none'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={field.required}
                            disabled={!field.enabled}
                            onChange={(e) => {
                              const updated = [...registrationFields];
                              updated[idx] = { ...updated[idx], required: e.target.checked };
                              setRegistrationFields(updated);
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                          <span>Mandatory</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <Input
                  label="Candidate Identifier Display Label"
                  placeholder="e.g. Candidate Roll Number, Hall Ticket Number"
                  value={loginIdentifierLabel}
                  onChange={(e) => setLoginIdentifierLabel(e.target.value)}
                  required
                />
                <p className="text-[11px] text-gray-400">
                  This label is shown to candidates when prompted to authenticate into the examination.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Dynamic Multi-Round Builder */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-gray-700" />
                <span>Dynamic Rounds Architecture</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure unlimited sequential rounds. Candidates qualify automatically based on database thresholds.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRound}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Dynamic Round</span>
            </Button>
          </div>

          <div className="space-y-5">
            {rounds.map((round, idx) => (
              <Card key={idx} className="border-gray-200">
                <CardHeader className="bg-gray-50/50 flex flex-row items-center justify-between pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold font-mono">
                      {round.round_number}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                        Round {round.round_number} Configuration
                      </span>
                    </div>
                  </div>

                  {rounds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRound(idx)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </CardHeader>

                <CardContent className="space-y-4 pt-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Round Title"
                      value={round.name}
                      onChange={(e) => handleRoundFieldChange(idx, 'name', e.target.value)}
                      required
                    />

                    <div>
                      <label className="text-xs font-semibold text-gray-700 tracking-wide block mb-1.5">
                        Question Selection Strategy
                      </label>
                      <select
                        value={round.question_selection_strategy}
                        onChange={(e) =>
                          handleRoundFieldChange(idx, 'question_selection_strategy', e.target.value as SelectionStrategy)
                        }
                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-hidden focus:ring-1 focus:ring-gray-900"
                      >
                        <option value="random">Randomized Shuffle (Candidate receives unique random order)</option>
                        <option value="sequential">Sequential (Ordered by Sort Priority)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <Input
                      label="Duration (Mins)"
                      type="number"
                      min={5}
                      value={round.duration_minutes ?? ''}
                      onChange={(e) =>
                        handleRoundFieldChange(idx, 'duration_minutes', e.target.value === '' ? '' : parseInt(e.target.value, 10))
                      }
                      required
                    />

                    <Input
                      label="Total Questions"
                      type="number"
                      min={1}
                      value={round.total_questions ?? ''}
                      onChange={(e) =>
                        handleRoundFieldChange(idx, 'total_questions', e.target.value === '' ? '' : parseInt(e.target.value, 10))
                      }
                      required
                    />

                    <Input
                      label="Marks / Correct"
                      type="number"
                      step="0.5"
                      min={0.5}
                      value={round.marks_per_question ?? ''}
                      onChange={(e) =>
                        handleRoundFieldChange(idx, 'marks_per_question', e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      required
                    />

                    <Input
                      label="Negative Marks"
                      type="number"
                      step="0.25"
                      min={0}
                      value={round.negative_marks ?? ''}
                      onChange={(e) =>
                        handleRoundFieldChange(idx, 'negative_marks', e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      required
                    />

                    <Input
                      label="Qualifying Marks"
                      type="number"
                      step="0.5"
                      min={0}
                      value={round.qualifying_marks ?? ''}
                      onChange={(e) =>
                        handleRoundFieldChange(idx, 'qualifying_marks', e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      required
                    />
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg text-xs flex items-center justify-between text-gray-600 font-mono">
                    <span>Calculated Total Marks: {round.total_questions * round.marks_per_question}</span>
                    <label className="flex items-center gap-2 cursor-pointer font-sans text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={round.auto_qualify}
                        onChange={(e) => handleRoundFieldChange(idx, 'auto_qualify', e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900"
                      />
                      <span>Auto-unlock next round if score &gt;= qualifying marks</span>
                    </label>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
          <Button
            type="submit"
            isLoading={submitting}
            size="lg"
            className="text-xs uppercase tracking-wider font-semibold gap-2 px-8"
          >
            <Save className="w-4 h-4" />
            <span>Create & Publish Examination</span>
          </Button>
        </div>
      </form>
    </AdminLayoutWrapper>
  );
}

