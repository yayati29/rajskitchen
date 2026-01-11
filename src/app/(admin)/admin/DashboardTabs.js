"use client";

import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Grid from '@mui/material/Grid';
import OrdersListClient from './OrdersListClient';
import { useRouter } from 'next/navigation';

const REFRESH_INTERVAL_MS = 15000; // 15s auto-refresh cadence

const TAB_CONFIG = [
  { value: 'today', label: 'Today' },
  { value: 'past', label: 'Past' },
];

const basePanelStyles = {
  borderRadius: 3,
  border: '1px solid',
  borderColor: 'divider',
  backgroundColor: 'background.default',
};

export default function DashboardTabs({
  todaysPending = [],
  todaysAccepted = [],
  todaysDelivered = [],
  todaysCancelled = [],
  futureOrders = [],
  todaysSummary,
  pastSummary,
  pastOrdersByDate,
}) {
  const [tab, setTab] = useState('today');
  const router = useRouter();

  const handleTabChange = (_, nextTab) => setTab(nextTab);

  useEffect(() => {
    let intervalId;

    const scheduleRefresh = () => {
      intervalId = window.setInterval(() => {
        if (!document.hidden) {
          router.refresh();
        }
      }, REFRESH_INTERVAL_MS);
    };

    scheduleRefresh();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.clearInterval(intervalId);
      } else {
        router.refresh();
        window.clearInterval(intervalId);
        scheduleRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  return (
    <Card
      sx={{
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        color: 'text.primary',
        boxShadow: '0 30px 80px rgba(22, 18, 13, 0.08)',
      }}
    >
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            mb: 3,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              color: 'text.secondary',
            },
            '& .Mui-selected': { color: 'primary.main !important' },
            '& .MuiTabs-indicator': { backgroundColor: 'primary.main' },
          }}
        >
          {TAB_CONFIG.map(tabItem => (
            <Tab
              key={tabItem.value}
              value={tabItem.value}
              label={(() => {
                if (tabItem.value === 'today') return `${tabItem.label} (${todaysSummary.count})`;
                if (tabItem.value === 'past') return `${tabItem.label} (${pastSummary.count})`;
                return tabItem.label;
              })()}
            />
          ))}
        </Tabs>

        {tab === 'today' && (
          <Stack spacing={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ ...basePanelStyles, height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Orders Today</Typography>
                    <Typography variant="h4" fontWeight={700}>{todaysSummary.count}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ ...basePanelStyles, height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Pending</Typography>
                    <Typography variant="h4" fontWeight={700}>{todaysSummary.pending}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      FIFO queue
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ ...basePanelStyles, height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Revenue Today</Typography>
                    <Typography variant="h4" fontWeight={700}>${todaysSummary.revenue.toFixed(2)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Avg ticket ${todaysSummary.avgTicket.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            <Divider sx={{ borderColor: 'divider' }} />
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
              <Box sx={{ width: { xs: '100%', lg: '40%' }, flexShrink: 0 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Pending queue (FIFO)
                </Typography>
                {todaysPending.length === 0 ? (
                  <Typography color="text.secondary">No pending orders.</Typography>
                ) : (
                  <OrdersListClient orders={todaysPending} />
                )}
              </Box>
              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', lg: 'block' }, borderColor: 'divider' }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  In progress
                </Typography>
                {todaysAccepted.length === 0 ? (
                  <Typography color="text.secondary">Nothing in the queue.</Typography>
                ) : (
                  <OrdersListClient orders={todaysAccepted} />
                )}
                {(todaysDelivered.length > 0 || todaysCancelled.length > 0) && (
                  <Stack spacing={2} sx={{ mt: 3 }}>
                    {todaysDelivered.length > 0 && (
                      <Accordion defaultExpanded={false} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography fontWeight={600}>Delivered ({todaysDelivered.length})</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <OrdersListClient orders={todaysDelivered} />
                        </AccordionDetails>
                      </Accordion>
                    )}
                    {todaysCancelled.length > 0 && (
                      <Accordion defaultExpanded={false} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography fontWeight={600} color="error.main">
                            Cancelled ({todaysCancelled.length})
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <OrdersListClient orders={todaysCancelled} />
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </Stack>
                )}
              </Box>
            </Stack>

            {futureOrders.length > 0 && (
              <>
                <Divider sx={{ borderColor: 'divider' }} />
                <Stack spacing={2}>
                  <Typography variant="subtitle1" fontWeight={600} color="primary.main">
                    Future orders (more than 1 hr out)
                  </Typography>
                  <OrdersListClient orders={futureOrders} />
                </Stack>
              </>
            )}
          </Stack>
        )}

        {tab === 'past' && (
          <Stack spacing={3}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box sx={{ ...basePanelStyles, flex: 1, p: 3 }}>
                <Typography variant="subtitle2" color="text.secondary">Orders</Typography>
                <Typography variant="h5" fontWeight={700}>{pastSummary.count}</Typography>
              </Box>
              <Box sx={{ ...basePanelStyles, flex: 1, p: 3 }}>
                <Typography variant="subtitle2" color="text.secondary">Revenue</Typography>
                <Typography variant="h5" fontWeight={700}>${pastSummary.revenue.toFixed(2)}</Typography>
              </Box>
            </Stack>
            {pastSummary.count === 0 ? (
              <Typography color="text.secondary">
                No past orders to show yet.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {pastOrdersByDate.map((group) => (
                  <Box
                    key={group.dateKey}
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      justifyContent: 'space-between',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 3,
                      backgroundColor: 'background.default',
                      p: 2.5,
                      gap: 1,
                    }}
                  >
                    <Box>
                      <Typography fontWeight={600}>{group.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {group.count} orders
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} color="primary.main">
                      ${group.total.toFixed(2)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
