import { NextResponse } from 'next/server';
import { readMenuData, writeMenuData } from '@/data/menuStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const menu = await readMenuData();
  return NextResponse.json({ menu });
}

export async function PUT(request) {
  try {
    const adminCookie = request.cookies.get('adminAuth');
    if (adminCookie?.value !== '1') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object' || !payload.menu) {
      return NextResponse.json({ error: 'Menu payload is required.' }, { status: 400 });
    }
    const updated = await writeMenuData(payload.menu);
    return NextResponse.json({ menu: updated });
  } catch (error) {
    console.error('Unable to update menu data', error);
    return NextResponse.json({ error: error?.message || 'Failed to save menu data.' }, { status: 500 });
  }
}
