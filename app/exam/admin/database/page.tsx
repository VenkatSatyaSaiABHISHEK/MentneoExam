'use client';

import * as React from 'react';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import {
  Database,
  Table2,
  Search,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Eye,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileJson,
  X,
  Layers,
  Hash,
  ShieldCheck,
  Calendar,
  Clock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface TableMeta {
  name: string;
  rowCount: number;
  columns: Array<{ name: string; type: string; nullable: boolean }>;
}

export default function DatabaseStudioPage() {
  const [tables, setTables] = React.useState<TableMeta[]>([]);
  const [activeTable, setActiveTable] = React.useState<string>('students');
  const [tableSearch, setTableSearch] = React.useState<string>('');
  const [loadingSchema, setLoadingSchema] = React.useState<boolean>(true);

  // Table Data State
  const [columns, setColumns] = React.useState<Array<{ name: string; type: string; nullable: boolean }>>([]);
  const [rows, setRows] = React.useState<any[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [page, setPage] = React.useState<number>(1);
  const [limit, setLimit] = React.useState<number>(25);
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>('');
  const [sortColumn, setSortColumn] = React.useState<string>('');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [loadingData, setLoadingData] = React.useState<boolean>(true);

  // Row Details Inspector Drawer
  const [selectedRow, setSelectedRow] = React.useState<any | null>(null);
  const [selectedRowIdx, setSelectedRowIdx] = React.useState<number>(-1);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // Debounce search query
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 1. Fetch Database Tables Schema
  const fetchSchema = React.useCallback(async (autoSelectFirst = false) => {
    setLoadingSchema(true);
    try {
      const res = await fetch('/api/admin/database/schema');
      const json = await res.json();
      if (json.success && json.data?.tables) {
        setTables(json.data.tables);
        if (autoSelectFirst && json.data.tables.length > 0) {
          const defaultTab = json.data.tables.find((t: TableMeta) => t.name === 'students')?.name || json.data.tables[0].name;
          setActiveTable(defaultTab);
        }
      } else {
        toast.error('Failed to load database schema');
      }
    } catch {
      toast.error('Network error loading schema');
    } finally {
      setLoadingSchema(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSchema(true);
  }, [fetchSchema]);

  // 2. Fetch Selected Table Data
  const fetchTableData = React.useCallback(async () => {
    if (!activeTable) return;
    setLoadingData(true);
    try {
      const params = new URLSearchParams({
        table: activeTable,
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
        sortOrder,
      });
      if (sortColumn) params.set('sortColumn', sortColumn);

      const res = await fetch(`/api/admin/database/table?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setColumns(json.data.columns || []);
        setRows(json.data.rows || []);
        setTotalCount(json.data.totalCount || 0);
      } else {
        toast.error(json.error || `Failed to fetch data for ${activeTable}`);
      }
    } catch {
      toast.error(`Network error loading ${activeTable}`);
    } finally {
      setLoadingData(false);
    }
  }, [activeTable, page, limit, debouncedSearch, sortColumn, sortOrder]);

  React.useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  // Switch Table
  const handleSelectTable = (tblName: string) => {
    if (tblName === activeTable) return;
    setActiveTable(tblName);
    setPage(1);
    setSearchQuery('');
    setSortColumn('');
    setSortOrder('desc');
    setSelectedRow(null);
  };

  // Toggle Sorting
  const handleSortToggle = (colName: string) => {
    if (sortColumn === colName) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortColumn('');
        setSortOrder('desc');
      }
    } else {
      setSortColumn(colName);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (rows.length === 0) {
      toast.info('No records to export');
      return;
    }
    const colHeaders = columns.map((c) => c.name);
    const csvRows = rows.map((r) =>
      colHeaders.map((c) => {
        const val = r[c];
        if (val === null || val === undefined) return '""';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [colHeaders.join(','), ...csvRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeTable}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${rows.length} rows as CSV`);
  };

  // Export JSON
  const handleExportJSON = () => {
    if (rows.length === 0) {
      toast.info('No records to export');
      return;
    }
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rows, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `${activeTable}_export.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${rows.length} rows as JSON`);
  };

  // Filtered tables for left sidebar
  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(tableSearch.toLowerCase().trim())
  );

  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Render Cell content nicely
  const renderCellContent = (val: any, col: { name: string; type: string }) => {
    if (val === null || val === undefined) {
      return <span className="text-zinc-400 dark:text-zinc-600 font-mono italic text-[11px]">null</span>;
    }

    if (typeof val === 'boolean') {
      return (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
            val
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
          }`}
        >
          {String(val)}
        </span>
      );
    }

    if (typeof val === 'object') {
      const isArr = Array.isArray(val);
      const len = isArr ? val.length : Object.keys(val).length;
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px] text-zinc-700 dark:text-zinc-300">
          <FileJson className="w-3 h-3 text-zinc-500" />
          <span>{isArr ? `[${len}]` : `{${len}}`}</span>
        </span>
      );
    }

    // Timestamps
    if (col.name.includes('_at') || col.name.includes('date') || col.name.includes('time')) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return (
          <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300" title={val}>
            {d.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        );
      }
    }

    // IDs and Primary keys
    if (col.name === 'id' || col.name.endsWith('_id') || col.name.includes('slug')) {
      return (
        <span className="font-mono text-[11px] text-zinc-900 dark:text-zinc-100 font-medium">
          {String(val)}
        </span>
      );
    }

    return (
      <span className="text-zinc-800 dark:text-zinc-200 text-xs truncate max-w-[240px] block" title={String(val)}>
        {String(val)}
      </span>
    );
  };

  return (
    <AdminLayoutWrapper>
      <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] -m-4 md:-m-6 overflow-hidden bg-white dark:bg-zinc-950">
        {/* Top Control Header */}
        <div className="h-14 px-4 sm:px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center font-mono font-bold text-sm shadow-xs">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">
                  Database Studio
                </h1>
                <Badge variant="success" size="sm">
                  PostgreSQL 17
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Authoritative ACID Table Browser & Data Inspector
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchSchema();
                fetchTableData();
              }}
              disabled={loadingSchema || loadingData}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSchema || loadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={rows.length === 0}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 h-8"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJSON}
              disabled={rows.length === 0}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 h-8"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export JSON</span>
            </Button>
          </div>
        </div>

        {/* Studio Workspace: Left Sidebar + Right Data Grid */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* ------------------------------------------------------------------ */}
          {/* LEFT SIDEBAR: Table List Navigator                                 */}
          {/* ------------------------------------------------------------------ */}
          <div className="w-64 sm:w-72 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50 flex flex-col shrink-0">
            {/* Search Tables Input */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter tables..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:border-zinc-900 dark:focus:border-white transition-colors"
                />
                {tableSearch && (
                  <button
                    onClick={() => setTableSearch('')}
                    className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tables List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              <div className="px-2 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                public schema ({filteredTables.length} tables)
              </div>

              {loadingSchema ? (
                <div className="p-4 space-y-2">
                  <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
                  <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
                  <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-400">
                  No matching tables found
                </div>
              ) : (
                filteredTables.map((t) => {
                  const isActive = t.name === activeTable;
                  return (
                    <button
                      key={t.name}
                      onClick={() => handleSelectTable(t.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer group ${
                        isActive
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs font-semibold'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Table2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-400 group-hover:text-zinc-600'
                          }`}
                        />
                        <span className="truncate">{t.name}</span>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                          isActive
                            ? 'bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900 font-bold'
                            : 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {t.rowCount}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Sidebar Bottom Footer */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 flex items-center justify-between text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Connected</span>
              </span>
              <span className="font-mono text-[10px]">public</span>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* RIGHT MAIN PANEL: Table Data Viewer                                */}
          {/* ------------------------------------------------------------------ */}
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950">
            {/* Table Action Bar */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
                  public.&quot;{activeTable}&quot;
                </span>
                <span className="text-xs text-zinc-500 font-medium">
                  {totalCount} total records
                </span>
              </div>

              {/* Search & Sort Controls */}
              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search in table..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:border-zinc-900 dark:focus:border-white transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Page Size Selector */}
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:border-zinc-900"
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>

            {/* Active Sort Pill Indicator if active */}
            {sortColumn && (
              <div className="px-4 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                  <span>Sorted by:</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{sortColumn}</span>
                  <Badge variant="neutral" size="sm" className="text-[10px] uppercase">
                    {sortOrder}
                  </Badge>
                </div>
                <button
                  onClick={() => setSortColumn('')}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer text-[10px] uppercase tracking-wider font-semibold"
                >
                  Clear Sort
                </button>
              </div>
            )}

            {/* Interactive Data Grid */}
            <div className="flex-1 overflow-auto relative">
              {loadingData ? (
                <div className="absolute inset-0 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-2xs flex flex-col items-center justify-center space-y-2 z-10">
                  <div className="w-6 h-6 border-2 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono text-zinc-500">Querying public.&quot;{activeTable}&quot;...</span>
                </div>
              ) : null}

              {rows.length === 0 && !loadingData ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
                    <Table2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">No records found</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mt-1">
                    {debouncedSearch
                      ? `No rows match the search query "${debouncedSearch}".`
                      : `The table "${activeTable}" currently has 0 rows in the database.`}
                  </p>
                  {debouncedSearch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className="mt-3 text-xs"
                    >
                      Clear Search Filter
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs min-w-max">
                  {/* Sticky Header */}
                  <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 z-10 select-none shadow-2xs">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center text-[10px] font-mono text-zinc-400 border-r border-zinc-200 dark:border-zinc-800">
                        #
                      </th>
                      {columns.map((col) => {
                        const isSorted = sortColumn === col.name;
                        return (
                          <th
                            key={col.name}
                            onClick={() => handleSortToggle(col.name)}
                            className="py-2.5 px-3.5 border-r border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors group"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {col.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-tighter">
                                  {col.type}
                                </span>
                                {isSorted ? (
                                  sortOrder === 'asc' ? (
                                    <ArrowUp className="w-3 h-3 text-zinc-900 dark:text-white" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3 text-zinc-900 dark:text-white" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-2.5 h-2.5 text-zinc-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* Body Rows */}
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
                    {rows.map((row, rIdx) => {
                      const rowNum = (page - 1) * limit + rIdx + 1;
                      return (
                        <tr
                          key={`row-${rIdx}`}
                          onClick={() => {
                            setSelectedRow(row);
                            setSelectedRowIdx(rIdx);
                          }}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors cursor-pointer group"
                        >
                          <td className="py-2.5 px-3 w-12 text-center font-mono text-[10px] text-zinc-400 border-r border-zinc-100 dark:border-zinc-800/60 group-hover:text-zinc-900 dark:group-hover:text-white">
                            {rowNum}
                          </td>
                          {columns.map((col) => (
                            <td
                              key={`${rIdx}-${col.name}`}
                              className="py-2.5 px-3.5 border-r border-zinc-100 dark:border-zinc-800/60 truncate"
                            >
                              {renderCellContent(row[col.name], col)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bottom Pagination Bar */}
            <div className="h-12 px-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between shrink-0 text-xs">
              <span className="text-zinc-500 font-medium">
                Showing{' '}
                <strong className="text-zinc-900 dark:text-zinc-100">
                  {totalCount > 0 ? (page - 1) * limit + 1 : 0}
                </strong>{' '}
                to{' '}
                <strong className="text-zinc-900 dark:text-zinc-100">
                  {Math.min(page * limit, totalCount)}
                </strong>{' '}
                of <strong className="text-zinc-900 dark:text-zinc-100">{totalCount}</strong> records
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loadingData}
                  className="h-8 px-2.5 text-xs font-medium"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  <span>Previous</span>
                </Button>

                <span className="px-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loadingData}
                  className="h-8 px-2.5 text-xs font-medium"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* ROW DETAIL INSPECTOR (Supabase-style record inspector modal)       */}
        {/* ------------------------------------------------------------------ */}
        {selectedRow && (
          <Dialog
            isOpen={Boolean(selectedRow)}
            onClose={() => setSelectedRow(null)}
            title={`Row Details: public."${activeTable}"`}
            description={`Viewing row #${(page - 1) * limit + selectedRowIdx + 1} (${columns.length} columns)`}
          >
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Row Navigation */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-mono font-semibold text-zinc-500">
                  Record ID: <strong className="text-zinc-900 dark:text-white">{selectedRow.id || selectedRow.slug || 'N/A'}</strong>
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedRowIdx <= 0}
                    onClick={() => {
                      const prevIdx = selectedRowIdx - 1;
                      if (rows[prevIdx]) {
                        setSelectedRow(rows[prevIdx]);
                        setSelectedRowIdx(prevIdx);
                      }
                    }}
                    className="h-7 px-2 text-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedRowIdx >= rows.length - 1}
                    onClick={() => {
                      const nextIdx = selectedRowIdx + 1;
                      if (rows[nextIdx]) {
                        setSelectedRow(rows[nextIdx]);
                        setSelectedRowIdx(nextIdx);
                      }
                    }}
                    className="h-7 px-2 text-xs"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Columns Field-by-Field Breakdown */}
              <div className="space-y-3">
                {columns.map((col) => {
                  const val = selectedRow[col.name];
                  const isNull = val === null || val === undefined;
                  const isObj = typeof val === 'object' && val !== null;
                  const formattedStr = isObj ? JSON.stringify(val, null, 2) : String(val);

                  return (
                    <div
                      key={`detail-${col.name}`}
                      className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                            {col.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                            {col.type}
                          </span>
                        </div>

                        {!isNull && (
                          <button
                            onClick={() => handleCopy(formattedStr, col.name)}
                            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedKey === col.name ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedKey === col.name ? 'Copied' : 'Copy'}</span>
                          </button>
                        )}
                      </div>

                      {isNull ? (
                        <div className="font-mono text-zinc-400 italic text-[11px]">null</div>
                      ) : isObj ? (
                        <pre className="p-2.5 rounded bg-zinc-900 text-zinc-100 dark:bg-black font-mono text-[11px] overflow-x-auto leading-relaxed border border-zinc-800">
                          {formattedStr}
                        </pre>
                      ) : (
                        <div className="font-mono text-zinc-800 dark:text-zinc-200 text-xs break-all select-all">
                          {formattedStr}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRow(null)}
                  className="text-xs uppercase tracking-wider"
                >
                  Close
                </Button>
              </div>
            </div>
          </Dialog>
        )}
      </div>
    </AdminLayoutWrapper>
  );
}
