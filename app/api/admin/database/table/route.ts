import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/db/pg';
import { db } from '@/lib/db/store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableName = (searchParams.get('table') || 'students').trim().toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') || '25', 10)));
    const search = (searchParams.get('search') || '').trim();
    const sortColumn = (searchParams.get('sortColumn') || '').trim();
    const sortOrder = searchParams.get('sortOrder')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Strictly validate table name to prevent SQL injection
    if (!/^[a-z0-9_]+$/.test(tableName)) {
      return NextResponse.json(
        { success: false, error: 'Invalid table name provided.' },
        { status: 400 }
      );
    }

    let columns: Array<{ name: string; type: string; nullable: boolean }> = [];
    let rows: any[] = [];
    let totalCount = 0;
    let queryError: string | null = null;

    if (tableName === 'students' || tableName === 'registrations') {
      await db.syncMemoryToPg().catch(() => {});
    }

    try {
      // 1. Fetch column metadata for this table
      const colsRes = await queryPg(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position ASC;
      `, [tableName]);

      columns = (colsRes.rows || []).map((c: any) => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === 'YES',
      }));

      // Validate sortColumn if provided
      const validColNames = new Set(columns.map((c) => c.name));
      let effectiveSortCol = sortColumn && validColNames.has(sortColumn) ? sortColumn : null;
      if (!effectiveSortCol) {
        if (validColNames.has('created_at')) effectiveSortCol = 'created_at';
        else if (validColNames.has('registered_at')) effectiveSortCol = 'registered_at';
        else if (validColNames.has('id')) effectiveSortCol = 'id';
      }

      // 2. Build Search Clause if provided
      let whereClause = '';
      const queryParams: any[] = [];

      if (search) {
        const textCols = columns.filter((c) =>
          ['text', 'character varying', 'uuid', 'jsonb', 'numeric', 'integer'].includes(c.type)
        );
        if (textCols.length > 0) {
          queryParams.push(`%${search}%`);
          const searchConditions = textCols.map((c) => `"${c.name}"::text ILIKE $1`);
          whereClause = `WHERE (${searchConditions.join(' OR ')})`;
        }
      }

      // 3. Count matching records
      const countRes = await queryPg(
        `SELECT COUNT(*)::int as count FROM public."${tableName}" ${whereClause}`,
        queryParams
      );
      totalCount = countRes.rows?.[0]?.count || 0;

      // 4. Fetch Paginated Records
      const offset = (page - 1) * limit;
      let orderClause = effectiveSortCol ? `ORDER BY "${effectiveSortCol}" ${sortOrder}` : '';

      const dataQuery = `
        SELECT * FROM public."${tableName}"
        ${whereClause}
        ${orderClause}
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;

      const dataRes = await queryPg(dataQuery, [...queryParams, limit, offset]);
      rows = dataRes.rows || [];
    } catch (err) {
      console.warn(`[Database Studio table query warning for ${tableName}]`, err);
      queryError = err instanceof Error ? err.message : 'Database query failed';
    }

    // Fallback: If table is empty or error occurred, attempt in-memory hydration
    if (rows.length === 0 && !search && page === 1) {
      try {
        if (tableName === 'examinations') {
          const exams = await db.getExaminations();
          if (exams.length > 0) {
            rows = exams;
            totalCount = exams.length;
            if (columns.length === 0) {
              columns = Object.keys(exams[0] || {}).map((k) => ({ name: k, type: 'text', nullable: true }));
            }
          }
        }
      } catch {}
    }

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return NextResponse.json({
      success: true,
      data: {
        table: tableName,
        columns,
        rows,
        totalCount,
        page,
        limit,
        totalPages,
        error: queryError,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to query table data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
