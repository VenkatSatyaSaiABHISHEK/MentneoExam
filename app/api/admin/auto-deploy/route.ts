import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const logs: string[] = [];

    logs.push('[1/3] Pulling latest commits from GitHub origin/master...');
    const { stdout: pullOut, stderr: pullErr } = await execAsync('git pull origin master', {
      cwd: process.cwd(),
      timeout: 30000,
    });
    logs.push(pullOut || pullErr || 'Git pull completed.');

    logs.push('[2/3] Building production Next.js bundles...');
    const { stdout: buildOut } = await execAsync('npm run build', {
      cwd: process.cwd(),
      timeout: 180000,
    });
    logs.push('Build successfully compiled.');

    logs.push('[3/3] Reloading PM2 processes with zero downtime...');
    try {
      await execAsync('pm2 reload exams', { cwd: process.cwd(), timeout: 15000 });
      logs.push('PM2 service reloaded cleanly.');
    } catch {
      try {
        await execAsync('pm2 restart exams', { cwd: process.cwd(), timeout: 15000 });
        logs.push('PM2 service restarted.');
      } catch (err: any) {
        logs.push('Note: PM2 not running on this node (running standalone).');
      }
    }

    // Record in sync status file
    try {
      const statusFile = path.join(process.cwd(), 'data', 'cluster_sync_status.json');
      const { stdout: hashOut } = await execAsync('git rev-parse HEAD', { cwd: process.cwd() });
      const currentHash = hashOut.trim().slice(0, 7);
      fs.writeFileSync(
        statusFile,
        JSON.stringify(
          {
            active: true,
            status: 'synchronized',
            lastCheck: new Date().toISOString(),
            localHash: currentHash,
            remoteHash: currentHash,
            upToDate: true,
            lastDeployTrigger: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      message: 'Zero-touch update completed successfully.',
      logs,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Auto-deploy failed',
      },
      { status: 500 }
    );
  }
}
