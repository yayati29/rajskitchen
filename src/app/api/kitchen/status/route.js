import { NextResponse } from 'next/server';
import { getKitchenStatus, setKitchenStatus } from '@/data/kitchenStatus';

export async function GET() {
  const status = await getKitchenStatus();
  return NextResponse.json(status);
}

export async function PATCH(request) {
  try {
    const payload = await request.json();
    if (typeof payload?.isOpen !== 'boolean') {
      return NextResponse.json({ error: 'Missing isOpen flag.' }, { status: 400 });
    }
    const updated = await setKitchenStatus({ isOpen: payload.isOpen, message: payload.message });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Unable to update kitchen status', error);
    return NextResponse.json({ error: 'Failed to update kitchen status.' }, { status: 500 });
  }
}
