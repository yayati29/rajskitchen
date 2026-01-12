"use client";

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

const statusColorMap = {
  Pending: 'default',
  Preparing: 'warning',
  Done: 'info',
  'Out for Delivery': 'info',
  Delivered: 'success',
  Cancelled: 'error',
};

const ACTIONS = [
  { label: 'Accept', status: 'Preparing', visibleFor: ['Pending'] },
  { label: 'Done', status: 'Done', visibleFor: ['Preparing'] },
  { label: 'Out for Delivery', status: 'Out for Delivery', visibleFor: ['Done'] },
  { label: 'Mark Delivered', status: 'Delivered', visibleFor: ['Out for Delivery'] },
];

export default function OrdersListClient({ orders }) {
  const router = useRouter();
  const [processingKey, setProcessingKey] = useState('');
  const [error, setError] = useState('');

  const handleStatusChange = async (orderId, nextStatus) => {
    const key = `${orderId}-${nextStatus}`;
    setProcessingKey(key);
    setError('');
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update order.');
      }
      router.refresh();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setProcessingKey('');
    }
  };

  const handleCancel = async (orderId) => {
    setProcessingKey(`${orderId}-cancel`);
    setError('');
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by admin' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to cancel order.');
      }
      router.refresh();
    } catch (cancelError) {
      setError(cancelError.message);
    } finally {
      setProcessingKey('');
    }
  };

  const isFinalStatus = (status) => ['Delivered', 'Cancelled'].includes(status);

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {orders.map((order) => {
        const placedAtLabel = order.placedAt && dayjs(order.placedAt).isValid()
          ? dayjs(order.placedAt).format('MMM D, h:mm A')
          : 'Unknown time';
        const scheduledMoment = order.scheduledFor && dayjs(order.scheduledFor).isValid()
          ? dayjs(order.scheduledFor)
          : null;
        const scheduledLabel = scheduledMoment ? scheduledMoment.format('MMM D, h:mm A') : null;
        const fulfillmentMethodLabel = order.fulfillment?.method === 'pickup' ? 'Pickup' : 'Delivery';
        const isAsap = order.fulfillment?.schedule?.mode === 'now';

        return (
          <Paper
            key={order.id}
            variant="outlined"
            sx={{
              p: { xs: 3, md: 3.5 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.paper',
              boxShadow: '0 18px 45px rgba(23, 20, 17, 0.06)',
            }}
          >
            <Stack spacing={2.5}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
                spacing={1.5}
              >
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>
                    Order
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    sx={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {order.publicId || order.id}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                  <Chip
                    label={order.status}
                    color={statusColorMap[order.status] || 'default'}
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                  <Typography variant="h5" fontWeight={700}>
                    ${order.total?.toFixed(2)}
                  </Typography>
                </Stack>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} flexWrap="wrap">
                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <Typography variant="caption" color="text.secondary">
                    Placed
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {placedAtLabel}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <Typography variant="caption" color="text.secondary">
                    Schedule
                  </Typography>
                  <Typography variant="body1" fontWeight={600} color="primary.main">
                    {scheduledLabel
                      ? `${scheduledLabel} · ${fulfillmentMethodLabel}`
                      : `ASAP · ${fulfillmentMethodLabel}`}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <Typography variant="caption" color="text.secondary">
                    Contact
                  </Typography>
                  <Typography variant="body2">
                    {order.customer?.name || 'Guest'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {order.customer?.phone || 'N/A'} · {order.customer?.building || 'N/A'}
                    {order.customer?.apartment ? `, Apt ${order.customer.apartment}` : ''}
                  </Typography>
                </Box>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  Items
                </Typography>
                <Typography variant="body1" color="text.primary">
                  {order.items.map(item => `${item.quantity}× ${item.name}`).join(', ')}
                </Typography>
                {order.cancelReason && (
                  <Typography variant="caption" color="error">
                    Cancel reason: {order.cancelReason}
                  </Typography>
                )}
                {order.statusHistory?.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Last update {dayjs(order.statusHistory[0]?.timestamp).format('MMM D, h:mm A')}
                  </Typography>
                )}
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap">
                {ACTIONS.filter(action => action.visibleFor.includes(order.status)).map((action) => (
                  <Button
                    key={action.status}
                    variant="contained"
                    size="small"
                    onClick={() => handleStatusChange(order.id, action.status)}
                    disabled={processingKey === `${order.id}-${action.status}`}
                    sx={{ textTransform: 'none', px: 3, fontWeight: 600 }}
                  >
                    {processingKey === `${order.id}-${action.status}` ? 'Updating...' : action.label}
                  </Button>
                ))}
                {!isFinalStatus(order.status) && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={() => handleCancel(order.id)}
                    disabled={processingKey === `${order.id}-cancel`}
                    sx={{ textTransform: 'none', px: 3, fontWeight: 600 }}
                  >
                    {processingKey === `${order.id}-cancel` ? 'Cancelling...' : 'Cancel'}
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
