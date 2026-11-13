/**
 * ============================================================================
 * EXAM PORTAL — NATIVE CONCURRENT USER SIMULATOR & CAPACITY AUDIT HARNESS
 * Supports: 50 -> 100 -> 250 -> 500 -> 750 -> 1000 Concurrent Active Students
 * Zero external binary dependencies (Runs directly with Node.js 18+)
 * ============================================================================
 */

import http from 'http';
import https from 'https';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const EXAM_SLUG = process.env.EXAM_SLUG || 'cs-engineering-assessment-2026';
const TARGET_VUS = parseInt(process.env.VUS || '50', 10);
const RUN_MODE = process.env.RUN_MODE || 'single';
const BATCH_ANSWERS = process.env.BATCH_ANSWERS !== 'false';

function createMetricsCollector() {
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    http429Responses: 0,
    http500Responses: 0,
    http502Responses: 0,
    http503Responses: 0,
    timeoutErrors: 0,
    otherErrors: 0,
    latencies: [],
    answerSaveLatencies: [],
    submissionLatencies: [],
    successfulSubmissions: 0,
    failedSubmissions: 0,
    idempotentResubmissionsVerified: 0,
    startTime: 0,
    endTime: 0,
  };
}

function percentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 2000,
  maxFreeSockets: 512,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 2000,
  maxFreeSockets: 512,
});

