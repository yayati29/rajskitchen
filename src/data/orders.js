import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSupabaseAdminClient } from '@/lib/supabaseServer';

export class OrderStoreError extends Error {
	constructor(message, status = 400) {
		super(message);
		this.name = 'OrderStoreError';
		this.status = status;
	}
}

const STATUS_FLOW = {
	Pending: ['Preparing', 'Cancelled'],
	Preparing: ['Done', 'Cancelled'],
	Done: ['Out for Delivery', 'Cancelled'],
	'Out for Delivery': ['Delivered', 'Cancelled'],
	Delivered: [],
	Cancelled: [],
};

const dataDirectory = path.join(process.cwd(), 'data');
const ordersFilePath = path.join(dataDirectory, 'orders.json');
const supabase = getSupabaseAdminClient();
const supabaseEnabled = Boolean(supabase);
const ORDERS_TABLE = 'orders';

async function ensureStore() {
	await fs.mkdir(dataDirectory, { recursive: true });
	try {
		await fs.access(ordersFilePath);
	} catch {
		await fs.writeFile(
			ordersFilePath,
			JSON.stringify({ orders: [] }, null, 2),
			'utf-8',
		);
	}
}

function buildScheduleIso(date, time) {
	if (!date || !time) {
		return null;
	}
	const isoCandidate = new Date(`${date}T${time}:00`);
	if (Number.isNaN(isoCandidate.getTime())) {
		return null;
	}
	return isoCandidate.toISOString();
}

function normalizeFulfillmentDetails(fulfillmentInput = {}) {
	const method = fulfillmentInput.method === 'pickup' ? 'pickup' : 'delivery';
	const scheduleInput = fulfillmentInput.schedule || {};
	if (scheduleInput.mode === 'later' && scheduleInput.date && scheduleInput.time) {
		const iso = buildScheduleIso(scheduleInput.date, scheduleInput.time);
		return {
			method,
			schedule: {
				mode: 'later',
				date: scheduleInput.date,
				time: scheduleInput.time,
				iso,
			},
		};
	}
	return {
		method,
		schedule: {
			mode: 'now',
			asap: true,
		},
	};
}

async function readOrdersFromDisk() {
	await ensureStore();
	try {
		const fileContents = await fs.readFile(ordersFilePath, 'utf-8');
		const parsed = JSON.parse(fileContents || '{}');
		if (Array.isArray(parsed.orders)) {
			return parsed.orders;
		}
	} catch (error) {
		console.error('Unable to read orders store, resetting.', error);
	}
	await writeOrdersToDisk([]);
	return [];
}

async function writeOrdersToDisk(orders) {
	await ensureStore();
	await fs.writeFile(
		ordersFilePath,
		JSON.stringify({ orders }, null, 2),
		'utf-8',
	);
}

function cloneOrder(order) {
	return JSON.parse(JSON.stringify(order));
}

function sanitizeOrder(order) {
	const sanitized = cloneOrder(order);
	delete sanitized.trackingPhoneKey;
	return sanitized;
}

function normalizePhone(phone) {
	return (phone || '').replace(/\D/g, '');
}

export async function getOrders() {
	if (supabaseEnabled) {
		try {
			const { data, error } = await supabase
				.from(ORDERS_TABLE)
				.select('payload, placed_at')
				.order('placed_at', { ascending: false });
			if (error) {
				throw error;
			}
			return (data || []).map(row => sanitizeOrder(row.payload));
		} catch (error) {
			console.error('Unable to fetch orders from Supabase, falling back to file store.', error);
		}
	}

	const orders = await readOrdersFromDisk();
	return orders.map(order => sanitizeOrder(order));
}

export async function getOrderById(orderId) {
	if (supabaseEnabled) {
		try {
			const { data, error } = await supabase
				.from(ORDERS_TABLE)
				.select('payload')
				.eq('id', orderId)
				.maybeSingle();
			if (error) {
				throw error;
			}
			if (!data?.payload) {
				throw new OrderStoreError('Order not found', 404);
			}
			return sanitizeOrder(data.payload);
		} catch (error) {
			if (error instanceof OrderStoreError) {
				throw error;
			}
			console.error('Unable to fetch order from Supabase, falling back to file store.', error);
		}
	}

	const orders = await readOrdersFromDisk();
	const order = orders.find(entry => entry.id === orderId);
	if (!order) {
		throw new OrderStoreError('Order not found', 404);
	}
	return sanitizeOrder(order);
}

