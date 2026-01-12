import { NextResponse } from 'next/server';
import { getOrders } from '@/data/orders';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Prefer explicit version file written on order creation
    try {
      const versionFile = path.join(process.cwd(), 'data', 'orders-version.json');
      const raw = await fs.readFile(versionFile, 'utf-8').catch(() => null);
      if (raw) {
        const parsed = JSON.parse(raw || '{}');
        if (parsed.version) {
          return NextResponse.json({ version: parsed.version });
        }
      }
    } catch (fileErr) {
      // proceed to compute a hash if version file missing
    }

    const orders = await getOrders();
    const raw = JSON.stringify(orders || []);
    const version = crypto.createHash('sha256').update(raw).digest('hex');
    return NextResponse.json({ version });
  } catch (error) {
    console.error('Unable to compute orders version', error);
    return NextResponse.json({ version: null }, { status: 500 });
  }
}
