'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PlusCircle,
  Search,
  ExternalLink,
  Copy,
  Layers,
  Clock,
  Play,
  Square,
  Archive,
  ArrowRight,
  MoreVertical,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Examination, ExamStatus } from '@/types';
import { formatDuration } from '@/lib/utils';

export default function AdminExaminationsPage() {
  const [examinations, setExaminations] = React.useState<Examination[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [copiedSlug, setCopiedSlug] = React.useState<string | null>(null);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/examinations');
      const json = await res.json();
      if (json.success) {
        setExaminations(json.data || []);
      }
    } catch {
      toast.error('Failed to load examinations.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchExams();
  }, []);

  const handleStatusChange = async (examId: string, newStatus: ExamStatus) => {
    try {
      const res = await fetch(`/api/examinations/${examId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Examination status changed to ${newStatus}`);
        fetchExams();
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch {
      toast.error('Network error updating status');
    }
  };

  const copyShareLink = (slug: string) => {
    const url = `${window.location.origin}/exam/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    toast.success('Exam candidate link copied to clipboard.');
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const filtered = examinations.filter((exam) => {
    const matchesSearch =
      exam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || exam.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <AdminLayoutWrapper>
      <div className="space-y-6">
        {/* Page Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Examinations</h1>
            <p className="mt-1 text-xs text-gray-500">
              Manage multi-round examination lifecycles, publication status, and candidate URLs.
            </p>
          </div>
          <Link href="/exam/admin/examinations/create">
            <Button size="sm" className="text-xs uppercase tracking-wider gap-2 font-semibold">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Examination</span>
            </Button>
          </Link>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by examination title or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {['all', 'live', 'published', 'scheduled', 'draft', 'completed', 'archived'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  selectedStatus === status
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Table of Examinations */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Examination</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Rounds</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Shareable URL</th>
                  <th className="py-3.5 px-4">Quick Lifecycle</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="py-6 px-6">
                        <div className="h-4 bg-gray-200 rounded-md w-3/4" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500 text-xs">
                      No examinations match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map((exam) => {
                    const rounds = exam.rounds || [];
                    const totalDuration = rounds.reduce((acc, r) => acc + r.duration_minutes, 0);

                    const statusVariant = {
                      live: 'success',
                      scheduled: 'warning',
                      published: 'info',
                      draft: 'neutral',
                      completed: 'neutral',
                      archived: 'neutral',
                    }[exam.status] as 'success' | 'warning' | 'info' | 'neutral';

                    return (
                      <tr key={`exam-row-${exam.id}`} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <Link
                            href={`/exam/admin/examinations/${exam.id}`}
                            className="font-bold text-gray-900 hover:underline block leading-snug"
                          >
                            {exam.name}
                          </Link>
                          <span className="text-[11px] text-gray-400 font-mono">ID: {exam.id}</span>
                        </td>

                        <td className="py-4 px-4">
                          <Badge variant={statusVariant}>{exam.status}</Badge>
                        </td>

                        <td className="py-4 px-4 font-medium text-gray-700">
                          {rounds.length} round{rounds.length !== 1 ? 's' : ''}
                        </td>

                        <td className="py-4 px-4 font-mono text-gray-600">
                          {formatDuration(totalDuration)}
                        </td>

                        <td className="py-4 px-4">
                          <button
                            onClick={() => copyShareLink(exam.slug)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50 text-[11px] font-mono text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            {copiedSlug === exam.slug ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400" />
                            )}
                            <span>/{exam.slug}</span>
                          </button>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5">
                            {exam.status !== 'live' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusChange(exam.id, 'live')}
                                className="h-7 px-2 text-[10px] uppercase font-bold"
                              >
                                Go Live
                              </Button>
                            )}
                            {exam.status === 'live' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusChange(exam.id, 'completed')}
                                className="h-7 px-2 text-[10px] uppercase font-bold text-rose-700"
                              >
                                Close
                              </Button>
                            )}
                            {exam.status !== 'archived' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusChange(exam.id, 'archived')}
                                className="h-7 px-2 text-[10px] uppercase text-gray-500"
                              >
                                Archive
                              </Button>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Link href={`/exam/admin/examinations/${exam.id}`}>
                              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold uppercase tracking-wider">
                                Manage
                              </Button>
                            </Link>
                            <Link href={`/exam/admin/examinations/${exam.id}/results`}>
                              <Button size="sm" className="h-8 text-xs font-semibold uppercase tracking-wider">
                                Live Results
                              </Button>
                            </Link>
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
      </div>
    </AdminLayoutWrapper>
  );
}

