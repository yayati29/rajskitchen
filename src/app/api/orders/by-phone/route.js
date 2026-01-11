import { NextResponse } from 'next/server';
import { getOrdersByPhone } from '@/data/orders';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required.' },
        { status: 400 },
      );
    }

    const orders = await getOrdersByPhone(phone);
    return NextResponse.json({ orders });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Unable to find orders for that phone number.' },
      { status },
    );
  }
}
