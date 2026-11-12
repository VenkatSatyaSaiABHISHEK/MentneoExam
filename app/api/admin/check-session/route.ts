import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_auth_session');

    const isAuthenticated = Boolean(session && session.value && session.value.startsWith('authenticated_'));

    return NextResponse.json({ authenticated: isAuthenticated });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}

