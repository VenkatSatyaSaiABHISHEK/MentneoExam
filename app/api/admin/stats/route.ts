import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET() {
  try {
    const stats = await db.getAdminStats();
    return NextResponse.json({ success: true, data: stats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

