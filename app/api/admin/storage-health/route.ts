import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET() {
  try {
    const metrics = await db.getComprehensiveStorageMetrics();
    return NextResponse.json({ success: true, data: metrics });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to query storage health';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

