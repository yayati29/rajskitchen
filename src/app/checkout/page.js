'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Drawer,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  Apartment,
  ArrowBack,
  Home,
  PersonOutline,
  Phone,
  ShoppingCart,
} from '@mui/icons-material';
import KitchenClosedLanding from '@/components/KitchenClosedLanding';
import { useTheme } from '@mui/material/styles';

const initialFormState = {
  name: '',
  phone: '',
  building: '',
  apartment: '',
};

export default function CheckoutPage() {
  const [cart, setCart] = useState([]);
  const [formValues, setFormValues] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [submissionStatus, setSubmissionStatus] = useState({ type: null, message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [trackingDetails, setTrackingDetails] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [fulfillmentMethod, setFulfillmentMethod] = useState('delivery');
  const [scheduleMode, setScheduleMode] = useState('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);
  const [kitchenOpen, setKitchenOpen] = useState(true);
  const router = useRouter();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [summaryDrawerOpen, setSummaryDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('rajCart');
      if (storedCart) {
        const parsed = JSON.parse(storedCart);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch (error) {
      console.error('Unable to restore cart from storage', error);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      try {
        const response = await fetch('/api/kitchen/status');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load kitchen status');
        }
        if (active && typeof payload.isOpen === 'boolean') {
          setKitchenOpen(payload.isOpen);
        }
      } catch (statusError) {
        console.error('Failed to fetch kitchen status', statusError);
      } finally {
        if (active) {
          setStatusLoading(false);
        }
      }
    };
    loadStatus();
    return () => {
      active = false;
    };
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );
  const deliveryFee = 0;
  const total = subtotal;
  const minScheduleDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date.toISOString().split('T')[0];
  }, []);

  const handleInputChange = (field) => (event) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleScheduleModeChange = (mode) => {
    setScheduleMode(mode);
    if (mode === 'now') {
      setScheduleDate('');
      setScheduleTime('');
    }
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formValues.name.trim()) {
      nextErrors.name = 'Name is required';
    }
    if (!formValues.phone.trim()) {
      nextErrors.phone = 'Phone number is required';
    }
    if (!formValues.building.trim()) {
      nextErrors.building = 'Building name is required';
    }
    if (!formValues.apartment.trim()) {
      nextErrors.apartment = 'Apartment number is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePlaceOrder = async (event) => {
    event.preventDefault();
    setSubmissionStatus({ type: null, message: '' });

    if (!validateForm()) {
      return;
    }

    if (!cart.length) {
      setSubmissionStatus({ type: 'error', message: 'Add at least one dish before checking out.' });
      return;
    }

    if (scheduleMode === 'later' && (!scheduleDate || !scheduleTime)) {
      setSubmissionStatus({ type: 'error', message: 'Pick a schedule date and time before placing your order.' });
      setActiveTab(2);
      return;
    }

    setSubmitting(true);

    try {
      const customerPayload = {
        name: formValues.name.trim(),
        phone: formValues.phone.trim(),
        building: formValues.building.trim(),
        apartment: formValues.apartment.trim(),
      };

      const schedulePayload =
        scheduleMode === 'now'
          ? { mode: 'now', asap: true }
          : { mode: 'later', date: scheduleDate, time: scheduleTime };
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: customerPayload,
          items: cart,
          totals: { subtotal, deliveryFee, total },
          fulfillment: {
            method: fulfillmentMethod,
            schedule: schedulePayload,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to place order right now.');
      }

      localStorage.removeItem('rajCart');
      setCart([]);
      setFormValues(initialFormState);
      const orderId = payload?.order?.publicId || payload?.order?.id;
      setSubmissionStatus({
        type: 'success',
        message: orderId
          ? `Thanks! Order ${orderId} is confirmed. Use the link below to follow progress or cancel if needed.`
          : 'Thanks! Your order is confirmed. Use the link below to follow progress or cancel if needed.',
      });
      const trackingPayload = { phone: customerPayload.phone };
      setTrackingDetails(trackingPayload);
      try {
        localStorage.setItem('rajLastOrderPhone', trackingPayload.phone);
      } catch (storageError) {
        console.warn('Unable to cache tracking link locally', storageError);
      }
    } catch (error) {
      setSubmissionStatus({ type: 'error', message: error.message });
      setTrackingDetails(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToMenu = () => {
    router.push('/menu');
  };

  const renderSummaryPanel = (paperSx = {}) => (
    <Paper
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: 3,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        ...paperSx,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
        <Avatar sx={{ bgcolor: 'rgba(248,194,141,0.18)', color: '#f8c28d' }}>
          <ShoppingCart />
        </Avatar>
        <Typography variant="h6" fontWeight={700}>
          Order Summary
        </Typography>
      </Stack>

      {cart.length === 0 ? (
        <Typography sx={{ color: 'rgba(247,242,237,0.7)' }}>
          No items in your cart yet.
        </Typography>
      ) : (
        <>
          <List disablePadding>
            {cart.map((item) => (
              <ListItem
                key={item.id}
                sx={{
                  px: 0,
                  py: 1.25,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'rgba(248,194,141,0.18)', color: '#f8c28d', width: 40, height: 40 }}>
                    {item.quantity}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={item.name}
                  secondary={`$${(item.price * item.quantity).toFixed(2)}`}
                  primaryTypographyProps={{ fontWeight: 600 }}
                  secondaryTypographyProps={{ color: '#f8c28d', fontWeight: 600 }}
                />
              </ListItem>
            ))}
          </List>

          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography sx={{ color: 'rgba(247,242,237,0.7)' }}>Subtotal</Typography>
            <Typography fontWeight={600}>${subtotal.toFixed(2)}</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="h6">Total</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#f8c28d' }}>
              ${total.toFixed(2)}
            </Typography>
          </Stack>
          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ color: 'rgba(247,242,237,0.7)' }}>Method</Typography>
              <Chip
                label={fulfillmentMethod === 'delivery' ? 'Delivery' : 'Pickup'}
                size="small"
                sx={{ bgcolor: 'rgba(248,194,141,0.18)', color: '#f8c28d' }}
              />
            </Stack>
            {scheduleMode === 'now'
              ? (
                <Typography variant="caption" sx={{ color: 'rgba(247,242,237,0.7)' }}>
                  ASAP drop once we confirm the run.
                </Typography>
              )
              : (scheduleDate && scheduleTime && (
                <Typography variant="caption" sx={{ color: 'rgba(247,242,237,0.7)' }}>
                  Scheduled for {scheduleDate} at {scheduleTime}
                </Typography>
              ))}
          </Stack>
        </>
      )}
    </Paper>
  );

  if (statusLoading) {
    return (
      <Box
        sx={{
          bgcolor: '#0f0b07',
          color: '#f7f2ed',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress sx={{ color: '#f8c28d' }} />
      </Box>
    );
  }

  if (!kitchenOpen) {
    return <KitchenClosedLanding />;
  }

  return (
    <Box sx={{ bgcolor: '#0f0b07', color: '#f7f2ed', minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          bgcolor: 'rgba(12,8,5,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', py: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flexShrink: 0 }}>
            <Typography
              variant="h6"
              component={Link}
              href="/"
              sx={{ fontFamily: 'var(--font-heading)', textDecoration: 'none', color: '#f8c28d' }}
            >
              Raj's Kitchen
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, width: { xs: '100%', md: 'auto' } }}
          >
            <IconButton onClick={handleBackToMenu} aria-label="Back to menu" sx={{ color: '#f7f2ed' }}>
              <ArrowBack />
            </IconButton>
            <Button
              variant="contained"
              component={Link}
              href="/menu"
              sx={{
                bgcolor: '#f8c28d',
                color: '#1c130d',
                textTransform: 'none',
                '&:hover': { bgcolor: '#ffe1c5' },
              }}
            >
              Modify Cart
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box
        component="section"
        sx={{
          background: 'radial-gradient(circle at top, rgba(248,194,141,0.12), transparent 60%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          py: { xs: 6, md: 8 },
        }}
      >
        <Container maxWidth={false} sx={{ px: { xs: 3, sm: 5, md: 10, xl: 16 } }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack spacing={3}>
                <Typography variant="overline" sx={{ letterSpacing: 2, color: 'rgba(247,242,237,0.7)' }}>
                  Checkout
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: 'var(--font-heading)',
                    lineHeight: 1.1,
                    fontSize: { xs: '2rem', sm: '2.4rem', md: '3.2rem' },
                  }}
                >
                  Finalize your drop, handoff, and crew notes.
                </Typography>
                {/*
                <Typography
                  variant="body1"
                  sx={{ color: 'rgba(247,242,237,0.75)', maxWidth: 600 }}
                >
                  We stage every order 30 minutes ahead of your slot. Share exact building info so the runner can reach you without calling three times.
                </Typography>
                */}
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper
                sx={{
                  p: 4,
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, rgba(21,13,9,0.9), rgba(54,27,12,0.9))',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Stack spacing={2}>
                  <Typography variant="h6" sx={{ fontFamily: 'var(--font-heading)', color: '#f8c28d' }}>
                    Dispatch board
                  </Typography>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: 'rgba(248,194,141,0.2)', color: '#f8c28d', width: 48, height: 48 }}>
                        <ShoppingCart />
                      </Avatar>
                      <Box>
                        <Typography fontWeight={600}>Cart total</Typography>
                        <Typography variant="h5" fontWeight={700} sx={{ color: '#f8c28d' }}>
                          ${total.toFixed(2)}
                        </Typography>
                      </Box>
                    </Stack>
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                    {/*
                    <Stack direction="row" spacing={1} alignItems="center">
                      <WatchLater sx={{ color: '#f8c28d' }} />
                      <Typography variant="body2" sx={{ color: 'rgba(247,242,237,0.75)' }}>
                        We hold your cart briefly—finish checkout so the kitchen can fire your dishes.
                      </Typography>
                    </Stack>
                    */}
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth={false} sx={{ py: { xs: 5, md: 6 }, pb: { xs: 12, md: 6 }, px: { xs: 3, sm: 5, md: 10, xl: 16 } }}>
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            flexDirection: { xs: 'column-reverse', lg: 'row' },
            alignItems: 'stretch',
          }}
        >
          <Box
            sx={{
              flexBasis: { lg: '65%' },
              flexGrow: 1,
              order: { xs: 2, lg: 1 },
            }}
          >
            <Paper
              component="form"
              onSubmit={handlePlaceOrder}
              sx={{
                p: { xs: 3, md: 5 },
                borderRadius: 3,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Stack spacing={1}>
                <Typography variant="h5" fontWeight={700}>
                  Delivery Details
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(247,242,237,0.7)', mb: 1 }}>
                  Zero guessing on location means hotter food at your door.
                </Typography>
              </Stack>

              {submissionStatus.type && (
                <Alert severity={submissionStatus.type} sx={{ mt: 2 }}>
                  {submissionStatus.message}
                </Alert>
              )}
              <Tabs
                value={activeTab}
                onChange={(event, value) => setActiveTab(value)}
                variant={isDesktop ? 'scrollable' : 'fullWidth'}
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  mt: 3,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    color: 'rgba(247,242,237,0.65)',
                    fontWeight: 600,
                  },
                  '& .Mui-selected': { color: '#f8c28d !important' },
                  '& .MuiTabs-indicator': { backgroundColor: '#f8c28d' },
                }}
              >
                <Tab label="Delivery details" value={0} />
                <Tab label="Delivery or pickup" value={1} />
                <Tab label="Schedule" value={2} />
              </Tabs>

              <Box sx={{ mt: 3 }}>
                {activeTab === 0 && (
                  <Stack spacing={2.5}>
                    <TextField
                      label="Full Name"
                      value={formValues.name}
                      onChange={handleInputChange('name')}
                      error={Boolean(errors.name)}
                      helperText={errors.name}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonOutline sx={{ color: 'rgba(247,242,237,0.6)' }} />
                          </InputAdornment>
                        ),
                        sx: {
                          color: '#f7f2ed',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                        },
                      }}
                      InputLabelProps={{ sx: { color: 'rgba(247,242,237,0.7)' } }}
                    />
                    <TextField
                      label="Phone Number"
                      value={formValues.phone}
                      onChange={handleInputChange('phone')}
                      error={Boolean(errors.phone)}
                      helperText={errors.phone}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Phone sx={{ color: 'rgba(247,242,237,0.6)' }} />
                          </InputAdornment>
                        ),
                        sx: {
                          color: '#f7f2ed',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                        },
                      }}
                      InputLabelProps={{ sx: { color: 'rgba(247,242,237,0.7)' } }}
                    />
                    <TextField
                      label="Building Name"
                      value={formValues.building}
                      onChange={handleInputChange('building')}
                      error={Boolean(errors.building)}
                      helperText={errors.building}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Home sx={{ color: 'rgba(247,242,237,0.6)' }} />
                          </InputAdornment>
                        ),
                        sx: {
                          color: '#f7f2ed',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                        },
                      }}
                      InputLabelProps={{ sx: { color: 'rgba(247,242,237,0.7)' } }}
                    />
                    <TextField
                      label="Apartment / Unit Number"
                      value={formValues.apartment}
                      onChange={handleInputChange('apartment')}
                      error={Boolean(errors.apartment)}
                      helperText={errors.apartment}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Apartment sx={{ color: 'rgba(247,242,237,0.6)' }} />
                          </InputAdornment>
                        ),
                        sx: {
                          color: '#f7f2ed',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                        },
                      }}
                      InputLabelProps={{ sx: { color: 'rgba(247,242,237,0.7)' } }}
                    />
                  </Stack>
                )}

                {activeTab === 1 && (
                  <Box>
                    <FormControl component="fieldset">
                      <RadioGroup
                        value={fulfillmentMethod}
                        onChange={(event) => setFulfillmentMethod(event.target.value)}
                      >
                        <FormControlLabel
                          value="delivery"
                          control={<Radio sx={{ color: 'rgba(247,242,237,0.5)', '&.Mui-checked': { color: '#f8c28d' } }} />}
                          sx={{ color: '#f7f2ed' }}
                          label={<Typography fontWeight={600}>Delivery</Typography>}
                        />
                        <FormControlLabel
                          value="pickup"
                          control={<Radio sx={{ color: 'rgba(247,242,237,0.5)', '&.Mui-checked': { color: '#f8c28d' } }} />}
                          sx={{ color: '#f7f2ed', mt: 1 }}
                          label={<Typography fontWeight={600}>Pickup</Typography>}
                        />
                      </RadioGroup>
                    </FormControl>
                  </Box>
                )}

                {activeTab === 2 && (
                  <Stack spacing={2.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <Button
                        variant={scheduleMode === 'now' ? 'contained' : 'outlined'}
                        onClick={() => handleScheduleModeChange('now')}
                        sx={{
                          flex: 1,
                          bgcolor: scheduleMode === 'now' ? '#f8c28d' : 'transparent',
                          color: scheduleMode === 'now' ? '#1c130d' : '#f7f2ed',
                          borderColor: 'rgba(255,255,255,0.3)',
                          textTransform: 'none',
                          '&:hover': {
                            bgcolor: scheduleMode === 'now' ? '#ffe1c5' : 'rgba(255,255,255,0.08)',
                          },
                        }}
                      >
                        Earliest
                      </Button>
                      <Button
                        variant={scheduleMode === 'later' ? 'contained' : 'outlined'}
                        onClick={() => handleScheduleModeChange('later')}
                        sx={{
                          flex: 1,
                          bgcolor: scheduleMode === 'later' ? '#f8c28d' : 'transparent',
                          color: scheduleMode === 'later' ? '#1c130d' : '#f7f2ed',
                          borderColor: 'rgba(255,255,255,0.3)',
                          textTransform: 'none',
                          '&:hover': {
                            bgcolor: scheduleMode === 'later' ? '#ffe1c5' : 'rgba(255,255,255,0.08)',
                          },
                        }}
                      >
                        Some other time
                      </Button>
                    </Stack>

                    {scheduleMode === 'later' ? (
                      <>
                        <TextField
                          label="Schedule date"
                          type="date"
                          value={scheduleDate}
                          onChange={(event) => setScheduleDate(event.target.value)}
                          InputLabelProps={{ shrink: true, sx: { color: 'rgba(247,242,237,0.7)' } }}
                          inputProps={{ min: minScheduleDate }}
                          sx={{
                            '& .MuiInputBase-input': { color: '#f7f2ed' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                          }}
                        />
                        <TextField
                          label="Schedule time"
                          type="time"
                          value={scheduleTime}
                          onChange={(event) => setScheduleTime(event.target.value)}
                          InputLabelProps={{ shrink: true, sx: { color: 'rgba(247,242,237,0.7)' } }}
                          sx={{
                            '& .MuiInputBase-input': { color: '#f7f2ed' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                          }}
                        />
                        <Typography variant="caption" sx={{ color: 'rgba(247,242,237,0.6)' }}>
                          We need 48 hours to source and prep. Choose a slot at least two days out.
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="caption" sx={{ color: 'rgba(247,242,237,0.6)' }}>
                        We start prepping the moment you confirm, then drop as soon as the run is ready.
                      </Typography>
                    )}
                  </Stack>
                )}
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={!cart.length || submitting}
                  sx={{
                    flex: 1,
                    bgcolor: '#f8c28d',
                    color: '#1c130d',
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#ffe1c5' },
                  }}
                >
                  {submitting ? 'Placing Order...' : 'Place Order'}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleBackToMenu}
                  sx={{
                    flex: 1,
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: '#f7f2ed',
                    textTransform: 'none',
                  }}
                >
                  Modify Cart
                </Button>
              </Stack>

              {trackingDetails && submissionStatus.type === 'success' && (
                <Button
                  component={Link}
                  href={`/orders/track?phone=${encodeURIComponent(trackingDetails.phone)}`}
                  variant="text"
                  sx={{ mt: 2, alignSelf: 'flex-start', color: '#f8c28d' }}
                >
                  View order status
                </Button>
              )}

              {!cart.length && (
                <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'rgba(247,242,237,0.6)' }}>
                  Your cart is empty. Add dishes from the menu before checking out.
                </Typography>
              )}
            </Paper>
          </Box>

          {isDesktop && (
            <Box
              sx={{
                flexBasis: { lg: '35%' },
                maxWidth: { lg: '35%' },
                width: '100%',
                order: { xs: 1, lg: 2 },
                position: { lg: 'sticky' },
                top: { lg: 120 },
                alignSelf: 'flex-start',
              }}
            >
              {renderSummaryPanel()}
            </Box>
          )}
        </Box>
      </Container>
      {!isDesktop && (
        <>
          <Box
            sx={{
              position: 'sticky',
              bottom: 0,
              left: 0,
              right: 0,
              px: { xs: 3, sm: 5 },
              pb: 3,
              pt: 1,
              background: 'linear-gradient(180deg, rgba(15,11,7,0), rgba(15,11,7,0.95))',
            }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => setSummaryDrawerOpen(true)}
              disabled={!cart.length}
              sx={{
                width: '100%',
                bgcolor: '#f8c28d',
                color: '#1c130d',
                textTransform: 'none',
                borderRadius: 999,
                py: 1.5,
                boxShadow: '0 15px 35px rgba(0,0,0,0.45)',
              }}
            >
              {cart.length ? `Review Order · $${total.toFixed(2)}` : 'Cart is empty'}
            </Button>
          </Box>
          <Drawer
            anchor="bottom"
            open={summaryDrawerOpen}
            onClose={() => setSummaryDrawerOpen(false)}
            PaperProps={{
              sx: {
                background: 'transparent',
                boxShadow: 'none',
                px: 2,
                pb: 2,
              },
            }}
          >
            {renderSummaryPanel({
              borderRadius: '24px 24px 0 0',
              maxWidth: 560,
              width: '100%',
              mx: 'auto',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.65)',
            })}
          </Drawer>
        </>
      )}
    </Box>
  );
}
