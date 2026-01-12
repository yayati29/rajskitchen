import { NextResponse } from 'next/server';
import { addOrder } from '@/data/orders';
import { getKitchenStatus } from '@/data/kitchenStatus';
import { promises as fs } from 'fs';
import path from 'path';

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

    console.log('Creating order for customer:', customer.name, customer.phone);
    const { order } = await addOrder({ customer, items, totals, fulfillment });
    console.log('Order created successfully:', order.publicId);

    // Bump on-disk orders version so admin polling detects change reliably
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      const versionFile = path.join(dataDir, 'orders-version.json');
      const versionPayload = { version: new Date().toISOString() };
      await fs.writeFile(versionFile, JSON.stringify(versionPayload), 'utf-8');
    } catch (versionErr) {
      console.warn('Unable to write orders version file', versionErr);
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Failed to create order:', error);
    const status = error.status || 500;
    const message = error.message || 'Unable to place order right now. Please try again.';
    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
