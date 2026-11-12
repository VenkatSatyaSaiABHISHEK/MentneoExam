import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET() {
  try {
    const logs = await db.getAuditLogs();
    return NextResponse.json({ success: true, data: logs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to query audit logs';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

