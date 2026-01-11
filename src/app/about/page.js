'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppBar,
  Badge,
  Box,
  Button,
  Container,
  Fab,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  Instagram,
  KeyboardArrowUp,
  ShoppingCart,
  WhatsApp,
} from '@mui/icons-material';

const getStoredCartItems = () => {
  if (typeof window === 'undefined') {
    return [];
  }
  const stored = localStorage.getItem('rajCart');
  if (!stored) {
    return [];
  }
  const parsed = JSON.parse(stored);
  return Array.isArray(parsed) ? parsed : [];
};

const calculateCartCount = (items) => items.reduce((sum, entry) => sum + (entry.quantity || 0), 0);

export default function AboutPage() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    try {
      const items = getStoredCartItems();
      setCartCount(calculateCartCount(items));
    } catch (error) {
      console.error('Failed to sync cart count', error);
    }
  }, []);

  return (
    <Box sx={{ bgcolor: '#0f0b07', color: '#f7f2ed', minHeight: '100vh' }}>
      <AppBar position="sticky" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-heading)' }}>
              Raj's Kitchen
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button color="inherit" component={Link} href="/" sx={{ textTransform: 'none' }}>
              Menu
            </Button>
            <Button color="inherit" component={Link} href="/menu" sx={{ textTransform: 'none' }}>
              Order Now
            </Button>
            <IconButton color="inherit" component={Link} href="/checkout">
              <Badge
                badgeContent={cartCount}
                overlap="circular"
                color="secondary"
                invisible={!cartCount}
                sx={{ '& .MuiBadge-badge': { bgcolor: '#f8c28d', color: '#1c130d' } }}
              >
                <ShoppingCart />
              </Badge>
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="main">
        <Box component="section" sx={{ py: { xs: 6, md: 10 }, px: 2 }}>
          <Container maxWidth="lg">
            <Grid container spacing={6} alignItems="center">
              <Grid item xs={12} md={7}>
                <Stack spacing={3}>
                  <Typography variant="overline" sx={{ letterSpacing: 2, color: 'rgba(247,242,237,0.7)' }}>
                    About Us
                  </Typography>
                  <Typography variant="h2" sx={{ fontSize: { xs: '2.4rem', md: '3.4rem' }, lineHeight: 1.1 }}>
                    Family recipes plated with modern delivery rituals.
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(247,242,237,0.8)' }}>
                    Prep starts at dawn, menus drop at 10 AM, and every slot is run by Sushama and Rajendra—the two-person crew behind this micro-kitchen. We ferment, grind, and temper every masala in-house.
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(247,242,237,0.8)' }}>
                    The menu you see on the home page is cooked in tiny batches. When we sell out, that day’s window closes so we can reset for the next dispatch.
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <Button
                      component={Link}
                      href="/"
                      variant="contained"
                      sx={{
                        bgcolor: '#f8c28d',
                        color: '#1c130d',
                        textTransform: 'none',
                        '&:hover': { bgcolor: '#ffe1c5' },
                      }}
                    >
                      View today’s menu
                    </Button>
                    <Button
                      component={Link}
                      href="/checkout"
                      variant="outlined"
                      sx={{
                        textTransform: 'none',
                        borderColor: 'rgba(247,242,237,0.4)',
                        color: '#f7f2ed',
                      }}
                    >
                      Go to checkout
                    </Button>
                  </Stack>
                </Stack>
              </Grid>
            </Grid>
          </Container>
        </Box>

        <Box component="section" sx={{ py: 8, background: '#130d0a' }}>
          <Container maxWidth="lg">
            <Grid container spacing={4}>
              <Grid item xs={12} md={4}>
                <Typography variant="h5" sx={{ color: '#f8c28d', mb: 2 }}>
                  Small crew, big flavor
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(247,242,237,0.7)' }}>
                  We operate out of a compact commissary, staggering prep between lunch and dinner windows. Every chutney and tadka is finished minutes before dispatch.
                </Typography>
                <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
                  <IconButton color="inherit" size="small">
                    <Instagram />
                  </IconButton>
                  <IconButton color="inherit" size="small">
                    <WhatsApp />
                  </IconButton>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" sx={{ color: '#f8c28d', mb: 2 }}>
                  Reach us
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(247,242,237,0.7)' }}>
                  DM @rajskitchen for slot drops or catering. We answer between prep runs.
                </Typography>
              </Grid>
            </Grid>
          </Container>
        </Box>
      </Box>

      <Fab
        color="primary"
        component={Link}
        href="/"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          bgcolor: '#f8c28d',
          color: '#1c130d',
          '&:hover': { bgcolor: '#ffe1c5' },
        }}
      >
        <KeyboardArrowUp />
      </Fab>
    </Box>
  );
}
