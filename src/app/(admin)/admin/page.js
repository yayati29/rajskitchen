import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { getOrders } from '@/data/orders';
import DashboardTabs from './DashboardTabs';

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const orders = await getOrders();
  const today = dayjs();
  const todaysOrders = orders.filter(order => dayjs(order.placedAt).isSame(today, 'day'));
  const todaysOrdersSorted = [...todaysOrders].sort(
    (a, b) => dayjs(a.placedAt).valueOf() - dayjs(b.placedAt).valueOf(),
  );
  const todaysPendingFirst = todaysOrdersSorted.filter((order) => order.status === 'Pending');
  const todaysAccepted = todaysOrdersSorted.filter(
    (order) => order.status !== 'Pending' && !['Delivered', 'Cancelled'].includes(order.status)
  );
  const todaysDelivered = todaysOrdersSorted.filter((order) => order.status === 'Delivered');
  const todaysCancelled = todaysOrdersSorted.filter((order) => order.status === 'Cancelled');
  const pastOrders = orders.filter(order => !dayjs(order.placedAt).isSame(today, 'day'));
  const futureOrders = orders
    .filter((order) => {
      if (!order.scheduledFor) {
        return false;
      }
      const scheduledAt = dayjs(order.scheduledFor);
      if (!scheduledAt.isValid()) {
        return false;
      }
      return scheduledAt.diff(today, 'minute') >= 60;
    })
    .sort((a, b) => dayjs(a.scheduledFor).valueOf() - dayjs(b.scheduledFor).valueOf());

  const todaysRevenue = todaysOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const todaysActive = todaysOrders.filter(order => !['Delivered', 'Cancelled'].includes(order.status)).length;
  const avgTicket = todaysOrders.length ? todaysRevenue / todaysOrders.length : 0;

  const pastRevenue = pastOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const pastByDateMap = pastOrders.reduce((acc, order) => {
    const dateKey = dayjs(order.placedAt).format('YYYY-MM-DD');
    if (!acc[dateKey]) {
      acc[dateKey] = {
        dateKey,
        label: dayjs(order.placedAt).format('MMM D, YYYY'),
        total: 0,
        count: 0,
      };
    }
    acc[dateKey].total += order.total || 0;
    acc[dateKey].count += 1;
    return acc;
  }, {});
  const pastOrdersByDate = Object.values(pastByDateMap).sort((a, b) => dayjs(b.dateKey).valueOf() - dayjs(a.dateKey).valueOf());

  const todaysSummary = {
    pending: todaysPendingFirst.length,
    count: todaysOrders.length,
    active: todaysActive,
    revenue: todaysRevenue,
    avgTicket,
  };

  const pastSummary = {
    count: pastOrders.length,
    revenue: pastRevenue,
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4, xl: 5 },
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 30px 80px rgba(22, 18, 13, 0.08)',
          }}
        >
          <Stack spacing={4}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
              spacing={2}
            >
              <Box>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  gutterBottom
                  sx={{ fontFamily: 'var(--font-heading)' }}
                >
                  Orders Overview
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Monitor real-time kitchen activity and deliveries.
                </Typography>
              </Box>
            </Stack>

            <DashboardTabs
              todaysPending={todaysPendingFirst}
              todaysAccepted={todaysAccepted}
              todaysDelivered={todaysDelivered}
              todaysCancelled={todaysCancelled}
              futureOrders={futureOrders}
              todaysSummary={todaysSummary}
              pastSummary={pastSummary}
              pastOrdersByDate={pastOrdersByDate}
            />
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
