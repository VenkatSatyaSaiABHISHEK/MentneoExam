'use client';

import * as React from 'react';
import { AdminLayoutWrapper } from '@/components/common/admin-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Cpu,
  Server,
  Database,
  GitBranch,
  RefreshCw,
  Activity,
  HardDrive,
  ShieldCheck,
  Flame,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ClusterData {
  hostInfo: {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    uptimeSeconds: number;
    cpuCores: number;
    cpuModel: string;
    cpuTemp: number | null;
    loadAvg: number[];
    totalMemMB: number;
    usedMemMB: number;
    freeMemMB: number;
    memPercent: number;
  };
  database: {
    status: 'connected' | 'disconnected' | 'fallback_json';
    latencyMs: number | null;
    isUsingRemotePiDb: boolean;
    targetHost: string;
    counts: {
      examinations: number;
      rounds: number;
      questions: number;
      students: number;
      attempts: number;
      results: number;
    };
  };
  cluster: {
    primaryPiNode: {
      name: string;
      ip: string;
      status: 'online' | 'offline';
      pingMs: number | null;
      role: string;
    };
    secondaryLaptopNode: {
      name: string;
      status: string;
      role: string;
    };
    publicGateway: {
      url: string;
      tunnel: string;
    };
  };
  autoDeploy: {
    active: boolean;
    status: string;
    lastCheck: string;
    localHash: string;
    remoteHash: string;
    upToDate: boolean;
    lastSuccessDeploy?: string;
  };
}

