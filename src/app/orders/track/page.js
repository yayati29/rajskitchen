"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';

const statusColorMap = {
  Pending: 'warning',
  Preparing: 'warning',
  Done: 'info',
  'Out for Delivery': 'info',
  Delivered: 'success',
  Cancelled: 'error',
};

export default function OrderTrackingPage() {
  const searchParams = useSearchParams();
  const queryPhone = searchParams.get('phone') || '';

  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState([]);
  const [latestOrder, setLatestOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const loadOrders = useCallback(async (rawPhone) => {
    const trimmed = rawPhone.trim();
    if (!trimmed) {
      setError('Enter the phone number you used when ordering.');
      setOrders([]);
      setLatestOrder(null);
      setInfoMessage('');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMessage('');
    try {
      const response = await fetch(`/api/orders/by-phone?phone=${encodeURIComponent(trimmed)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to find orders for that phone number.');
      }
      const fetchedOrders = payload.orders || [];
      setOrders(fetchedOrders);
      setLatestOrder(fetchedOrders[0] || null);
      setInfoMessage(
        fetchedOrders.length
          ? fetchedOrders.length === 1
            ? 'Showing your latest order.'
            : `Showing your latest ${Math.min(fetchedOrders.length, 5)} orders.`
          : 'No orders found for that phone number yet.',
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('rajLastOrderPhone', trimmed);
      }
    } catch (lookupError) {
      setOrders([]);
      setLatestOrder(null);
      setInfoMessage('');
      setError(lookupError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (queryPhone) {
      setPhone(queryPhone);
      loadOrders(queryPhone);
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('rajLastOrderPhone');
        if (stored) {
          setPhone(stored);
          loadOrders(stored);
          return;
        }
      } catch (storeError) {
        console.error('Unable to restore saved phone number', storeError);
      }
    }
  }, [queryPhone, loadOrders]);

  const handleLookup = async (event) => {
    event.preventDefault();
    await loadOrders(phone);
  };

  const otherOrders = useMemo(() => orders.slice(1, 5), [orders]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 6 }}>
      <Container maxWidth="md">
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                Track Your Orders
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enter your phone number to see the most recent orders placed with Raj's Kitchen.
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleLookup}>
              <Stack spacing={2}>
                <TextField
                  label="Phone Number"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  fullWidth
                  required
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button type="submit" variant="contained" fullWidth disabled={loading}>
                    {loading ? 'Searching...' : 'View Latest Orders'}
                  </Button>
                  <Button component={Link} href="/" variant="outlined" fullWidth>
                    Back to Home
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  We only show the newest orders for this phone number. Keep this page bookmarked for quick updates.
                </Typography>
              </Stack>
            </Box>

            {loading && <Typography>Looking up orders...</Typography>}
            {error && <Alert severity="error">{error}</Alert>}
            {infoMessage && !error && <Alert severity="info">{infoMessage}</Alert>}

            {latestOrder && !loading && !error && (
              <Stack spacing={3}>
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Latest Order
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>{latestOrder.id}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Placed {dayjs(latestOrder.placedAt).format('MMM D, h:mm A')}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Current Status
                  </Typography>
                  <Chip
                    label={latestOrder.status}
                    color={statusColorMap[latestOrder.status] || 'default'}
                    sx={{ mt: 1, width: 'fit-content' }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Last updated {dayjs(latestOrder.statusHistory?.[0]?.timestamp || latestOrder.placedAt).format('MMM D, h:mm A')}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Delivery To</Typography>
                  <Typography>{latestOrder.customer?.name}</Typography>
                  <Typography color="text.secondary">
                    {latestOrder.customer?.building}, Apt {latestOrder.customer?.apartment}
                  </Typography>
                  <Typography color="text.secondary">Phone: {latestOrder.customer?.phone}</Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Items</Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {latestOrder.items.map(item => (
                      <Stack key={item.id || item.name} direction="row" justifyContent="space-between">
                        <Typography>{item.quantity} × {item.name}</Typography>
                        <Typography>${(item.price * item.quantity).toFixed(2)}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Divider sx={{ my: 2 }} />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Subtotal</Typography>
                    <Typography fontWeight={600}>${latestOrder.subtotal?.toFixed(2)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Delivery</Typography>
                    <Typography fontWeight={600}>${latestOrder.deliveryFee?.toFixed(2)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                    <Typography variant="h6">Total</Typography>
                    <Typography variant="h6" fontWeight={700}>${latestOrder.total?.toFixed(2)}</Typography>
                  </Stack>
                </Box>

                {otherOrders.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Other recent orders for {phone}
                    </Typography>
                    <Stack spacing={1.5}>
                      {otherOrders.map(order => (
                        <Stack
                          key={order.id}
                          direction={{ xs: 'column', sm: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          spacing={1}
                        >
                          <Box>
                            <Typography fontWeight={600}>{order.id}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {dayjs(order.placedAt).format('MMM D, h:mm A')} · ${order.total?.toFixed(2)}
                            </Typography>
                          </Box>
                          <Chip label={order.status} color={statusColorMap[order.status] || 'default'} size="small" />
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}

            {!latestOrder && !loading && !error && (
              <Typography color="text.secondary">
                Enter your phone number above to see the most recent orders associated with it.
              </Typography>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
