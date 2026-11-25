import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/db/pg';
import { db } from '@/lib/db/store';

const KNOWN_TABLES = [
  'examinations',
  'examination_rounds',
  'questions',
  'question_options',
  'answer_keys',
  'students',
  'registrations',
  'examination_attempts',
  'attempt_answers',
  'examination_results',
  'cheating_events',
  'examination_audit_logs',
];

export async function GET() {
  try {
    let tableNames: string[] = [];
    let isConnected = true;

    try {
      const { rows } = await queryPg(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC;
      `);
      if (rows && rows.length > 0) {
        tableNames = rows.map((r: { table_name: string }) => r.table_name);
      }
    } catch (dbErr) {
      console.warn('[Database Studio schema fetch warning]', dbErr);
      isConnected = false;
    }

    // Ensure our application's primary tables are always represented
    const allTableNames = Array.from(new Set([...tableNames, ...KNOWN_TABLES]));

    // Fetch columns & count for each table
    const tables = await Promise.all(
      allTableNames.map(async (name) => {
        let columns: Array<{ name: string; type: string; nullable: boolean }> = [];
        let rowCount = 0;

        if (isConnected) {
          try {
            const [colsRes, countRes] = await Promise.all([
              queryPg(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY ordinal_position ASC;
              `, [name]),
              queryPg(`SELECT COUNT(*)::int as count FROM public."${name}"`),
            ]);

            columns = (colsRes.rows || []).map((c: any) => ({
              name: c.column_name,
              type: c.data_type,
              nullable: c.is_nullable === 'YES',
            }));
            rowCount = countRes.rows?.[0]?.count || 0;
          } catch {
            // Fallback for this individual table
          }
        }

        // In-memory fallback if count is 0 or offline
        if (rowCount === 0) {
          const stats = await db.getAdminStats();
          if (name === 'examinations') rowCount = stats.totalExaminations || 0;
          else if (name === 'students') rowCount = stats.totalStudents || 0;
          else if (name === 'questions') {
            try {
              const qs = await db.getAllQuestions();
              rowCount = qs.length || 0;
            } catch {
              rowCount = 0;
            }
          } else if (name === 'examination_attempts') rowCount = stats.totalSubmissions || 0;
        }

        return {
          name,
          rowCount,
          columns,
        };
      })
    );

    // Sort so primary operational tables appear first, followed by others
    tables.sort((a, b) => {
      const idxA = KNOWN_TABLES.indexOf(a.name);
      const idxB = KNOWN_TABLES.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      data: {
        tables,
        database: 'PostgreSQL 17 Authoritative ACID Storage',
        connected: isConnected,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to query database schema';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
