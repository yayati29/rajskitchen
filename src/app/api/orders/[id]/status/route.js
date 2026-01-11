import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateOrderStatus } from '@/data/orders';

export async function PATCH(request, { params }) {
  try {
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('adminAuth')?.value === '1';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const nextStatus = body?.status;
    if (!nextStatus) {
      return NextResponse.json({ error: 'Status is required.' }, { status: 400 });
    }

    const { id } = await params;
    const order = await updateOrderStatus(id, nextStatus);
    return NextResponse.json({ order });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Unable to update order.' },
      { status },
    );
  }
}
