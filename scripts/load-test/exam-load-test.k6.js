import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ============================================================================
// EXAM PORTAL — 500 CONCURRENT USERS LOAD TEST & CAPACITY AUDIT (k6 SUITE)
// Target: Support 500 students writing an examination simultaneously.
// ============================================================================

// Configuration from environment variables with sensible defaults
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const EXAM_SLUG = __ENV.EXAM_SLUG || 'cs-engineering-assessment-2026';
const TEST_RUN_ID = __ENV.RUN_ID || Date.now().toString().slice(-6);

// Custom Performance Metrics (Target Acceptance Criteria Tracking)
const authDuration = new Trend('auth_duration', true);
const examLoadDuration = new Trend('exam_load_duration', true);
const attemptStartDuration = new Trend('attempt_start_duration', true);
const answerSaveDuration = new Trend('answer_save_duration', true);
const submissionDuration = new Trend('submission_duration', true);
const statusPollDuration = new Trend('status_poll_duration', true);

const successfulSubmissions = new Counter('successful_submissions');
const failedSubmissions = new Counter('failed_submissions');
const answerSaveSuccessRate = new Rate('answer_save_success_rate');
const submissionSuccessRate = new Rate('submission_success_rate');
const rateLimitedCount = new Counter('http_429_rate_limited');
const serverErrorCount = new Counter('http_5xx_server_errors');

