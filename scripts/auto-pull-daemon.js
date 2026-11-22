const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(__dirname, '..', 'data', 'cluster_sync_status.json');
const CHECK_INTERVAL_MS = 45000; // 45 seconds

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

console.log('[Auto-Pull Daemon] Started. Monitoring GitHub repository every 45s...');

async function checkAndPull() {
  const now = new Date().toISOString();
  try {
    // 1. Fetch remote tracking branch
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
