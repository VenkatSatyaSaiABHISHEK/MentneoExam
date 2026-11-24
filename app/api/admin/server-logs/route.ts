import { NextResponse } from 'next/server';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const execAsync = promisify(exec);

// Helper to check if a TCP port is open locally
function checkPortOpen(port: number, host = '127.0.0.1', timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(true);
      }
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on('error', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

// Safely execute shell command with timeout
async function safeExec(cmd: string, timeout = 10000): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: process.cwd(), timeout });
    return { stdout: stdout?.trim() || '', stderr: stderr?.trim() || '', success: true };
  } catch (err: any) {
    return {
      stdout: err.stdout?.trim() || '',
      stderr: err.stderr?.trim() || err.message || 'Execution failed',
      success: false,
    };
  }
}

export async function GET() {
  try {
    const isLinux = os.platform() === 'linux';

    // 1. Hardware & System Metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);

    // Read CPU Temperature on Linux / Raspberry Pi
    let cpuTemp: number | null = null;
    if (isLinux) {
      try {
        if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
          const raw = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8');
          cpuTemp = Math.round(parseInt(raw.trim(), 10) / 100) / 10;
        }
      } catch {
        cpuTemp = null;
      }
    }

    // Disk Space
    let diskInfo = { total: 'Unknown', used: 'Unknown', available: 'Unknown', usePercent: '0%' };
    if (isLinux) {
      const dfRes = await safeExec('df -h / | tail -1', 3000);
      if (dfRes.success && dfRes.stdout) {
        const parts = dfRes.stdout.split(/\s+/);
        if (parts.length >= 5) {
          diskInfo = {
            total: parts[1],
            used: parts[2],
            available: parts[3],
            usePercent: parts[4],
          };
        }
      }
    }

    // Swap Info from /proc/meminfo on Linux
    let swapInfo = { totalMB: 0, freeMB: 0, usedMB: 0, percent: 0 };
    if (isLinux && fs.existsSync('/proc/meminfo')) {
      try {
        const meminfo = fs.readFileSync('/proc/meminfo', 'utf-8');
        const swapTotalMatch = meminfo.match(/SwapTotal:\s+(\d+)\s+kB/);
        const swapFreeMatch = meminfo.match(/SwapFree:\s+(\d+)\s+kB/);
        if (swapTotalMatch && swapFreeMatch) {
          const totalKB = parseInt(swapTotalMatch[1], 10);
          const freeKB = parseInt(swapFreeMatch[1], 10);
          const usedKB = totalKB - freeKB;
          swapInfo = {
            totalMB: Math.round(totalKB / 1024),
            freeMB: Math.round(freeKB / 1024),
            usedMB: Math.round(usedKB / 1024),
            percent: totalKB > 0 ? Math.round((usedKB / totalKB) * 100) : 0,
          };
        }
      } catch {
        // ignore
      }
    }

    // 2. Service Health (PostgreSQL & Next.js ports)
    const appPort = parseInt(process.env.PORT || '3000', 10);
    const [isPostgresPortOpen, isNextJsPortOpen] = await Promise.all([
      checkPortOpen(5432, '127.0.0.1', 1000),
      checkPortOpen(appPort, '127.0.0.1', 1000),
    ]);

    let pgServiceActive = isPostgresPortOpen;
    if (isLinux) {
      const pgCheck = await safeExec('systemctl is-active postgresql', 2000);
      if (pgCheck.success) {
        pgServiceActive = pgCheck.stdout === 'active';
      }
    }

    // 3. PM2 Process Status
    let pm2Processes: Array<{
      name: string;
      id: number;
      status: string;
      memoryMB: number;
      cpu: number;
      restarts: number;
      uptimeSec: number;
    }> = [];

    const pm2ListRes = await safeExec('pm2 jlist', 4000);
    if (pm2ListRes.success && pm2ListRes.stdout) {
      try {
        const parsed = JSON.parse(pm2ListRes.stdout);
        if (Array.isArray(parsed)) {
          pm2Processes = parsed.map((p: any) => ({
            name: p.name || 'unknown',
            id: p.pm_id ?? 0,
            status: p.pm2_env?.status || 'stopped',
            memoryMB: Math.round((p.monit?.memory || 0) / (1024 * 1024)),
            cpu: p.monit?.cpu || 0,
            restarts: p.pm2_env?.restart_time || 0,
            uptimeSec: p.pm2_env?.pm_uptime ? Math.round((Date.now() - p.pm2_env.pm_uptime) / 1000) : 0,
          }));
        }
      } catch {
        // Fallback: simple text parse or empty
      }
    }

    // 4. Recent Server Logs
    let logs: string[] = [];

    // Attempt reading PM2 error and out log files directly
    const possibleLogPaths = [
      path.join(os.homedir(), '.pm2', 'logs', 'exams-error.log'),
      path.join(os.homedir(), '.pm2', 'logs', 'exams-out.log'),
      path.join(process.cwd(), 'logs', 'exams.log'),
    ];

    for (const logPath of possibleLogPaths) {
      try {
        if (fs.existsSync(logPath)) {
          const fileContent = fs.readFileSync(logPath, 'utf-8');
          const lines = fileContent.trim().split(/\r?\n/).filter(Boolean);
          const recentLines = lines.slice(-40);
          logs.push(`=== [LOG FILE: ${path.basename(logPath)}] ===`);
          logs.push(...recentLines);
        }
      } catch {
        // ignore
      }
    }

    // If direct log files weren't found, try `pm2 logs exams --lines 40 --nostream`
    if (logs.length === 0) {
      const pm2LogsRes = await safeExec('pm2 logs exams --lines 40 --nostream', 5000);
      if (pm2LogsRes.success && pm2LogsRes.stdout) {
        logs = pm2LogsRes.stdout.split(/\r?\n/);
      } else if (pm2LogsRes.stderr) {
        logs = [pm2LogsRes.stderr];
      }
    }

    // 5. Git Status & Hash
    let gitInfo = {
      currentHash: 'unknown',
      branch: 'master',
      statusSummary: 'clean',
      lastCommitMessage: '',
      lastCommitDate: '',
    };

    const gitHashRes = await safeExec('git rev-parse --short HEAD', 2000);
    if (gitHashRes.success) gitInfo.currentHash = gitHashRes.stdout;

    const gitBranchRes = await safeExec('git rev-parse --abbrev-ref HEAD', 2000);
    if (gitBranchRes.success) gitInfo.branch = gitBranchRes.stdout;

    const gitMsgRes = await safeExec('git log -1 --pretty=%B', 2000);
    if (gitMsgRes.success) gitInfo.lastCommitMessage = gitMsgRes.stdout;

    const gitDateRes = await safeExec('git log -1 --pretty=%cd --date=relative', 2000);
    if (gitDateRes.success) gitInfo.lastCommitDate = gitDateRes.stdout;

    const gitStatusRes = await safeExec('git status --porcelain', 2000);
    if (gitStatusRes.success) {
      gitInfo.statusSummary = gitStatusRes.stdout.length > 0 ? 'modified' : 'clean';
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        host: {
          hostname: os.hostname(),
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
          uptimeSeconds: Math.round(os.uptime()),
          cpuModel: os.cpus()[0]?.model || 'ARM Cortex-A72',
          cpuCores: os.cpus().length,
          cpuTemp,
          loadAvg: os.loadavg(),
          ram: {
            totalMB: Math.round(totalMem / (1024 * 1024)),
            usedMB: Math.round(usedMem / (1024 * 1024)),
            freeMB: Math.round(freeMem / (1024 * 1024)),
            percent: memPercent,
          },
          swap: swapInfo,
          disk: diskInfo,
        },
        services: {
          postgresql: {
            port5432: isPostgresPortOpen,
            serviceActive: pgServiceActive,
            status: isPostgresPortOpen ? 'running' : 'down',
          },
          nextjs: {
            port: appPort,
            isOpen: isNextJsPortOpen,
            status: isNextJsPortOpen ? 'listening' : 'down',
          },
          pm2: pm2Processes,
        },
        git: gitInfo,
        logs: logs.length > 0 ? logs : ['No recent PM2 log events recorded yet.'],
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to retrieve server telemetry',
      },
      { status: 500 }
    );
  }
}

