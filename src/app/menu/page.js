'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  Add,
  Close,
  Delete,
  Favorite,
  FavoriteBorder,
  Remove,
  RestaurantMenu,
  Search,
  ShoppingCart,
} from '@mui/icons-material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import KitchenClosedLanding from '@/components/KitchenClosedLanding';
import { useTheme } from '@mui/material/styles';
import getSupabaseClient from '@/lib/supabaseClient';

const DEFAULT_CATEGORIES = [
  { key: 'starters', label: 'Starters' },
  { key: 'mains', label: 'Main Course' },
  { key: 'breads', label: 'Breads' },
  { key: 'desserts', label: 'Desserts' },
];

const fallbackLabel = (key = '') =>
  key
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim() || 'Menu';

const createEmptyMenu = () => ({
  categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
  items: DEFAULT_CATEGORIES.reduce((acc, category) => {
    acc[category.key] = [];
    return acc;
  }, {}),
});

const normalizeMenuData = (menu = {}) => {
  const incomingCategories = Array.isArray(menu.categories) ? menu.categories : [];
  const categories = [];
  const seen = new Set();

  (incomingCategories.length ? incomingCategories : DEFAULT_CATEGORIES).forEach((category) => {
    if (!category) {
      return;
    }
    const key = typeof category.key === 'string' ? category.key.trim() : '';
    if (!key || seen.has(key)) {
      return;
    }
    categories.push({ key, label: category.label?.trim() || fallbackLabel(key) });
    seen.add(key);
  });

  if (!categories.length) {
    DEFAULT_CATEGORIES.forEach((category) => {
      categories.push({ ...category });
    });
  }

  const itemsBucket = typeof menu.items === 'object' && menu.items ? menu.items : {};

  const items = categories.reduce((acc, category) => {
    const legacyArray = Array.isArray(menu[category.key]) ? menu[category.key] : [];
    const source = Array.isArray(itemsBucket[category.key]) ? itemsBucket[category.key] : legacyArray;
    acc[category.key] = Array.isArray(source)
      ? source.map((item) => ({
          ...item,
          available: item?.available === false ? false : true,
        }))
      : [];
    return acc;
  }, {});

  return { categories, items };
};

