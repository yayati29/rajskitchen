import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cancelOrder } from '@/data/orders';

export async function POST(request, { params }) {
  try {
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('adminAuth')?.value === '1';
    const body = await request.json().catch(() => ({}));
    const phone = body?.phone || null;

    if (!isAdmin && !phone) {
      return NextResponse.json({ error: 'Phone number is required to cancel.' }, { status: 400 });
    }

    const { id } = await params;
    const order = await cancelOrder({
      orderId: id,
      phone: isAdmin ? null : phone,
      reason: body?.reason,
      actor: isAdmin ? 'admin' : 'customer',
    });

    return NextResponse.json({ order });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Unable to cancel order.' },
      { status },
    );
  }
}
