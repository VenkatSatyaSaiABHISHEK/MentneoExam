import fs from 'fs';
import path from 'path';

export interface ResilientSnapshot {
  version: number;
  lastUpdated: string;
  examinations: Record<string, any>;
  rounds: Record<string, any>;
  students: Record<string, any>;
  registrations: Record<string, any>;
  questions: Record<string, any>;
  answerKeys: Record<string, any>;
  attempts: Record<string, any>;
  answers: Record<string, any>;
  results: Record<string, any>;
  qualifications: Record<string, any>;
  cheatingEvents: any[];
  auditLogs: any[];
  ocrJobs: Record<string, any>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'exams_resilient_store.json');
const TMP_FILE_PATH = path.join(DATA_DIR, 'exams_resilient_store.json.tmp');
const WAL_FILE_PATH = path.join(DATA_DIR, 'answers_delta.wal.jsonl');

class ResilientStorageEngine {
  private saveTimeout: NodeJS.Timeout | null = null;
  private isSaving = false;
  private hasPendingWrite = false;
  private lastSavedTime: string | null = null;
  private walPendingBuffer: string[] = [];
  private isWalWriting = false;
  private walFlushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureDirectory();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (err) {
      console.error('[ResilientStorage] Failed to create data directory:', err);
    }
  }

  public loadSnapshot(): ResilientSnapshot | null {
    try {
      let snapshot: ResilientSnapshot | null = null;

      if (fs.existsSync(FILE_PATH)) {
        const raw = fs.readFileSync(FILE_PATH, 'utf-8');
        if (raw && raw.trim().length > 0) {
          snapshot = JSON.parse(raw) as ResilientSnapshot;
          this.lastSavedTime = snapshot.lastUpdated || null;
        }
      }

      if (!snapshot) return null;

      // Replay uncheckpointed answer deltas from WAL log
      if (fs.existsSync(WAL_FILE_PATH)) {
        try {
          const walContent = fs.readFileSync(WAL_FILE_PATH, 'utf-8');
          const lines = walContent.split('\n').filter((l) => l.trim().length > 0);
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (entry.op === 'UPSERT_ANSWER' && entry.data) {
                const ans = entry.data;
                const key = `${ans.attempt_id}_${ans.question_id}`;
                if (!snapshot.answers) snapshot.answers = {};
                snapshot.answers[key] = ans;
              }
            } catch {
              // Ignore corrupt partial lines
            }
          }
        } catch (walErr) {
          console.error('[ResilientStorage] Error replaying WAL:', walErr);
        }
      }

      return snapshot;
    } catch (err) {
      console.error('[ResilientStorage] Error loading snapshot from disk:', err);
      return null;
    }
  }

  /**
   * Append-Only Delta Persistence (WAL):
   * Appends answer updates asynchronously without freezing the single-threaded Node.js event loop.
   */
  public async appendAnswerDeltas(deltas: any[]): Promise<void> {
    if (!deltas || deltas.length === 0) return;

    const lines = deltas.map((d) =>
      JSON.stringify({
        op: 'UPSERT_ANSWER',
        data: d,
        ts: Date.now(),
      })
    );

    this.walPendingBuffer.push(...lines);

    // Micro-batching buffer: flush WAL every 100ms instead of thrashing NTFS on every request
    if (!this.walFlushTimer) {
      this.walFlushTimer = setTimeout(() => {
        this.walFlushTimer = null;
        this.drainWalBuffer();
      }, 100);
    }
  }

  private async drainWalBuffer() {
    if (this.isWalWriting || this.walPendingBuffer.length === 0) return;
    this.isWalWriting = true;

    try {
      this.ensureDirectory();
      const chunk = this.walPendingBuffer.join('\n') + '\n';
      this.walPendingBuffer = [];

      await fs.promises.appendFile(WAL_FILE_PATH, chunk, 'utf-8');
    } catch (err) {
      console.error('[ResilientStorage] Failed to append to WAL:', err);
    } finally {
      this.isWalWriting = false;
      if (this.walPendingBuffer.length > 0 && !this.walFlushTimer) {
        this.walFlushTimer = setTimeout(() => {
          this.walFlushTimer = null;
          this.drainWalBuffer();
        }, 100);
      }
    }
  }

  public scheduleSave(snapshotProvider: () => ResilientSnapshot) {
    this.hasPendingWrite = true;
    if (this.saveTimeout) {
      return;
    }

    // Debounce checkpoint writes by 30 seconds so answer traffic runs purely on WAL
    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      await this.flushAsync(snapshotProvider);
    }, 30000);
  }

  public async flushAsync(snapshotProvider: () => ResilientSnapshot): Promise<boolean> {
    if (this.isSaving) {
      this.hasPendingWrite = true;
      return false;
    }

    this.isSaving = true;
    this.hasPendingWrite = false;

    try {
      this.ensureDirectory();
      const snapshot = snapshotProvider();
      snapshot.lastUpdated = new Date().toISOString();
      snapshot.version = 1;

      // Ultra-fast compact serialization without blocking indentation
      const serialized = JSON.stringify(snapshot);

      // Async atomic write: write to temp file then rename
      await fs.promises.writeFile(TMP_FILE_PATH, serialized, 'utf-8');
      await fs.promises.rename(TMP_FILE_PATH, FILE_PATH);

      this.lastSavedTime = snapshot.lastUpdated;
      this.isSaving = false;

      // Truncate WAL file now that snapshot contains all updates
      try {
        if (fs.existsSync(WAL_FILE_PATH)) {
          await fs.promises.writeFile(WAL_FILE_PATH, '', 'utf-8');
        }
      } catch {
        // ignore
      }

      if (this.hasPendingWrite) {
        this.scheduleSave(snapshotProvider);
      }
      return true;
    } catch (err) {
      console.error('[ResilientStorage] Failed to flush snapshot to disk:', err);
      this.isSaving = false;
      return false;
    }
  }

  public flushSync(snapshotProvider: () => ResilientSnapshot): boolean {
    if (this.isSaving) {
      this.hasPendingWrite = true;
      return false;
    }

    this.isSaving = true;
    this.hasPendingWrite = false;

    try {
      this.ensureDirectory();
      const snapshot = snapshotProvider();
      snapshot.lastUpdated = new Date().toISOString();
      snapshot.version = 1;

      const serialized = JSON.stringify(snapshot);

      // Atomic write: write to temp file then rename
      fs.writeFileSync(TMP_FILE_PATH, serialized, 'utf-8');
      fs.renameSync(TMP_FILE_PATH, FILE_PATH);

      this.lastSavedTime = snapshot.lastUpdated;
      this.isSaving = false;

      // Truncate WAL file now that snapshot contains all updates
      try {
        if (fs.existsSync(WAL_FILE_PATH)) {
          fs.writeFileSync(WAL_FILE_PATH, '', 'utf-8');
        }
      } catch {
        // ignore
      }

      if (this.hasPendingWrite) {
        this.scheduleSave(snapshotProvider);
      }
      return true;
    } catch (err) {
      console.error('[ResilientStorage] Failed to flush snapshot to disk:', err);
      this.isSaving = false;
      return false;
    }
  }

  public getHealthStatus(): {
    isAvailable: boolean;
    filePath: string;
    walFilePath: string;
    lastSaved: string | null;
    fileSizeBytes: number;
    walSizeBytes: number;
  } {
    let size = 0;
    let walSize = 0;
    let exists = false;
    try {
      if (fs.existsSync(FILE_PATH)) {
        exists = true;
        const stat = fs.statSync(FILE_PATH);
        size = stat.size;
      }
      if (fs.existsSync(WAL_FILE_PATH)) {
        const walStat = fs.statSync(WAL_FILE_PATH);
        walSize = walStat.size;
      }
    } catch {
      // ignore
    }

    return {
      isAvailable: exists || fs.existsSync(DATA_DIR),
      filePath: FILE_PATH,
      walFilePath: WAL_FILE_PATH,
      lastSaved: this.lastSavedTime,
      fileSizeBytes: size,
      walSizeBytes: walSize,
    };
  }
}

export const resilientStorage = new ResilientStorageEngine();
