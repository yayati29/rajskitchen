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
const SUMMARY_COLUMNS = Object.freeze({
	orderId: 'order_id',
	customerName: 'customer_name',
	phoneNumber: 'phone_number',
	itemLabel: 'item_name',
	itemQuantity: 'item_quantity',
	buildingName: 'building_name',
	apartmentNumber: 'apartment_number',
	placedAt: 'order_placed_time',
	acceptedAt: 'order_accepted_time',
	deliveredAt: 'order_delivery_time',
	revenue: 'revenue',
});
const STATUS_COLUMN = 'status';
const PAYLOAD_COLUMN = 'order_payload';
const TRACKING_PHONE_KEY_COLUMN = 'tracking_phone_key';

function summarizeItems(items = []) {
	if (!Array.isArray(items) || items.length === 0) {
		return 'N/A';
	}
	return items
		.map(item => `${Number(item.quantity) || 1}× ${item.name || 'Menu Item'}`)
		.join(', ');
}

function countItems(items = []) {
	if (!Array.isArray(items)) {
		return 0;
	}
	return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function buildSupabaseRow(order) {
	const isCancelled = order.status === 'Cancelled';
	const revenue = isCancelled ? 0 : Number(order.total || 0);
	return {
		id: order.id,
		[SUMMARY_COLUMNS.orderId]: order.publicId,
		[SUMMARY_COLUMNS.customerName]: order.customer?.name || 'Guest',
		[SUMMARY_COLUMNS.phoneNumber]: order.customer?.phone || '',
		[SUMMARY_COLUMNS.itemLabel]: summarizeItems(order.items),
		[SUMMARY_COLUMNS.itemQuantity]: countItems(order.items),
		[SUMMARY_COLUMNS.buildingName]: order.customer?.building || '',
		[SUMMARY_COLUMNS.apartmentNumber]: order.customer?.apartment || '',
		[SUMMARY_COLUMNS.placedAt]: order.placedAt,
		[SUMMARY_COLUMNS.acceptedAt]: order.acceptedAt,
		[SUMMARY_COLUMNS.deliveredAt]: isCancelled ? null : order.deliveredAt,
		[SUMMARY_COLUMNS.revenue]: revenue,
		[STATUS_COLUMN]: order.status,
		[PAYLOAD_COLUMN]: order,
		[TRACKING_PHONE_KEY_COLUMN]: order.trackingPhoneKey,
	};
}

async function persistOrderToSupabase(order) {
	if (!supabaseEnabled) {
		return null;
	}
	try {
		const row = buildSupabaseRow(order);
		await supabase.from(ORDERS_TABLE).upsert(row, { onConflict: 'id' });
		return cloneOrder(order);
	} catch (error) {
		console.error('Unable to sync order summary to Supabase.', error);
		throw error;
	}
}

function applyFilters(query, filters = []) {
	return filters.reduce((builder, { column, operator = 'eq', value }) => {
		if (typeof builder[operator] !== 'function') {
			throw new Error(`Unsupported Supabase filter operator: ${operator}`);
		}
		return builder[operator](column, value);
	}, query);
}

async function fetchSupabaseOrdersList({ filters = [], orderColumn = SUMMARY_COLUMNS.placedAt, ascending = false } = {}) {
	if (!supabaseEnabled) {
		return [];
	}
	let query = supabase
		.from(ORDERS_TABLE)
		.select(PAYLOAD_COLUMN)
		.order(orderColumn, { ascending });
	query = applyFilters(query, filters);
	const { data, error } = await query;
	if (error) {
		throw error;
	}
	return (data || [])
		.map(row => (row?.[PAYLOAD_COLUMN] ? cloneOrder(row[PAYLOAD_COLUMN]) : null))
		.filter(Boolean);
}

async function fetchSupabaseOrder(filters = []) {
	if (!supabaseEnabled) {
		return null;
	}
	let query = supabase
		.from(ORDERS_TABLE)
		.select(PAYLOAD_COLUMN)
		.limit(1);
	query = applyFilters(query, filters);
	const { data, error } = await query.maybeSingle();
	if (error) {
		throw error;
	}
	const payload = data?.[PAYLOAD_COLUMN];
	return payload ? cloneOrder(payload) : null;
}

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
			const orders = await fetchSupabaseOrdersList();
			return orders.map(order => sanitizeOrder(order));
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
			let order = await fetchSupabaseOrder([{ column: 'id', value: orderId }]);
			if (!order && orderId) {
				order = await fetchSupabaseOrder([{ column: SUMMARY_COLUMNS.orderId, value: orderId }]);
			}
			if (!order) {
				throw new OrderStoreError('Order not found', 404);
			}
			return sanitizeOrder(order);
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
			const rows = await fetchSupabaseOrdersList({
				filters: [{ column: TRACKING_PHONE_KEY_COLUMN, value: phoneKey }],
			});
			if (!rows.length) {
				throw new OrderStoreError('No orders found for that phone number.', 404);
			}
			return rows.map(order => sanitizeOrder(order));
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
			let order = await fetchSupabaseOrder([
				{ column: 'id', value: orderId },
				{ column: TRACKING_PHONE_KEY_COLUMN, value: phoneKey },
			]);
			if (!order && orderId) {
				order = await fetchSupabaseOrder([
					{ column: SUMMARY_COLUMNS.orderId, value: orderId },
					{ column: TRACKING_PHONE_KEY_COLUMN, value: phoneKey },
				]);
			}
			if (!order) {
				throw new OrderStoreError('Order not found', 404);
			}
			return sanitizeOrder(order);
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

	// Use a DB-friendly UUID for the `id` column while retaining a
	// human-friendly `publicId` inside the payload for display.
	const dbId = crypto.randomUUID();
	const publicId = `ORD-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

	const newOrder = {
		id: dbId,
		publicId,
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
		acceptedAt: null,
		deliveredAt: null,
		cancelledAt: null,
	};

		if (supabaseEnabled) {
			try {
				await persistOrderToSupabase(newOrder);
				return {
					order: sanitizeOrder(newOrder),
				};
			} catch (error) {
				console.error('Unable to add order to Supabase, falling back to file store.', error);
			}
		}

		const existingOrders = await readOrdersFromDisk();
		existingOrders.unshift(newOrder);
		await writeOrdersToDisk(existingOrders);
		try {
			await persistOrderToSupabase(newOrder);
		} catch (syncError) {
			console.warn('Unable to mirror new order to Supabase.', syncError);
		}

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
			let order = await fetchSupabaseOrder([{ column: 'id', value: orderId }]);
			if (!order && orderId) {
				order = await fetchSupabaseOrder([{ column: SUMMARY_COLUMNS.orderId, value: orderId }]);
			}
			if (!order) {
				throw new OrderStoreError('Order not found', 404);
			}
			const allowed = STATUS_FLOW[order.status] || [];
			if (!allowed.includes(nextStatus)) {
				throw new OrderStoreError('Invalid status transition.');
			}
			const timestamp = new Date().toISOString();
			order.status = nextStatus;
			order.statusHistory.unshift({ status: nextStatus, timestamp });
			if (!order.acceptedAt && nextStatus !== 'Pending') {
				order.acceptedAt = timestamp;
			}
			if (nextStatus === 'Delivered') {
				order.deliveredAt = timestamp;
			}
			await persistOrderToSupabase(order);
			return sanitizeOrder(order);
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
	if (!order.acceptedAt && nextStatus !== 'Pending') {
		order.acceptedAt = timestamp;
	}
	if (nextStatus === 'Delivered') {
		order.deliveredAt = timestamp;
	}
	await writeOrdersToDisk(orders);
	try {
		await persistOrderToSupabase(order);
	} catch (syncError) {
		console.warn('Unable to mirror order status to Supabase.', syncError);
	}

	return sanitizeOrder(order);
}

export async function cancelOrder({ orderId, reason, phone, actor = 'customer' }) {
	const handleUpdate = async (order) => {
		const timestamp = new Date().toISOString();
		order.status = 'Cancelled';
		order.cancelReason = reason || null;
		order.statusHistory.unshift({ status: 'Cancelled', timestamp, actor });
		order.cancelledAt = timestamp;
		order.deliveredAt = null;
		return order;
	};

	if (supabaseEnabled) {
		try {
			let order = await fetchSupabaseOrder([{ column: 'id', value: orderId }]);
			if (!order && orderId) {
				order = await fetchSupabaseOrder([{ column: SUMMARY_COLUMNS.orderId, value: orderId }]);
			}
			if (!order) {
				throw new OrderStoreError('Order not found', 404);
			}
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
			await persistOrderToSupabase(nextOrder);
			return sanitizeOrder(nextOrder);
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
	try {
		await persistOrderToSupabase(nextOrder);
	} catch (syncError) {
		console.warn('Unable to mirror cancellation to Supabase.', syncError);
	}
	return sanitizeOrder(nextOrder);
}