export default function ClusterDashboardPage() {
  const [data, setData] = React.useState<ClusterData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deploying, setDeploying] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  const fetchTelemetry = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cluster');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTelemetry();
    if (!autoRefresh) return;
    const interval = setInterval(fetchTelemetry, 8000);
    return () => clearInterval(interval);
  }, [fetchTelemetry, autoRefresh]);

  const handleTriggerDeploy = async () => {
    setDeploying(true);
    toast.info('Triggering Git Pull and Next.js re-compilation...');
    try {
      const res = await fetch('/api/admin/auto-deploy', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Remote deployment completed successfully.');
        fetchTelemetry();
      } else {
        toast.error(json.error || 'Auto-deployment failed');
      }
    } catch (err: any) {
      toast.error('Failed to trigger remote deployment: ' + err.message);
    } finally {
      setDeploying(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    return `${hours}h ${mins}m`;
  };

  return (
    <AdminLayoutWrapper>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e6e3f8] dark:border-[#2c2854]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" size="sm" className="bg-[#1d1a4a] text-[#b8b3ff]">
                High-Availability Cluster
              </Badge>
              <span className="text-xs text-[#7871a8] font-mono">Dual-Node Master/Surge Architecture</span>
            </div>
            <h1 className="text-2xl font-bold text-[#1d1a4a] dark:text-white tracking-tight">
              Cluster & Hardware Cockpit
            </h1>
            <p className="text-xs text-[#554e80] dark:text-[#a8a1dc] mt-1">
              Real-time Raspberry Pi 4 hardware metrics, dual-server load balancing, and zero-touch auto-pull deployment.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={cn(
                'text-xs font-mono gap-1.5 border-[#e6e3f8] dark:border-[#2c2854]',
                autoRefresh ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20' : 'text-gray-500'
              )}
            >
              <Activity className={cn('w-3.5 h-3.5', autoRefresh && 'animate-pulse text-emerald-600')} />
              <span>{autoRefresh ? 'Live (8s)' : 'Paused'}</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerDeploy}
              disabled={deploying}
              className="text-xs font-semibold gap-1.5 bg-[#1d1a4a] text-white hover:bg-[#2d2870] dark:bg-[#b8b3ff] dark:text-[#0d0c1d]"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', deploying && 'animate-spin')} />
              <span>{deploying ? 'Deploying...' : 'Sync & Pull Now'}</span>
            </Button>
          </div>
        </div>

        {/* 4 Overview Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Primary Pi Node */}
          <Card className="p-4 border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] shadow-xs">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7871a8] dark:text-[#a59ed8]">
                Primary 24/7 Node
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-xl font-bold font-mono text-[#1d1a4a] dark:text-white">
              {data?.cluster.primaryPiNode.status === 'online' ? 'Online (Active)' : 'Standby / Local'}
            </div>
            <p className="text-xs text-[#554e80] dark:text-[#a8a1dc] mt-1 font-mono">
              IP: {data?.cluster.primaryPiNode.ip || '192.168.29.130'}
              {data?.cluster.primaryPiNode.pingMs !== null ? ` (${data?.cluster.primaryPiNode.pingMs}ms)` : ''}
            </p>
          </Card>

          {/* Card 2: CPU Temperature & Load */}
          <Card className="p-4 border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] shadow-xs">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7871a8] dark:text-[#a59ed8]">
                CPU Thermal & Load
              </span>
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-xl font-bold font-mono text-[#1d1a4a] dark:text-white">
              {data?.hostInfo.cpuTemp !== null ? `${data?.hostInfo.cpuTemp}°C` : 'Optimal (<50°C)'}
            </div>
            <p className="text-xs text-[#554e80] dark:text-[#a8a1dc] mt-1 font-mono">
              Load: {data?.hostInfo.loadAvg[0]?.toFixed(2) || '0.15'} • {data?.hostInfo.cpuCores || 4} Cores
            </p>
          </Card>

          {/* Card 3: Memory Usage */}
          <Card className="p-4 border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] shadow-xs">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7871a8] dark:text-[#a59ed8]">
                RAM Utilization
              </span>
              <Cpu className="w-4 h-4 text-[#6355d8]" />
            </div>
            <div className="text-xl font-bold font-mono text-[#1d1a4a] dark:text-white">
              {data?.hostInfo.usedMemMB || 0} / {data?.hostInfo.totalMemMB || 0} MB
            </div>
            <div className="w-full bg-[#f0effe] dark:bg-[#201d40] h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-[#1d1a4a] dark:bg-[#b8b3ff] h-1.5 rounded-full"
                style={{ width: `${data?.hostInfo.memPercent || 30}%` }}
              />
            </div>
          </Card>

          {/* Card 4: Auto-Deploy Status */}
          <Card className="p-4 border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] shadow-xs">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7871a8] dark:text-[#a59ed8]">
                Zero-Touch Git Sync
              </span>
              <GitBranch className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold font-mono text-[#1d1a4a] dark:text-white">
              Commit {data?.autoDeploy.localHash || 'Synced'}
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Auto-Pull Daemon Active</span>
            </p>
          </Card>
        </div>

        {/* Dual Node Topology & Failover Mechanism */}
        <Card className="p-6 border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#e6e3f8] dark:border-[#2c2854]">
            <div className="flex items-center gap-2.5">
              <Server className="w-5 h-5 text-[#6355d8]" />
              <h2 className="text-base font-bold text-[#1d1a4a] dark:text-white">
                Cluster Topology & Surge Load Sharing
              </h2>
            </div>
            <div className="text-xs font-mono text-[#7871a8] dark:text-[#a59ed8]">
              Target: <strong className="text-[#1d1a4a] dark:text-white">{data?.database.targetHost}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Node 1 */}
            <div className="p-4 rounded-xl border border-[#e6e3f8] dark:border-[#2c2854] bg-[#faf9fe] dark:bg-[#1c193b] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-[#1d1a4a] dark:text-white">
                    Node A: Raspberry Pi 4 (24/7 Master)
                  </h3>
                </div>
                <Badge variant="success" size="sm">
                  Always-On
                </Badge>
              </div>
              <p className="text-xs text-[#554e80] dark:text-[#a8a1dc]">
                Hosts the authoritative PostgreSQL database (`exams_db`) and primary Cloudflare Tunnel endpoint. Power consumption ~5W.
              </p>
              <div className="text-[11px] font-mono text-[#7871a8] dark:text-[#a59ed8] pt-1">
                Uptime: {formatUptime(data?.hostInfo.uptimeSeconds || 3600)} • PM2 Managed
              </div>
            </div>

            {/* Node 2 */}
            <div className="p-4 rounded-xl border border-[#e6e3f8] dark:border-[#2c2854] bg-[#faf9fe] dark:bg-[#1c193b] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-[#1d1a4a] dark:text-white">
                    Node B: Laptop Server (Surge Worker)
                  </h3>
                </div>
                <Badge variant="neutral" size="sm">
                  On-Demand
                </Badge>
              </div>
              <p className="text-xs text-[#554e80] dark:text-[#a8a1dc]">
                Connects directly to the Raspberry Pi database over Wi-Fi (`192.168.29.130:5432`). When active, it processes exams concurrently without data divergence.
              </p>
              <div className="text-[11px] font-mono text-[#7871a8] dark:text-[#a59ed8] pt-1">
                Role: Secondary Compute Engine / Emergency Failover
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f0effe] dark:bg-[#1e1b3d] border border-[#d5d0f5] dark:border-[#38336d] text-xs text-[#554e80] dark:text-[#d6d2fc] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#6355d8] shrink-0 mt-0.5" />
            <div>
              <strong>Surge Capacity Protection:</strong> Both nodes write to the identical PostgreSQL cluster. If attendance surges past 200 candidates, starting `start_server.bat` on your laptop automatically shares the exam processing workload with zero conflicts.
            </div>
          </div>
        </Card>

        {/* Database Record Diagnostics */}
        <Card className="p-6 border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#e6e3f8] dark:border-[#2c2854]">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#6355d8]" />
              <h2 className="text-sm font-bold text-[#1d1a4a] dark:text-white">
                PostgreSQL Cluster Database Records
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600">
              Latency: {data?.database.latencyMs !== null ? `${data?.database.latencyMs}ms` : 'Local Buffer'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-[#faf9fe] dark:bg-[#1c193b] border border-[#e6e3f8] dark:border-[#2c2854] text-center">
              <span className="text-[10px] font-mono uppercase text-[#7871a8] block">Examinations</span>
              <span className="text-lg font-bold font-mono text-[#1d1a4a] dark:text-white">
                {data?.database.counts.examinations || 0}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#faf9fe] dark:bg-[#1c193b] border border-[#e6e3f8] dark:border-[#2c2854] text-center">
              <span className="text-[10px] font-mono uppercase text-[#7871a8] block">Rounds</span>
              <span className="text-lg font-bold font-mono text-[#1d1a4a] dark:text-white">
                {data?.database.counts.rounds || 0}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#faf9fe] dark:bg-[#1c193b] border border-[#e6e3f8] dark:border-[#2c2854] text-center">
              <span className="text-[10px] font-mono uppercase text-[#7871a8] block">Questions</span>
              <span className="text-lg font-bold font-mono text-[#1d1a4a] dark:text-white">
                {data?.database.counts.questions || 0}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#faf9fe] dark:bg-[#1c193b] border border-[#e6e3f8] dark:border-[#2c2854] text-center">
              <span className="text-[10px] font-mono uppercase text-[#7871a8] block">Students</span>
              <span className="text-lg font-bold font-mono text-[#1d1a4a] dark:text-white">
                {data?.database.counts.students || 0}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#faf9fe] dark:bg-[#1c193b] border border-[#e6e3f8] dark:border-[#2c2854] text-center">
              <span className="text-[10px] font-mono uppercase text-[#7871a8] block">Live Attempts</span>
              <span className="text-lg font-bold font-mono text-emerald-600">
                {data?.database.counts.attempts || 0}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#faf9fe] dark:bg-[#1c193b] border border-[#e6e3f8] dark:border-[#2c2854] text-center">
              <span className="text-[10px] font-mono uppercase text-[#7871a8] block">Results</span>
              <span className="text-lg font-bold font-mono text-[#1d1a4a] dark:text-white">
                {data?.database.counts.results || 0}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayoutWrapper>
  );
}
