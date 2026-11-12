import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, pin, reseed } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Security PIN is required to authorize database maintenance.' },
        { status: 400 }
      );
    }

    const cleanPin = pin.trim();
    const expectedPin = process.env.ADMIN_PIN || '31012005';

    if (cleanPin !== expectedPin) {
      return NextResponse.json(
        { success: false, error: 'Incorrect 8-digit security PIN. Maintenance action blocked.' },
        { status: 401 }
      );
    }

    const validActions = ['full_reset', 'clear_attempts', 'clear_logs', 'clear_ocr', 'clear_students'];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid database action requested.' },
        { status: 400 }
      );
    }

    const result = await db.cleanDatabase(action, Boolean(reseed));
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute database maintenance';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

