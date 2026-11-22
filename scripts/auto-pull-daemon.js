const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(__dirname, '..', 'data', 'cluster_sync_status.json');
const CHECK_INTERVAL_MS = parseInt(process.env.AUTOPULL_INTERVAL_MS || '180000', 10); // Default: 3 minutes

function recordStatus(data) {
  try {
    const dir = path.dirname(STATUS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[Auto-Pull] Error recording status:', err.message);
  }
}

function runCommand(cmd) {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

console.log(`[Auto-Pull Daemon] Started. Checking for updates every ${Math.round(CHECK_INTERVAL_MS / 1000)}s...`);

async function checkAndPull() {
  const now = new Date().toISOString();
  try {
    // 1. Fetch remote tracking branch (lightweight: ~1KB packet)
    runCommand('git fetch origin master');

    // 2. Check local vs remote HEAD
    const localHash = runCommand('git rev-parse HEAD');
    const remoteHash = runCommand('git rev-parse origin/master');

    const statusObj = {
      active: true,
      lastCheck: now,
      localHash: localHash.slice(0, 7),
      remoteHash: remoteHash.slice(0, 7),
      upToDate: localHash === remoteHash,
      status: 'idle',
      lastUpdated: now,
    };

    if (localHash === remoteHash) {
      statusObj.status = 'synchronized';
      recordStatus(statusObj);
      return;
    }

    // Safety Guard: Check if students are actively taking exams before building
    try {
      const checkRes = runCommand('curl -s http://localhost:3000/api/admin/stats');
      const stats = JSON.parse(checkRes);
      if (stats?.data?.activeAttempts > 0) {
        console.warn(`[Auto-Pull Exam-Guard] ${stats.data.activeAttempts} candidates currently taking an examination. Deferring build until exam concludes.`);
        statusObj.status = 'deferred_exam_active';
        recordStatus(statusObj);
        return;
      }
    } catch {
      // Continue if stats endpoint not reachable
    }

    console.log(`[Auto-Pull] Update detected! Local: ${localHash.slice(0, 7)} -> Remote: ${remoteHash.slice(0, 7)}`);
    statusObj.status = 'pulling_and_building';
    recordStatus(statusObj);

    // 3. Pull latest changes
    console.log('[Auto-Pull] Pulling changes from origin/master...');
    runCommand('git pull origin master');

    // 4. Run build
    console.log('[Auto-Pull] Building production bundles (npm run build)...');
    runCommand('npm run build');

    // 5. Reload PM2 exams service with zero downtime
    console.log('[Auto-Pull] Reloading PM2 exams service...');
    try {
      runCommand('pm2 reload exams');
    } catch {
      runCommand('pm2 restart exams');
    }

    const updatedHash = runCommand('git rev-parse HEAD').slice(0, 7);
    statusObj.status = 'synchronized';
    statusObj.localHash = updatedHash;
    statusObj.lastSuccessDeploy = new Date().toISOString();
    recordStatus(statusObj);

    console.log(`[Auto-Pull] Successfully updated and reloaded to ${updatedHash}!`);
  } catch (error) {
    console.error('[Auto-Pull Error]:', error.message);
    recordStatus({
      active: true,
      lastCheck: now,
      status: 'error',
      errorMessage: error.message,
    });
  }
}

// Initial check on boot
checkAndPull();

// Continuous interval
setInterval(checkAndPull, CHECK_INTERVAL_MS);