export default function MenuPage() {
  const [menuData, setMenuData] = useState(createEmptyMenu);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [cart, setCart] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [kitchenOpen, setKitchenOpen] = useState(true);
  const router = useRouter();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobileListView = useMediaQuery(theme.breakpoints.down('sm'));
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  const categoryTabs = useMemo(
    () => [{ key: 'all', label: 'All Items' }, ...menuData.categories],
    [menuData.categories],
  );

  useEffect(() => {
    let isMounted = true;

    const fetchMenu = async () => {
      try {
        const response = await fetch('/api/menu');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to fetch menu data: ${response.status}`);
        }

        if (isMounted) {
          setMenuData(normalizeMenuData(payload.menu));
          setMenuError(null);
        }
      } catch (error) {
        console.error('Failed to load menu data', error);
        if (isMounted) {
          setMenuError('Unable to load the menu right now. Please try again shortly.');
          setMenuData(createEmptyMenu());
        }
      } finally {
        if (isMounted) {
          setLoadingMenu(false);
        }
      }
    };

    fetchMenu();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const MENU_ROW_ID = 'active-menu';

    const channel = supabase
      .channel('menu-listener')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'menus', filter: `id=eq.${MENU_ROW_ID}` },
        (payload) => {
          try {
            if (payload?.new?.payload) {
              setMenuData(normalizeMenuData(payload.new.payload));
            }
          } catch (e) {
            console.error('Failed to apply realtime menu update', e);
          }
        },
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // ignore cleanup errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling fallback when Supabase realtime isn't configured
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (supabase) return;

    let mounted = true;
    let currentVersion = null;

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/menu/last-updated');
        const json = await res.json().catch(() => null);
        if (!res.ok || !json) return;
        if (currentVersion && json.version && json.version !== currentVersion) {
          const resp = await fetch('/api/menu');
          const payload = await resp.json().catch(() => null);
          if (resp.ok && payload?.menu && mounted) {
            setMenuData(normalizeMenuData(payload.menu));
          }
        }
        currentVersion = json.version;
      } catch (e) {
        console.error('Menu polling failed', e);
      }
    };

    checkVersion();
    const id = setInterval(checkVersion, 3000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeCategory === 'all') {
      return;
    }
    const exists = menuData.categories.some((category) => category.key === activeCategory);
    if (!exists) {
      setActiveCategory('all');
    }
  }, [menuData.categories, activeCategory]);

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
      console.error('Failed to restore cart from storage', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.setItem('rajCart', JSON.stringify(cart));
    } catch (error) {
      console.error('Failed to persist cart state', error);
    }
  }, [cart]);

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

  const getItemsForCategory = (categoryKey) => menuData.items[categoryKey] || [];

  const getAllItems = () => menuData.categories.flatMap((category) => getItemsForCategory(category.key));

  const getFilteredItems = () => {
    let items = activeCategory === 'all' ? getAllItems() : getItemsForCategory(activeCategory);

    if (searchQuery) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return items;
  };

  const toggleFavorite = (id) => {
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const addToCart = (item) => {
    if (item.available === false) {
      return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateCartQuantity = (id, delta) => {
    setCart(prev => {
      return prev
        .map(c => {
          if (c.id === id) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean);
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const findCartEntry = (id) => cart.find((entry) => entry.id === id);
  const filteredItems = getFilteredItems();
  const showSearchField = isSearchExpanded || Boolean(searchQuery);
  const renderItemControls = (item, isOutOfStock, sizeVariant = 'default') => {
    const cartEntry = findCartEntry(item.id);
    const isCompact = sizeVariant === 'compact';
    const buttonPadding = sizeVariant === 'compact' ? { py: 0.35, px: 1.4 } : { py: 0.5, px: 1.8 };
    const quantityWidth = sizeVariant === 'compact' ? 24 : 28;
    const iconPadding = sizeVariant === 'compact' ? 0.4 : 0.5;
    const preventLayoutShift = isCompact && !cartEntry;
    const controlStackSx = isCompact
      ? { minWidth: 132, justifyContent: 'flex-end' }
      : {};
    const minusButtonSx = {
      bgcolor: 'rgba(255,255,255,0.08)',
      color: '#f7f2ed',
      border: '1px solid rgba(255,255,255,0.25)',
      p: iconPadding,
      '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
    };
    const plusButtonSx = {
      bgcolor: '#f8c28d',
      color: '#1c130d',
      border: '1px solid rgba(0,0,0,0.12)',
      p: iconPadding,
      '&:hover': { bgcolor: '#ffe1c5' },
    };

    if (isOutOfStock) {
      return (
        <Button
          variant="contained"
          size="small"
          disabled
          sx={{
            ...buttonPadding,
            bgcolor: 'rgba(255,255,255,0.08)',
            color: 'rgba(247,242,237,0.6)',
            textTransform: 'none',
          }}
        >
          Out of stock
        </Button>
      );
    }

    if (!cartEntry) {
      return (
        <Stack direction="row" spacing={1} alignItems="center" sx={controlStackSx}>
          {preventLayoutShift && (
            <IconButton
              size="small"
              sx={{ ...minusButtonSx, visibility: 'hidden', pointerEvents: 'none' }}
            >
              <Remove fontSize="small" />
            </IconButton>
          )}
          <Button
            variant="contained"
            size="small"
            startIcon={<Add />}
            onClick={() => addToCart(item)}
            sx={{
              ...buttonPadding,
              bgcolor: '#f8c28d',
              color: '#1c130d',
              textTransform: 'none',
              '&:hover': { bgcolor: '#ffe1c5' },
            }}
          >
            Add
          </Button>
          {preventLayoutShift && (
            <IconButton
              size="small"
              sx={{ ...plusButtonSx, visibility: 'hidden', pointerEvents: 'none' }}
            >
              <Add fontSize="small" />
            </IconButton>
          )}
        </Stack>
      );
    }

    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={controlStackSx}>
        <IconButton
          size="small"
          onClick={() => updateCartQuantity(item.id, -1)}
          sx={minusButtonSx}
        >
          <Remove fontSize="small" />
        </IconButton>
        <Typography fontWeight={600} sx={{ minWidth: quantityWidth, textAlign: 'center', color: '#f7f2ed' }}>
          {cartEntry.quantity}
        </Typography>
        <IconButton
          size="small"
          onClick={() => updateCartQuantity(item.id, 1)}
          sx={plusButtonSx}
        >
          <Add fontSize="small" />
        </IconButton>
      </Stack>
    );
  };

  const handleCheckout = () => {
    if (!cart.length) {
      return;
    }

    try {
      localStorage.setItem('rajCart', JSON.stringify(cart));
    } catch (error) {
      console.error('Failed to persist cart before checkout', error);
    }

    router.push('/checkout');
    setCartDrawerOpen(false);
  };

  const renderCartPanel = (paperSx = {}) => (
    <Paper
      sx={{
        p: 3,
        borderRadius: 3,
        maxHeight: isDesktop ? 'calc(100vh - 140px)' : '75vh',
        overflow: 'auto',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        ...paperSx,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <ShoppingCart sx={{ color: '#f8c28d' }} />
        <Typography variant="h6" fontWeight={600}>
          Your Cart
        </Typography>
        {cartCount > 0 && (
          <Chip label={`${cartCount} items`} size="small" sx={{ bgcolor: '#f8c28d', color: '#1c130d' }} />
        )}
      </Stack>

      <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

      {cart.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <ShoppingCart sx={{ fontSize: 50, color: 'rgba(255,255,255,0.3)', mb: 1 }} />
          <Typography sx={{ color: 'rgba(247,242,237,0.7)' }} variant="body2">
            Your cart is empty
          </Typography>
          <Typography sx={{ color: 'rgba(247,242,237,0.5)' }} variant="caption">
            Add items from the menu
          </Typography>
        </Box>
      ) : (
        <>
          <List disablePadding>
            {cart.map((item) => (
              <ListItem
                key={item.id}
                sx={{
                  px: 0,
                  py: 1.5,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'rgba(248,194,141,0.15)', width: 44, height: 44 }}>
                    <RestaurantMenu sx={{ color: '#f8c28d' }} fontSize="small" />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight={600}>
                      {item.name}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: '#f8c28d' }} fontWeight={600}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </Typography>
                  }
                />
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <IconButton
                    size="small"
                    onClick={() => updateCartQuantity(item.id, -1)}
                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', p: 0.5 }}
                  >
                    <Remove fontSize="small" />
                  </IconButton>
                  <Typography fontWeight={600} sx={{ minWidth: 24, textAlign: 'center', color: '#f7f2ed' }}>
                    {item.quantity}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => updateCartQuantity(item.id, 1)}
                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', p: 0.5 }}
                  >
                    <Add fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => removeFromCart(item.id)}
                    sx={{ color: 'error.main', ml: 0.5 }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
              </ListItem>
            ))}
          </List>

          <Box sx={{ mt: 3 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: 'rgba(247,242,237,0.7)' }}>Subtotal</Typography>
              <Typography fontWeight={600} sx={{ color: '#f7f2ed' }}>${cartTotal.toFixed(2)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: 'rgba(247,242,237,0.7)' }}>Delivery</Typography>
              <Typography fontWeight={600} sx={{ color: '#f7f2ed' }}>$2.99</Typography>
            </Stack>
            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
              <Typography variant="h6">Total</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#f8c28d' }}>
                ${(cartTotal + 2.99).toFixed(2)}
              </Typography>
            </Stack>

            <Button
              variant="contained"
              size="large"
              fullWidth
              sx={{ mb: 1.5, bgcolor: '#f8c28d', color: '#1c130d', '&:hover': { bgcolor: '#ffe1c5' } }}
              onClick={handleCheckout}
            >
              Proceed to Checkout
            </Button>

            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={() => setCart([])}
              color="inherit"
              sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(247,242,237,0.8)' }}
            >
              Clear Cart
            </Button>
          </Box>
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
            <Button
              color="inherit"
              component={Link}
              href="/about"
              sx={{ textTransform: 'none', color: '#f7f2ed' }}
            >
              About
            </Button>
            <Button
              variant="contained"
              component={Link}
              href="#menu"
              sx={{
                bgcolor: '#f8c28d',
                color: '#1c130d',
                textTransform: 'none',
                '&:hover': { bgcolor: '#ffe1c5' },
              }}
            >
              Menu
            </Button>
            <IconButton color="inherit" component={Link} href="/checkout" aria-label="View cart">
              <Badge
                badgeContent={cartCount}
                color="secondary"
                overlap="circular"
                invisible={!cartCount}
                sx={{ '& .MuiBadge-badge': { bgcolor: '#f8c28d', color: '#1c130d' } }}
              >
                <ShoppingCart />
              </Badge>
            </IconButton>
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
        <Container maxWidth="xl">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack spacing={3}>
                <Typography variant="overline" sx={{ letterSpacing: 2, color: 'rgba(247,242,237,0.7)' }}>
                  Dispatching Today
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: 'var(--font-heading)',
                    lineHeight: 1.1,
                    fontSize: { xs: '2rem', sm: '2.4rem', md: '3.2rem' },
                  }}
                >
                  A rotating menu cooked in tiny batches and dropped once a day.
                </Typography>
                {/*
                <Typography
                  variant="body1"
                  sx={{ color: 'rgba(247,242,237,0.75)', maxWidth: 600 }}
                >
                  Slots open at 10 AM. Pick your dishes, lock a window, and Raj’s crew fires each order 30 minutes before pickup or dispatch.
                </Typography>
                */}
                <Stack direction="row" spacing={1.5} flexWrap="wrap">
                  <Chip label="Lunch 12-3" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#f8c28d' }} />
                  <Chip label="Dinner 6-10" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#f8c28d' }} />
                  <Chip label="2-person crew" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#f8c28d' }} />
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container id="menu" maxWidth="xl" sx={{ py: { xs: 4, md: 5 }, pb: { xs: 10, md: 5 } }}>
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            alignItems: 'flex-start',
            flexDirection: { xs: 'column', lg: 'row' },
          }}
        >
          {/* Menu column */}
          <Box
            sx={{
              flexBasis: { lg: '70%' },
              maxWidth: { lg: '70%' },
              width: '100%',
              order: { xs: 1, lg: 1 },
            }}
          >
            <Paper
              sx={{
                p: 3,
                borderRadius: 3,
                mb: 3,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                position: 'sticky',
                top: { xs: 112, sm: 96, md: 88 },
                zIndex: 5,
                boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Stack spacing={2.5}>
                <Box sx={{ position: 'relative' }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ pr: 6 }}>
                    <Tabs
                      value={activeCategory}
                      onChange={(e, v) => setActiveCategory(v)}
                      variant="scrollable"
                      scrollButtons="auto"
                      sx={{
                        flexGrow: 1,
                        '& .MuiTab-root': {
                          textTransform: 'none',
                          fontWeight: 500,
                          minWidth: 'auto',
                          px: 2,
                          color: 'rgba(247,242,237,0.65)',
                        },
                        '& .Mui-selected': { color: '#f8c28d !important' },
                        '& .MuiTabs-indicator': { backgroundColor: '#f8c28d' },
                      }}
                    >
                      {categoryTabs.map(cat => (
                        <Tab key={cat.key} value={cat.key} label={cat.label} />
                      ))}
                    </Tabs>
                  </Stack>
                  <IconButton
                    aria-label="Open search"
                    onClick={() => setIsSearchExpanded(true)}
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: isSearchExpanded || searchQuery ? '#f8c28d' : 'rgba(255,255,255,0.08)',
                      color: isSearchExpanded || searchQuery ? '#1c130d' : 'rgba(247,242,237,0.8)',
                      transition: 'background-color 0.3s ease',
                      zIndex: 6,
                    }}
                  >
                    <Search />
                  </IconButton>

                  {showSearchField && (
                    <Paper
                      elevation={6}
                      sx={{
                        position: 'absolute',
                        top: { xs: -10, sm: -14 },
                        right: 0,
                        width: { xs: '100%', sm: 320 },
                        bgcolor: 'rgba(12,8,5,0.96)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 2,
                        p: 1.25,
                        zIndex: 7,
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          fullWidth
                          placeholder="Search dishes..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          autoFocus={isSearchExpanded}
                          size="small"
                          InputProps={{
                            sx: {
                              color: '#f7f2ed',
                              '& .MuiInputBase-input': { color: '#f7f2ed' },
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
                            },
                          }}
                        />
                        <IconButton
                          aria-label="Clear search"
                          onClick={() => {
                            setSearchQuery('');
                            setIsSearchExpanded(false);
                          }}
                          sx={{ color: 'rgba(247,242,237,0.9)' }}
                        >
                          <Close />
                        </IconButton>
                      </Stack>
                    </Paper>
                  )}
                </Box>
              </Stack>
            </Paper>

            {isMobileListView ? (
              <Stack spacing={2}>
                {filteredItems.map((item) => {
                  const isOutOfStock = item.available === false;
                  return (
                    <Paper
                      key={item.id}
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)',
                        display: 'flex',
                        gap: 2,
                        alignItems: 'stretch',
                      }}
                    >
                      <Box
                        sx={{
                          width: 88,
                          height: 88,
                          borderRadius: 2,
                          overflow: 'hidden',
                          position: 'relative',
                          flexShrink: 0,
                          bgcolor: 'rgba(248,194,141,0.08)',
                        }}
                      >
                        {item.image ? (
                          <Box
                            component="img"
                            src={item.image}
                            alt={item.name}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <RestaurantMenu sx={{ fontSize: 28, color: '#f8c28d' }} />
                          </Box>
                        )}
                        {isOutOfStock && (
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              bgcolor: 'rgba(12,8,5,0.65)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: 0.5,
                              color: '#f8c28d',
                              textTransform: 'uppercase',
                            }}
                          >
                            Out
                          </Box>
                        )}
                      </Box>

                      <Stack spacing={1} sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight={600} noWrap>
                              {item.name}
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                              {item.veg && (
                                <Chip label="Veg" size="small" sx={{ fontWeight: 600, fontSize: 10, height: 20, bgcolor: '#204c3d', color: '#8afacb' }} />
                              )}
                              {item.bestseller && (
                                <Chip label="Bestseller" size="small" sx={{ fontWeight: 600, fontSize: 10, height: 20, bgcolor: '#4a1d1d', color: '#ffb6b6' }} />
                              )}
                              {item.chefSpecial && (
                                <Chip label="Chef's Special" size="small" sx={{ fontWeight: 600, fontSize: 10, height: 20, bgcolor: '#2b1f4b', color: '#c3a7ff' }} />
                              )}
                              {isOutOfStock && (
                                <Chip label="Paused" size="small" sx={{ fontWeight: 600, fontSize: 10, height: 20, bgcolor: '#5d2a2a', color: '#ffb6b6' }} />
                              )}
                            </Stack>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={() => toggleFavorite(item.id)}
                            sx={{ p: 0.5, bgcolor: 'rgba(15,11,7,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
                          >
                            {favorites.includes(item.id) ? (
                              <Favorite fontSize="small" sx={{ color: '#f46d6d' }} />
                            ) : (
                              <FavoriteBorder fontSize="small" sx={{ color: 'rgba(247,242,237,0.7)' }} />
                            )}
                          </IconButton>
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'rgba(247,242,237,0.75)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {item.description}
                        </Typography>
                      </Stack>

                      <Stack spacing={1} alignItems="flex-end" justifyContent="space-between">
                        <Typography variant="subtitle1" sx={{ color: '#f8c28d', fontWeight: 700 }}>
                          ${item.price.toFixed(2)}
                        </Typography>
                        {renderItemControls(item, isOutOfStock, 'compact')}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            ) : (
              <Grid container spacing={2}>
                {filteredItems.map((item) => {
                  const isOutOfStock = item.available === false;
                  return (
                    <Grid item xs={12} sm={6} md={4} key={item.id}>
                      <Card
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: 4,
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(255,255,255,0.03)',
                          color: '#f7f2ed',
                          transition: 'transform 0.3s ease, border-color 0.3s ease',
                          boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
                          '&:hover': {
                            transform: 'translateY(-6px)',
                            borderColor: 'rgba(248,194,141,0.6)',
                          },
                        }}
                      >
                        <Box sx={{ position: 'relative', height: 180, overflow: 'hidden', bgcolor: 'rgba(248,194,141,0.08)' }}>
                          {item.image ? (
                            <CardMedia
                              component="img"
                              image={item.image}
                              alt={item.name}
                              sx={{ height: '100%', width: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Box
                              sx={{
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <RestaurantMenu sx={{ fontSize: 40, color: '#f8c28d' }} />
                            </Box>
                          )}
                          {isOutOfStock && (
                            <Box
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                bgcolor: 'rgba(12,8,5,0.65)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                                fontWeight: 700,
                                color: '#f8c28d',
                                pointerEvents: 'none',
                              }}
                            >
                              Out of stock
                            </Box>
                          )}

                          <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 8, left: 8 }}>
                            {item.veg && (
                              <Chip label="Veg" size="small" sx={{ fontWeight: 600, fontSize: 10, height: 20, bgcolor: '#204c3d', color: '#8afacb' }} />
                            )}
                            {item.bestseller && (
                              <Chip label="Bestseller" size="small" sx={{ fontWeight: 600, fontSize: 10, height: 20, bgcolor: '#4a1d1d', color: '#ffb6b6' }} />
                            )}
                            {item.chefSpecial && (
                              <Chip label="Chef's Special" size="small" sx={{ fontWeight: 600, fontSize: 10, height: 20, bgcolor: '#2b1f4b', color: '#c3a7ff' }} />
                            )}
                            {isOutOfStock && (
                              <Chip label="Paused" size="small" sx={{ fontWeight: 600, fontSize: 10, height: 20, bgcolor: '#5d2a2a', color: '#ffb6b6' }} />
                            )}
                          </Stack>

                          <IconButton
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              bgcolor: 'rgba(15,11,7,0.9)',
                              border: '1px solid rgba(255,255,255,0.15)',
                              '&:hover': { bgcolor: 'rgba(15,11,7,1)' },
                              p: 0.5,
                            }}
                            size="small"
                            onClick={() => toggleFavorite(item.id)}
                          >
                            {favorites.includes(item.id) ? (
                              <Favorite fontSize="small" sx={{ color: '#f46d6d' }} />
                            ) : (
                              <FavoriteBorder fontSize="small" sx={{ color: 'rgba(247,242,237,0.7)' }} />
                            )}
                          </IconButton>
                        </Box>

                        <CardContent sx={{ flexGrow: 1, py: 2, px: 2.5 }}>
                          <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                            {item.name}
                          </Typography>

                          <Typography variant="body2" sx={{ mt: 0.75, fontSize: 12, color: 'rgba(247,242,237,0.7)' }}>
                            {item.description}
                          </Typography>

                        </CardContent>

                        <CardActions sx={{ px: 2.5, pb: 2.5, pt: 0, justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1" sx={{ color: '#f8c28d', fontWeight: 700 }}>
                            ${item.price.toFixed(2)}
                          </Typography>
                          {renderItemControls(item, isOutOfStock)}
                        </CardActions>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}

            {filteredItems.length === 0 && (
              <Paper
                sx={{
                  p: 6,
                  textAlign: 'center',
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {loadingMenu ? (
                  <Typography variant="h6" sx={{ color: 'rgba(247,242,237,0.7)' }}>
                    Loading menu...
                  </Typography>
                ) : menuError ? (
                  <>
                    <Typography variant="h6" color="error">
                      {menuError}
                    </Typography>
                    <Button
                      variant="outlined"
                      sx={{ mt: 2, borderColor: 'rgba(255,255,255,0.3)', color: '#f7f2ed' }}
                      onClick={() => window.location.reload()}
                    >
                      Retry
                    </Button>
                  </>
                ) : (
                  <>
                    <Typography variant="h6" sx={{ color: 'rgba(247,242,237,0.7)' }}>
                      No dishes found matching your criteria
                    </Typography>
                    <Button
                      variant="outlined"
                      sx={{ mt: 2, borderColor: 'rgba(255,255,255,0.3)', color: '#f7f2ed' }}
                      onClick={() => {
                        setSearchQuery('');
                        setActiveCategory('all');
                        setIsSearchExpanded(false);
                      }}
                    >
                      Clear Filters
                    </Button>
                  </>
                )}
              </Paper>
            )}
          </Box>

          {/* Cart column */}
          <Box
            sx={{
              flexBasis: { lg: '30%' },
              maxWidth: { lg: '30%' },
              width: '100%',
              order: { xs: 2, lg: 2 },
              position: { xs: 'static', lg: 'sticky' },
              top: { lg: 104 },
              alignSelf: 'flex-start',
              mt: { xs: 3, lg: 0 },
            }}
          >
            <Paper
              sx={{
                p: 3,
                borderRadius: 3,
                maxHeight: { lg: 'calc(100vh - 140px)' },
                overflow: 'auto',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <ShoppingCart sx={{ color: '#f8c28d' }} />
                <Typography variant="h6" fontWeight={600}>
                  Your Cart
                </Typography>
                {cartCount > 0 && (
                  <Chip label={`${cartCount} items`} size="small" sx={{ bgcolor: '#f8c28d', color: '#1c130d' }} />
                )}
              </Stack>

              <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

              {cart.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <ShoppingCart sx={{ fontSize: 50, color: 'rgba(255,255,255,0.3)', mb: 1 }} />
                  <Typography sx={{ color: 'rgba(247,242,237,0.7)' }} variant="body2">
                    Your cart is empty
                  </Typography>
                  <Typography sx={{ color: 'rgba(247,242,237,0.5)' }} variant="caption">
                    Add items from the menu
                  </Typography>
                </Box>
              ) : (
                <>
                  <List disablePadding>
                    {cart.map((item) => (
                      <ListItem
                        key={item.id}
                        sx={{
                          px: 0,
                          py: 1.5,
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'rgba(248,194,141,0.15)', width: 44, height: 44 }}>
                            <RestaurantMenu sx={{ color: '#f8c28d' }} fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight={600}>
                              {item.name}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="caption" sx={{ color: '#f8c28d' }} fontWeight={600}>
                              ${(item.price * item.quantity).toFixed(2)}
                            </Typography>
                          }
                        />
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <IconButton
                            size="small"
                            onClick={() => updateCartQuantity(item.id, -1)}
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', p: 0.5 }}
                          >
                            <Remove fontSize="small" />
                          </IconButton>
                          <Typography fontWeight={600} sx={{ minWidth: 24, textAlign: 'center', color: '#f7f2ed' }}>
                            {item.quantity}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => updateCartQuantity(item.id, 1)}
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', p: 0.5 }}
                          >
                            <Add fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => removeFromCart(item.id)}
                            sx={{ color: 'error.main', ml: 0.5 }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      </ListItem>
                    ))}
                  </List>

                  <Box sx={{ mt: 3 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography sx={{ color: 'rgba(247,242,237,0.7)' }}>Subtotal</Typography>
                      <Typography fontWeight={600} sx={{ color: '#f7f2ed' }}>${cartTotal.toFixed(2)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography sx={{ color: 'rgba(247,242,237,0.7)' }}>Delivery</Typography>
                      <Typography fontWeight={600} sx={{ color: '#f7f2ed' }}>$2.99</Typography>
                    </Stack>
                    <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
                      <Typography variant="h6">Total</Typography>
                      <Typography variant="h6" fontWeight={700} sx={{ color: '#f8c28d' }}>
                        ${(cartTotal + 2.99).toFixed(2)}
                      </Typography>
                    </Stack>

                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      sx={{ mb: 1.5, bgcolor: '#f8c28d', color: '#1c130d', '&:hover': { bgcolor: '#ffe1c5' } }}
                      onClick={handleCheckout}
                    >
                      Proceed to Checkout
                    </Button>

                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      onClick={() => setCart([])}
                      color="inherit"
                      sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(247,242,237,0.8)' }}
                    >
                      Clear Cart
                    </Button>
                  </Box>
                </>
              )}
            </Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
