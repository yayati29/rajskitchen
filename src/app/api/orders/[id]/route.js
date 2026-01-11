import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOrderById, getOrderForTracking } from '@/data/orders';

export async function GET(request, { params }) {
  const { id } = await params;
  const url = new URL(request.url);
  const phone = url.searchParams.get('phone');

  try {
    if (phone) {
      const order = await getOrderForTracking(id, phone);
      return NextResponse.json({ order });
    }

    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('adminAuth')?.value === '1';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Phone number required to track order.' }, { status: 400 });
    }

    const order = await getOrderById(id);
    return NextResponse.json({ order });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Unable to fetch order.' },
      { status },
    );
  }
}
