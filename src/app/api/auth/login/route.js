import { NextResponse } from 'next/server';

export async function POST(request) {
  const { email, password } = await request.json();

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { message: 'Server missing ADMIN_EMAIL or ADMIN_PASSWORD' },
      { status: 500 },
    );
  }

  if (email === adminEmail && password === adminPassword) {
    const response = NextResponse.json({ success: true });
    response.cookies.set('adminAuth', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return response;
  }

  return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
}