function request(metrics, urlStr, options = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    metrics.totalRequests++;

    const parsedUrl = new URL(urlStr);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;

    const payload = options.body
      ? typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
      : null;

    const reqOptions = {
      method: options.method || 'GET',
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Connection: 'keep-alive',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(options.headers || {}),
      },
      agent,
    };

    let settled = false;
    let timeoutTimer = null;

    const finalize = (result) => {
      if (settled) return;
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      resolve(result);
    };

    // Explicit 60s request-level timeout
    timeoutTimer = setTimeout(() => {
      finalize({ ok: false, status: 0, error: 'Request timeout (60s)', elapsed: Date.now() - t0 });
      try {
        req.destroy(new Error('Request timeout (60s)'));
      } catch {
        // ignore
      }
    }, 60000);

    const req = lib.request(reqOptions, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        const elapsed = Date.now() - t0;
        metrics.latencies.push(elapsed);

        const status = res.statusCode || 0;
        const ok = status >= 200 && status < 300;

        if (status === 429) metrics.http429Responses++;
        if (status === 500) metrics.http500Responses++;
        if (status === 502) metrics.http502Responses++;
        if (status === 503) metrics.http503Responses++;

        if (ok) {
          metrics.successfulRequests++;
        } else {
          metrics.failedRequests++;
          if (metrics.failedRequests <= 5) {
            console.error(`[HTTP ${status} ERROR] ${options.method || 'GET'} ${urlStr} -> ${responseBody?.slice(0, 150)}`);
          }
        }

        let data = null;
        try {
          data = responseBody ? JSON.parse(responseBody) : null;
        } catch {
          data = null;
        }

        finalize({ ok, status, data, elapsed });
      });

      res.on('error', (err) => {
        const elapsed = Date.now() - t0;
        metrics.latencies.push(elapsed);
        metrics.failedRequests++;
        metrics.otherErrors++;
        finalize({ ok: false, status: 0, error: err.message, elapsed });
      });
    });

    req.on('error', (err) => {
      const elapsed = Date.now() - t0;
      metrics.latencies.push(elapsed);
      metrics.failedRequests++;
      if (metrics.failedRequests <= 5) {
        console.error(`[SOCKET ERROR] ${options.method || 'GET'} ${urlStr} -> ${err.message}`);
      }
      if (err.message?.includes('timeout')) {
        metrics.timeoutErrors++;
      } else {
        metrics.otherErrors++;
      }
      finalize({ ok: false, status: 0, error: err.message, elapsed });
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

// Single student full examination lifecycle simulator
async function runStudentScenario(metrics, vuIndex, runId, preResolvedExam) {
  const studentTag = `VU${vuIndex}-${runId}-${Date.now().toString().slice(-4)}`;

  const examId = preResolvedExam.examId;
  const roundId = preResolvedExam.roundId;

  // 1. Candidate Registration / Authentication
  let regRes = await request(metrics, `${BASE_URL}/api/students/register`, {
    method: 'POST',
    body: JSON.stringify({
      examId,
      fullName: `Concurrent Candidate ${vuIndex}`,
      email: `candidate_${studentTag}@loadtest.internal`,
      rollNumber: `ROLL-${studentTag}`,
    }),
  });

  if (!regRes.ok || !regRes.data?.data?.registrationId) {
    await new Promise((r) => setTimeout(r, 150));
    regRes = await request(metrics, `${BASE_URL}/api/students/register`, {
      method: 'POST',
      body: JSON.stringify({
        examId,
        fullName: `Concurrent Candidate ${vuIndex}`,
        email: `candidate_${studentTag}@loadtest.internal`,
        rollNumber: `ROLL-${studentTag}`,
      }),
    });
    if (!regRes.ok || !regRes.data?.data?.registrationId) return false;
  }
  const registrationId = regRes.data.data.registrationId;

  // Realistic think time reading instructions (200ms - 500ms)
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

  // 3. Start Examination Attempt & Retrieve Questions
  let startRes = await request(metrics, `${BASE_URL}/api/attempts/start`, {
    method: 'POST',
    body: JSON.stringify({
      registrationId,
      roundId,
    }),
  });

  if (!startRes.ok || !startRes.data?.data?.attempt) {
    await new Promise((r) => setTimeout(r, 150));
    startRes = await request(metrics, `${BASE_URL}/api/attempts/start`, {
      method: 'POST',
      body: JSON.stringify({
        registrationId,
        roundId,
      }),
    });
    if (!startRes.ok || !startRes.data?.data?.attempt) return false;
  }
  const attemptId = startRes.data.data.attempt.id;
  const questions = startRes.data.data.questions || [];

  if (questions.length === 0) return false;

  // 4. Answering Questions (Batched vs Individual)
  const options = ['A', 'B', 'C', 'D'];
  const questionsToAnswer = questions.slice(0, Math.min(15, questions.length));
  let seq = 1;

  if (BATCH_ANSWERS) {
    // Client-side batching model: students answer 3-4 questions per batch
    const batchSize = 3;
    for (let b = 0; b < questionsToAnswer.length; b += batchSize) {
      const slice = questionsToAnswer.slice(b, b + batchSize);
      const batchPayload = slice.map((q, idx) => ({
        questionId: q.id,
        selectedOption: options[(b + idx) % options.length],
        isMarkedForReview: (b + idx) % 4 === 0,
      }));

      // Realistic student think time between answering groups: 400ms - 800ms
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));

      const t0 = Date.now();
      await request(metrics, `${BASE_URL}/api/attempts/${attemptId}/batch-answers`, {
        method: 'POST',
        body: JSON.stringify({
          answers: batchPayload,
          seq: seq++,
        }),
      });
      metrics.answerSaveLatencies.push(Date.now() - t0);
    }
  } else {
    // Individual save requests
    for (let qIdx = 0; qIdx < questionsToAnswer.length; qIdx++) {
      const q = questionsToAnswer[qIdx];
      const pickedOption = options[qIdx % options.length];

      await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

      const t0 = Date.now();
      await request(metrics, `${BASE_URL}/api/attempts/${attemptId}/save-answer`, {
        method: 'POST',
        body: JSON.stringify({
          questionId: q.id,
          selectedOption: pickedOption,
          isMarkedForReview: qIdx % 3 === 0,
        }),
      });
      metrics.answerSaveLatencies.push(Date.now() - t0);
    }
  }

  // Timer Heartbeat / Status Check
  await request(metrics, `${BASE_URL}/api/attempts/${attemptId}/status`);

  // Simulated final review pause
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 400));

  // 5. Final Exam Submission
  const tSub = Date.now();
  const subRes = await request(metrics, `${BASE_URL}/api/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const subElapsed = Date.now() - tSub;
  metrics.submissionLatencies.push(subElapsed);

  if (subRes.ok && subRes.data?.success && subRes.data?.data?.result) {
    metrics.successfulSubmissions++;

    // 6. Verify Idempotency: Duplicate submit check
    const dupRes = await request(metrics, `${BASE_URL}/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (dupRes.ok && dupRes.data?.data?.result?.score === subRes.data.data.result.score) {
      metrics.idempotentResubmissionsVerified++;
    }
    return true;
  } else {
    metrics.failedSubmissions++;
    return false;
  }
}