export async function getOrdersByPhone(phone) {
	const phoneKey = normalizePhone(phone);
	if (!phoneKey) {
		throw new OrderStoreError('Phone number is required.');
	}

	if (supabaseEnabled) {
		try {
			const { data, error } = await supabase
				.from(ORDERS_TABLE)
				.select('payload')
				.eq('tracking_phone_key', phoneKey)
				.order('placed_at', { ascending: false });
			if (error) {
				throw error;
			}
			if (!data?.length) {
				throw new OrderStoreError('No orders found for that phone number.', 404);
			}
			return data.map(row => sanitizeOrder(row.payload));
		} catch (error) {
			if (error instanceof OrderStoreError) {
				throw error;
			}
			console.error('Unable to fetch orders by phone from Supabase, falling back to file store.', error);
		}
	}

	const orders = await readOrdersFromDisk();
	const matches = orders.filter(entry => entry.trackingPhoneKey === phoneKey);
	if (!matches.length) {
		throw new OrderStoreError('No orders found for that phone number.', 404);
	}
	return matches.map(order => sanitizeOrder(order));
}

export async function getOrderForTracking(orderId, phone) {
	const phoneKey = normalizePhone(phone);
	if (!orderId || !phoneKey) {
		throw new OrderStoreError('Order ID and phone are required.');
	}

	if (supabaseEnabled) {
		try {
			const { data, error } = await supabase
				.from(ORDERS_TABLE)
				.select('payload')
				.eq('id', orderId)
				.eq('tracking_phone_key', phoneKey)
				.maybeSingle();
			if (error) {
				throw error;
			}
			if (!data?.payload) {
				throw new OrderStoreError('Order not found', 404);
			}
			return sanitizeOrder(data.payload);
		} catch (error) {
			if (error instanceof OrderStoreError) {
				throw error;
			}
			console.error('Unable to fetch tracking order from Supabase, falling back to file store.', error);
		}
	}

	const orders = await readOrdersFromDisk();
	const order = orders.find(
		entry => entry.id === orderId && entry.trackingPhoneKey === phoneKey,
	);
	if (!order) {
		throw new OrderStoreError('Order not found', 404);
	}
	return sanitizeOrder(order);
}

