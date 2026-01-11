import { NextResponse } from 'next/server';
import { addOrder } from '@/data/orders';
import { getKitchenStatus } from '@/data/kitchenStatus';

const validateCustomer = (customer) => {
  if (!customer) {
    return false;
  }

  return (
    typeof customer.name === 'string' &&
    typeof customer.phone === 'string' &&
    typeof customer.building === 'string' &&
    typeof customer.apartment === 'string'
  );
};

export async function POST(request) {
  try {
    const kitchenStatus = await getKitchenStatus();
    if (!kitchenStatus.isOpen) {
      return NextResponse.json(
        { error: kitchenStatus.message || 'Kitchen is temporarily closed.' },
        { status: 503 },
      );
    }

    const payload = await request.json();
    const { customer, items, totals, fulfillment } = payload || {};

    if (!validateCustomer(customer)) {
      return NextResponse.json(
        { error: 'Please provide complete delivery details.' },
        { status: 400 },
      );
    }

    if (!Array.isArray(items) || !items.length) {
      return NextResponse.json(
        { error: 'Your cart is empty.' },
        { status: 400 },
      );
    }

    const { order } = await addOrder({ customer, items, totals, fulfillment });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Failed to create order', error);
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Unable to place order right now. Please try again.' },
      { status },
    );
  }
}