// Executes a single tier with N concurrent virtual students
export async function executeTier(vus) {
  const runId = Math.random().toString(36).substring(2, 7);
  const metrics = createMetricsCollector();

  console.log(`\n====================================================================`);
  console.log(`TIER START: ${vus} CONCURRENT STUDENTS`);
  console.log(`Mode: ${BATCH_ANSWERS ? 'Batched Answer Sync (Production Mode)' : 'Individual Saves'}`);
  console.log(`Exam Slug: ${EXAM_SLUG}`);
  console.log(`Target: ${vus} parallel student lifecycles`);
  console.log(`====================================================================`);

  // Pre-resolve examination metadata once before launching virtual users
  console.log(`[HARNESS] Resolving target examination '${EXAM_SLUG}'...`);
  let preResolvedExam = null;
  const initialRes = await request(metrics, `${BASE_URL}/api/examinations/by-slug/${EXAM_SLUG}`);

  if (initialRes.ok && initialRes.data?.data) {
    const d = initialRes.data.data;
    const examData = Array.isArray(d) ? d.find((e) => e.slug === EXAM_SLUG) || d[0] : d;
    if (examData && examData.rounds && examData.rounds.length > 0) {
      preResolvedExam = {
        examId: examData.id,
        roundId: examData.rounds[0].id,
        name: examData.name,
      };
      console.log(`[HARNESS] Target Examination Resolved: '${preResolvedExam.name}'`);
      console.log(`[HARNESS] Exam ID: ${preResolvedExam.examId} | Round ID: ${preResolvedExam.roundId}\n`);
    }
  }

  if (!preResolvedExam) {
    console.error(`[HARNESS ERROR] Could not resolve exam '${EXAM_SLUG}'. Please verify that Next.js is running on ${BASE_URL}`);
    return null;
  }

  metrics.startTime = Date.now();

  // Launch all virtual students with realistic progressive ramp-up
  // Stagger entry over 3 to 45 seconds depending on VU count
  const rampUpDurationMs = Math.min(Math.max(vus * 40, 3000), 45000);
  console.log(`[HARNESS] Launching ${vus} virtual students (Ramp-up duration: ${(rampUpDurationMs / 1000).toFixed(1)}s)...`);

  let completedStudents = 0;
  let activeStudents = 0;

  // Real-time progress reporter every 2.5 seconds
  const progressTimer = setInterval(() => {
    const elapsedSec = ((Date.now() - metrics.startTime) / 1000).toFixed(1);
    const reqs = metrics.totalRequests;
    const currentRps = (reqs / (Math.max(0.1, Date.now() - metrics.startTime) / 1000)).toFixed(1);
    const pct = ((completedStudents / vus) * 100).toFixed(1);
    console.log(`[PROGRESS ${elapsedSec}s] Completed: ${completedStudents}/${vus} (${pct}%) | Active: ${activeStudents} | HTTP Requests: ${reqs} | RPS: ${currentRps} | Submissions: ${metrics.successfulSubmissions} | Errors: ${metrics.failedRequests}`);
  }, 2500);

  const promises = [];
  for (let i = 1; i <= vus; i++) {
    const launchDelay = Math.floor((i / vus) * rampUpDurationMs);
    promises.push(
      new Promise((resolve) => {
        setTimeout(async () => {
          activeStudents++;
          // Dynamic safety watchdog per virtual student: allows full lifecycle completion
          let watchdogTimer;
          const studentWatchdogMs = Math.max(300000, vus * 600);
          const watchdog = new Promise((res) => {
            watchdogTimer = setTimeout(() => res(false), studentWatchdogMs);
          });
          try {
            const res = await Promise.race([
              runStudentScenario(metrics, i, runId, preResolvedExam),
              watchdog,
            ]);
            clearTimeout(watchdogTimer);
            completedStudents++;
            activeStudents--;
            resolve(res);
          } catch {
            clearTimeout(watchdogTimer);
            completedStudents++;
            activeStudents--;
            resolve(false);
          }
        }, launchDelay);
      })
    );
  }

  const results = await Promise.all(promises);
  clearInterval(progressTimer);
  metrics.endTime = Date.now();

  const totalTimeSec = (metrics.endTime - metrics.startTime) / 1000;
  const rps = (metrics.totalRequests / totalTimeSec).toFixed(1);
  const successRate = metrics.totalRequests > 0 ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) : '0';
  const submissionRate = ((metrics.successfulSubmissions / vus) * 100).toFixed(1);

  const report = {
    vus,
    totalTimeSec: Number(totalTimeSec.toFixed(2)),
    totalRequests: metrics.totalRequests,
    requestsPerSecond: Number(rps),
    successfulRequests: metrics.successfulRequests,
    failedRequests: metrics.failedRequests,
    successRatePercent: Number(successRate),
    successfulSubmissions: metrics.successfulSubmissions,
    failedSubmissions: metrics.failedSubmissions,
    idempotentResubmissionsVerified: metrics.idempotentResubmissionsVerified,
    p50LatencyMs: percentile(metrics.latencies, 50),
    p90LatencyMs: percentile(metrics.latencies, 90),
    p95LatencyMs: percentile(metrics.latencies, 95),
    p99LatencyMs: percentile(metrics.latencies, 99),
    answerSaveP50Ms: percentile(metrics.answerSaveLatencies, 50),
    answerSaveP95Ms: percentile(metrics.answerSaveLatencies, 95),
    answerSaveP99Ms: percentile(metrics.answerSaveLatencies, 99),
    submissionP50Ms: percentile(metrics.submissionLatencies, 50),
    submissionP95Ms: percentile(metrics.submissionLatencies, 95),
    submissionP99Ms: percentile(metrics.submissionLatencies, 99),
    http429: metrics.http429Responses,
    http500: metrics.http500Responses,
    http502: metrics.http502Responses,
    http503: metrics.http503Responses,
    timeouts: metrics.timeoutErrors,
  };

  console.log(`\n--- RESULTS FOR ${vus} VUs ---`);
  console.log(`Duration:                 ${report.totalTimeSec} s`);
  console.log(`Total HTTP Requests:      ${report.totalRequests}`);
  console.log(`Throughput:               ${report.requestsPerSecond} req/sec`);
  console.log(`Request Success Rate:     ${report.successRatePercent}%`);
  console.log(`Exam Submissions:         ${report.successfulSubmissions} / ${vus} (${submissionRate}%)`);
  console.log(`Idempotent Submissions:   ${report.idempotentResubmissionsVerified} verified identical`);
  console.log(`Overall Latency:          P50=${report.p50LatencyMs}ms | P90=${report.p90LatencyMs}ms | P95=${report.p95LatencyMs}ms | P99=${report.p99LatencyMs}ms`);
  console.log(`Answer Autosave Latency:  P50=${report.answerSaveP50Ms}ms | P95=${report.answerSaveP95Ms}ms | P99=${report.answerSaveP99Ms}ms`);
  console.log(`Submission Latency:       P50=${report.submissionP50Ms}ms | P95=${report.submissionP95Ms}ms | P99=${report.submissionP99Ms}ms`);
  console.log(`Error Breakdown:          429=${report.http429} | 500=${report.http500} | 502=${report.http502} | 503=${report.http503} | Timeouts=${report.timeouts}`);

  return report;
}

