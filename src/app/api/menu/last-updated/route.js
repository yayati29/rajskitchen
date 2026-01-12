import { NextResponse } from 'next/server';
import { readMenuData } from '@/data/menuStore';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const menu = await readMenuData();
    const raw = JSON.stringify(menu || {});
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return NextResponse.json({ version: hash });
  } catch (error) {
    console.error('Unable to compute menu version', error);
    return NextResponse.json({ version: null }, { status: 500 });
  }
}