export async function addOrder(orderInput) {
	const { items, customer, totals, fulfillment } = orderInput;

	if (!Array.isArray(items) || items.length === 0) {
		throw new OrderStoreError('Order must include at least one menu item.');
	}

	const normalizedItems = items.map((item) => ({
		id: item.id ?? crypto.randomUUID(),
		name: item.name ?? 'Menu Item',
		quantity: Number(item.quantity) || 1,
		price: Number(item.price) || 0,
	}));

	const subtotal = normalizedItems.reduce(
		(sum, item) => sum + item.price * item.quantity,
		0,
	);
	const deliveryFee = Number(totals?.deliveryFee) || 0;
	const total = subtotal + deliveryFee;
	const now = new Date().toISOString();

	const phone = customer?.phone?.trim() || 'N/A';
	const trackingPhoneKey = normalizePhone(phone);
	const normalizedFulfillment = normalizeFulfillmentDetails(fulfillment || {});

	const newOrder = {
		id: `ORD-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
		customer: {
			name: customer?.name?.trim() || 'Guest',
			phone,
			building: customer?.building?.trim() || 'N/A',
			apartment: customer?.apartment?.trim() || '-',
		},
		trackingPhoneKey,
		items: normalizedItems,
		subtotal: Number(subtotal.toFixed(2)),
		deliveryFee: Number(deliveryFee.toFixed(2)),
		total: Number(total.toFixed(2)),
		status: 'Pending',
		statusHistory: [{ status: 'Pending', timestamp: now }],
		placedAt: now,
		fulfillment: normalizedFulfillment,
		scheduledFor: normalizedFulfillment.schedule?.iso || null,
	};

	if (supabaseEnabled) {
		try {
			const { data, error } = await supabase
				.from(ORDERS_TABLE)
				.insert({
					id: newOrder.id,
					status: newOrder.status,
					placed_at: newOrder.placedAt,
					scheduled_for: newOrder.scheduledFor,
					tracking_phone_key: newOrder.trackingPhoneKey,
					customer_phone: newOrder.customer.phone,
					payload: newOrder,
				})
				.select('payload')
				.single();
			if (error) {
				throw error;
			}
			return { order: sanitizeOrder(data.payload) };
		} catch (error) {
			console.error('Unable to add order to Supabase, falling back to file store.', error);
		}
	}

	const existingOrders = await readOrdersFromDisk();
	existingOrders.unshift(newOrder);
	await writeOrdersToDisk(existingOrders);

	return {
		order: sanitizeOrder(newOrder),
	};
}

export async function updateOrderStatus(orderId, nextStatus) {
	if (!STATUS_FLOW[nextStatus]) {
		throw new OrderStoreError('Unknown status supplied.');
	}

	if (supabaseEnabled) {
		try {
			const { data, error } = await supabase
				.from(ORDERS_TABLE)
				.select('payload')
				.eq('id', orderId)
				.maybeSingle();
			if (error) {
				throw error;
			}
			if (!data?.payload) {
				throw new OrderStoreError('Order not found', 404);
			}
			const order = data.payload;
			const allowed = STATUS_FLOW[order.status] || [];
			if (!allowed.includes(nextStatus)) {
				throw new OrderStoreError('Invalid status transition.');
			}
			const timestamp = new Date().toISOString();
			order.status = nextStatus;
			order.statusHistory.unshift({ status: nextStatus, timestamp });
			const updateResult = await supabase
				.from(ORDERS_TABLE)
				.update({
					status: order.status,
					payload: order,
				})
				.eq('id', orderId)
				.select('payload')
				.single();
			if (updateResult.error) {
				throw updateResult.error;
			}
			return sanitizeOrder(updateResult.data.payload);
		} catch (error) {
			if (error instanceof OrderStoreError) {
				throw error;
			}
			console.error('Unable to update order in Supabase, falling back to file store.', error);
		}
	}

	const orders = await readOrdersFromDisk();
	const index = orders.findIndex(order => order.id === orderId);
	if (index === -1) {
		throw new OrderStoreError('Order not found', 404);
	}

	const order = orders[index];
	const allowed = STATUS_FLOW[order.status] || [];
	if (!allowed.includes(nextStatus)) {
		throw new OrderStoreError('Invalid status transition.');
	}

	const timestamp = new Date().toISOString();
	order.status = nextStatus;
	order.statusHistory.unshift({ status: nextStatus, timestamp });
	await writeOrdersToDisk(orders);

	return sanitizeOrder(order);
}

export async function cancelOrder({ orderId, reason, phone, actor = 'customer' }) {
	const handleUpdate = async (order) => {
		const timestamp = new Date().toISOString();
		order.status = 'Cancelled';
		order.cancelReason = reason || null;
		order.statusHistory.unshift({ status: 'Cancelled', timestamp, actor });
		return order;
	};

	if (supabaseEnabled) {
		try {
			const { data, error } = await supabase
				.from(ORDERS_TABLE)
				.select('payload')
				.eq('id', orderId)
				.maybeSingle();
			if (error) {
				throw error;
			}
			if (!data?.payload) {
				throw new OrderStoreError('Order not found', 404);
			}
			const order = data.payload;
			const isAdminAction = actor === 'admin';
			if (!isAdminAction) {
				const phoneKey = normalizePhone(phone);
				if (!phoneKey || phoneKey !== order.trackingPhoneKey) {
					throw new OrderStoreError('Unauthorized', 401);
				}
			}
			if (['Delivered', 'Cancelled'].includes(order.status)) {
				throw new OrderStoreError('Order can no longer be changed.');
			}
			const nextOrder = await handleUpdate(order);
			const updateResult = await supabase
				.from(ORDERS_TABLE)
				.update({ status: nextOrder.status, payload: nextOrder })
				.eq('id', orderId)
				.select('payload')
				.single();
			if (updateResult.error) {
				throw updateResult.error;
			}
			return sanitizeOrder(updateResult.data.payload);
		} catch (error) {
			if (error instanceof OrderStoreError) {
				throw error;
			}
			console.error('Unable to cancel order in Supabase, falling back to file store.', error);
		}
	}

	const orders = await readOrdersFromDisk();
	const index = orders.findIndex(order => order.id === orderId);
	if (index === -1) {
		throw new OrderStoreError('Order not found', 404);
	}

	const order = orders[index];
	const isAdminAction = actor === 'admin';
	if (!isAdminAction) {
		const phoneKey = normalizePhone(phone);
		if (!phoneKey || phoneKey !== order.trackingPhoneKey) {
			throw new OrderStoreError('Unauthorized', 401);
		}
	}

	if (['Delivered', 'Cancelled'].includes(order.status)) {
		throw new OrderStoreError('Order can no longer be changed.');
	}

	const nextOrder = await handleUpdate(order);
	await writeOrdersToDisk(orders);
	return sanitizeOrder(nextOrder);
}
