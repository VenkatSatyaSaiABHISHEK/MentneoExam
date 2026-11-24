import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

// In-flight deployment lock to prevent overlapping builds
let isDeploying = false;

async function executeDeployment(triggerSource: string) {
  if (isDeploying) {
    console.log('[Auto-Deploy] Deployment already in progress. Skipping duplicate request.');
    return;
  }
  isDeploying = true;
  const statusFile = path.join(process.cwd(), 'data', 'cluster_sync_status.json');

  const recordStatus = (data: Record<string, any>) => {
    try {
      const dir = path.dirname(statusFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(statusFile, JSON.stringify(data, null, 2));
    } catch {
      // ignore
    }
  };

  try {
    console.log(`[Auto-Deploy] Initiated by ${triggerSource}...`);
    recordStatus({
      active: true,
      status: 'deploying',
      lastDeployTrigger: new Date().toISOString(),
      triggerSource,
    });

    // 1. Git pull with stash protection
    console.log('[Auto-Deploy] [1/3] Pulling latest changes from GitHub...');
    try {
      await execAsync('git stash', { cwd: process.cwd(), timeout: 10000 });
    } catch {
      // ignore
    }
    await execAsync('git pull origin master', { cwd: process.cwd(), timeout: 35000 });

    // 2. Build Next.js with memory guard
    console.log('[Auto-Deploy] [2/3] Building production bundles with memory optimization...');
    await execAsync('NODE_OPTIONS="--max-old-space-size=1024" NEXT_TELEMETRY_DISABLED=1 npm run build', {
      cwd: process.cwd(),
      timeout: 240000,
    });

    // Verify PostgreSQL is alive on Linux
    try {
      await execAsync('sudo systemctl is-active --quiet postgresql || sudo systemctl restart postgresql', {
        cwd: process.cwd(),
        timeout: 10000,
      });
    } catch {
      // ignore
    }

    // 3. Reload PM2
    console.log('[Auto-Deploy] [3/3] Reloading PM2 exams service...');
    try {
      await execAsync('pm2 reload exams', { cwd: process.cwd(), timeout: 15000 });
    } catch {
      try {
        await execAsync('pm2 restart exams', { cwd: process.cwd(), timeout: 15000 });
      } catch {
        // running standalone
      }
    }

    let currentHash = 'latest';
    try {
      const { stdout: hashOut } = await execAsync('git rev-parse HEAD', { cwd: process.cwd() });
      currentHash = hashOut.trim().slice(0, 7);
    } catch {
      // ignore
    }

    recordStatus({
      active: true,
      status: 'synchronized',
      lastCheck: new Date().toISOString(),
      localHash: currentHash,
      remoteHash: currentHash,
      upToDate: true,
      lastSuccessDeploy: new Date().toISOString(),
      triggerSource,
    });

    console.log(`[Auto-Deploy] Deployment completed successfully! Current commit: ${currentHash}`);
  } catch (err: any) {
    console.error('[Auto-Deploy Error]:', err.message);
    recordStatus({
      active: true,
      status: 'error',
      errorMessage: err.message,
      lastDeployTrigger: new Date().toISOString(),
    });
  } finally {
    isDeploying = false;
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const githubEvent = req.headers.get('x-github-event');
    const signature = req.headers.get('x-hub-signature-256');

    // Secret from environment or default
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || 'exams_webhook_secret_3101';

    // If request comes from GitHub, verify HMAC signature
    if (githubEvent) {
      if (signature) {
        const expectedSig = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
        const signatureBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSig);

        if (
          signatureBuffer.length !== expectedBuffer.length ||
          !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
        ) {
          return NextResponse.json({ success: false, error: 'Invalid HMAC signature' }, { status: 401 });
        }
      }

      // Handle GitHub test ping event
      if (githubEvent === 'ping') {
        return NextResponse.json({
          success: true,
          message: 'Pong! GitHub Webhook connection verified successfully.',
        });
      }

      // Handle GitHub push event
      if (githubEvent === 'push') {
        let payload: any = {};
        try {
          payload = JSON.parse(rawBody);
        } catch {
          // ignore
        }

        // Only deploy if the push is to master / main branch
        const branch = payload.ref ? payload.ref.replace('refs/heads/', '') : 'master';
        if (branch !== 'master' && branch !== 'main') {
          return NextResponse.json({
            success: true,
            message: `Push detected on branch ${branch}. Skipping (auto-deploy triggers only for master).`,
          });
        }

        // Respond immediately to GitHub (GitHub requires response < 10 seconds)
        // Run deployment asynchronously in background
        executeDeployment(`GitHub Webhook (push to ${branch})`);

        return NextResponse.json({
          success: true,
          message: 'Webhook received. Production build and reload job dispatched in background.',
        });
      }
    }

    // Direct trigger from Admin Console
    executeDeployment('Admin Console Dashboard');

    return NextResponse.json({
      success: true,
      message: 'Zero-touch update dispatched in background.',
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
