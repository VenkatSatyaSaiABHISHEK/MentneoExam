import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string; registrationId: string }> }
) {
  try {
    const { registrationId } = await params;
    const result = await db.resetStudentWarnings(registrationId);

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Reset warnings error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset warnings' },
      { status: 500 }
    );
  }
}