export const options = {
  scenarios: {
    // Multi-Stage Load Progression: 50 -> 100 -> 200 -> 300 -> 400 -> 500 Students
    gradual_examination_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },    // Tier 1: 50 students
        { duration: '2m', target: 50 },    // Steady at 50 students
        { duration: '1m', target: 100 },   // Tier 2: 100 students
        { duration: '2m', target: 100 },   // Steady at 100 students
        { duration: '2m', target: 200 },   // Tier 3: 200 students
        { duration: '3m', target: 200 },   // Steady at 200 students
        { duration: '2m', target: 300 },   // Tier 4: 300 students
        { duration: '3m', target: 300 },   // Steady at 300 students
        { duration: '2m', target: 400 },   // Tier 5: 400 students
        { duration: '3m', target: 400 },   // Steady at 400 students
        { duration: '3m', target: 500 },   // Tier 6: Ramp to 500 students
        { duration: '15m', target: 500 },  // Sustained examination activity at 500 students
        { duration: '2m', target: 0 },     // Ramp down / submissions completed
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Target Acceptance Criteria:
    // 1. At least 99.9% successful application requests (less than 0.1% failure)
    http_req_failed: ['rate<0.001'],
    // 2. P95 response time below 2 seconds for normal exam operations
    http_req_duration: ['p(95)<2000'],
    // 3. P95 answer-saving latency below 2 seconds
    answer_save_duration: ['p(95)<2000'],
    // 4. P95 submission latency below 3 seconds
    submission_duration: ['p(95)<3000'],
    // 5. Zero unhandled server 5xx errors
    http_5xx_server_errors: ['count==0'],
  },
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export default function () {
  const vuId = __VU;
  const iterId = __ITER;
  const candidateRoll = `LOAD-VU${vuId}-${TEST_RUN_ID}`;
  const candidateEmail = `load_student_${vuId}_${iterId}@loadtest.internal`;
  const candidateName = `Test Candidate ${vuId}`;

  let examId = null;
  let roundId = null;
  let registrationId = null;
  let attemptId = null;
  let assignedQuestions = [];

  // ==========================================================================
  // STEP 1 & 2: Access Examination Website & Authenticate Test Account
  // ==========================================================================
  group('1_Access_And_Resolve_Exam', function () {
    const t0 = Date.now();
    // Query optimized by-slug endpoint first, falling back to full catalog
    let res = http.get(`${BASE_URL}/api/examinations/by-slug/${EXAM_SLUG}`, { headers: JSON_HEADERS });
    if (res.status !== 200) {
      res = http.get(`${BASE_URL}/api/examinations`, { headers: JSON_HEADERS });
    }
    examLoadDuration.add(Date.now() - t0);

    check(res, {
      'examinations_loaded_200': (r) => r.status === 200,
      'examinations_payload_valid': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.success && body.data) {
            const found = Array.isArray(body.data)
              ? body.data.find((e) => e.slug === EXAM_SLUG)
              : body.data;
            if (found && found.id) {
              examId = found.id;
              if (found.rounds && found.rounds.length > 0) {
                roundId = found.rounds[0].id;
              }
              return true;
            }
          }
          return false;
        } catch {
          return false;
        }
      },
    });

    if (res.status === 429) rateLimitedCount.add(1);
    if (res.status >= 500) serverErrorCount.add(1);
  });

  if (!examId || !roundId) {
    sleep(2);
    return;
  }

  // Register Candidate Test Account
  group('2_Authenticate_Student', function () {
    const t0 = Date.now();
    const payload = JSON.stringify({
      examId: examId,
      fullName: candidateName,
      email: candidateEmail,
      rollNumber: candidateRoll,
    });

    const res = http.post(`${BASE_URL}/api/students/register`, payload, { headers: JSON_HEADERS });
    authDuration.add(Date.now() - t0);

    const ok = check(res, {
      'student_registered_200': (r) => r.status === 200,
      'registration_id_obtained': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.success && body.data && body.data.registrationId) {
            registrationId = body.data.registrationId;
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    });

    if (!ok && res.status >= 500) serverErrorCount.add(1);
    if (res.status === 429) rateLimitedCount.add(1);
  });

  if (!registrationId) {
    sleep(2);
    return;
  }

  // Small pacing delay simulating reading instructions (1 to 3 seconds)
  sleep(1 + Math.random() * 2);

  // ==========================================================================
  // STEP 3 & 4: Exam Start & Question Retrieval
  // ==========================================================================
  group('3_Start_Exam_And_Retrieve_Questions', function () {
    const t0 = Date.now();
    const payload = JSON.stringify({
      registrationId: registrationId,
      roundId: roundId,
    });

    const res = http.post(`${BASE_URL}/api/attempts/start`, payload, { headers: JSON_HEADERS });
    attemptStartDuration.add(Date.now() - t0);

    check(res, {
      'attempt_started_200': (r) => r.status === 200,
      'questions_delivered': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.success && body.data && body.data.attempt) {
            attemptId = body.data.attempt.id;
            assignedQuestions = body.data.questions || [];
            return assignedQuestions.length > 0;
          }
          return false;
        } catch {
          return false;
        }
      },
    });

    if (res.status === 429) rateLimitedCount.add(1);
    if (res.status >= 500) serverErrorCount.add(1);
  });

  if (!attemptId || assignedQuestions.length === 0) {
    sleep(2);
    return;
  }

  // ==========================================================================
  // STEP 5, 6, 7: Navigate, Answer Questions, and Autosave
  // ==========================================================================
  group('4_Answer_Questions_And_Autosave', function () {
    // Simulate student answering a subset of questions with realistic think time
    const optionsPool = ['A', 'B', 'C', 'D'];
    const questionsToAnswer = assignedQuestions.slice(0, Math.min(15, assignedQuestions.length));

    for (let i = 0; i < questionsToAnswer.length; i++) {
      const q = questionsToAnswer[i];
      const selectedOption = optionsPool[Math.floor(Math.random() * optionsPool.length)];

      // Realistic student think time between questions: 2 to 5 seconds
      sleep(2 + Math.random() * 3);

      const t0 = Date.now();
      const savePayload = JSON.stringify({
        questionId: q.id,
        selectedOption: selectedOption,
        isMarkedForReview: i % 4 === 0,
      });

      const res = http.post(`${BASE_URL}/api/attempts/${attemptId}/save-answer`, savePayload, {
        headers: JSON_HEADERS,
      });
      const duration = Date.now() - t0;
      answerSaveDuration.add(duration);

      const isSuccess = res.status === 200;
      answerSaveSuccessRate.add(isSuccess);

      check(res, {
        'answer_saved_200': (r) => r.status === 200,
      });

      if (res.status === 429) rateLimitedCount.add(1);
      if (res.status >= 500) serverErrorCount.add(1);

      // Periodically simulate background timer heartbeat / status sync
      if (i === 5 || i === 10) {
        const pollT0 = Date.now();
        const pollRes = http.get(`${BASE_URL}/api/attempts/${attemptId}/status`, {
          headers: JSON_HEADERS,
        });
        statusPollDuration.add(Date.now() - pollT0);
        check(pollRes, { 'status_polled_200': (r) => r.status === 200 });
      }
    }
  });

  // Short pause before final submission (reviewing answers)
  sleep(2 + Math.random() * 2);

  // ==========================================================================
  // STEP 8 & 9: Exam Submission & Confirmation
  // ==========================================================================
  group('5_Submit_Examination_And_Confirm', function () {
    const t0 = Date.now();
    const res = http.post(`${BASE_URL}/api/attempts/${attemptId}/submit`, '{}', {
      headers: JSON_HEADERS,
    });
    const duration = Date.now() - t0;
    submissionDuration.add(duration);

    const isSuccess = res.status === 200;
    submissionSuccessRate.add(isSuccess);

    const ok = check(res, {
      'submission_confirmed_200': (r) => r.status === 200,
      'score_evaluated': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success && body.data && body.data.result && typeof body.data.result.score === 'number';
        } catch {
          return false;
        }
      },
    });

    if (ok) {
      successfulSubmissions.add(1);
    } else {
      failedSubmissions.add(1);
      if (res.status >= 500) serverErrorCount.add(1);
      if (res.status === 429) rateLimitedCount.add(1);
    }
  });

  // Pacing before virtual user terminates or loops
  sleep(3);
}