// POST endpoint to run maintenance actions directly from Admin UI
export async function POST(req: Request) {
  try {
    const { action } = await req.json();

    if (!action) {
      return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 });
    }

    let output = '';

    if (action === 'git_pull') {
      // 1. Stash any untracked or local changes to prevent merge aborts
      await safeExec('git stash', 5000);
      // 2. Pull from origin master
      const pullRes = await safeExec('git pull origin master', 25000);
      output = `Git Pull Result:\n${pullRes.stdout}\n${pullRes.stderr}`;
    } else if (action === 'restart_exams') {
      const pm2Res = await safeExec('pm2 restart exams', 10000);
      output = `PM2 Restart Exams:\n${pm2Res.stdout}\n${pm2Res.stderr}`;
    } else if (action === 'restart_postgres') {
      const pgRes = await safeExec('sudo systemctl restart postgresql', 10000);
      output = `PostgreSQL Restart Result:\n${pgRes.stdout}\n${pgRes.stderr}`;
    } else if (action === 'clear_logs') {
      const flushRes = await safeExec('pm2 flush', 5000);
      output = `PM2 Logs Flushed:\n${flushRes.stdout}\n${flushRes.stderr}`;
    } else {
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      output: output.trim(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Action execution failed',
      },
      { status: 500 }
    );
  }
}