async function runSuite() {
  const tiers = [50, 100, 250, 500, 750, 1000];
  const summaryReports = [];

  console.log(`\n====================================================================`);
  console.log(`STARTING PROGRESSIVE 6-TIER LOAD TEST SUITE (50 -> 1,000 STUDENTS)`);
  console.log(`====================================================================`);

  for (const tier of tiers) {
    const report = await executeTier(tier);
    if (report) {
      summaryReports.push(report);
    }
    // Cool down 3 seconds between tiers to let event loop and connection pool settle
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log(`\n====================================================================`);
  console.log(`FULL MULTI-TIER CAPACITY SUMMARY TABLE`);
  console.log(`====================================================================`);
  console.table(summaryReports.map((r) => ({
    'Students': r.vus,
    'Requests': r.totalRequests,
    'RPS': r.requestsPerSecond,
    'Success %': `${r.successRatePercent}%`,
    'Submits': `${r.successfulSubmissions}/${r.vus}`,
    'P95 Req (ms)': r.p95LatencyMs,
    'P95 Save (ms)': r.answerSaveP95Ms,
    'P95 Sub (ms)': r.submissionP95Ms,
    '5xx Errors': r.http500 + r.http502 + r.http503,
  })));

  return summaryReports;
}

async function main() {
  const args = process.argv.slice(2);
  const isSuite = args.includes('--suite') || RUN_MODE === 'suite';
  const customVUsArg = args.find((a) => a.startsWith('--vus='));
  const targetVUs = customVUsArg ? parseInt(customVUsArg.split('=')[1], 10) : TARGET_VUS;

  if (isSuite) {
    await runSuite();
  } else {
    await executeTier(targetVUs);
  }
}

// Only auto-run if directly called with node
if (process.argv[1]?.endsWith('exam-load-runner.mjs')) {
  main().catch((err) => {
    console.error('Fatal load test harness error:', err);
    process.exit(1);
  });
}
