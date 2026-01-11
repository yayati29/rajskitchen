'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  AddCircleOutline,
  Close,
  DeleteOutline,
  Edit,
  FileUpload,
  Pause,
  PlayArrow,
  RestaurantMenu,
} from '@mui/icons-material';

const DEFAULT_CATEGORIES = [
  { key: 'starters', label: 'Starters' },
  { key: 'mains', label: 'Main Course' },
  { key: 'breads', label: 'Breads' },
  { key: 'desserts', label: 'Desserts' },
];

const createEmptyMenu = () => ({
  categories: [...DEFAULT_CATEGORIES],
  items: DEFAULT_CATEGORIES.reduce((acc, category) => {
    acc[category.key] = [];
    return acc;
  }, {}),
});

const fallbackLabel = (key = '') =>
  key
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim() || 'Menu';

const normalizeMenuData = (data = {}) => {
  const incomingCategories = Array.isArray(data.categories) ? data.categories : [];
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
    categories.push(...DEFAULT_CATEGORIES);
  }

  const items = categories.reduce((acc, category) => {
    const fromItemsObject = Array.isArray(data.items?.[category.key]) ? data.items[category.key] : undefined;
    const legacyArray = Array.isArray(data[category.key]) ? data[category.key] : undefined;
    const source = fromItemsObject || legacyArray || [];
    acc[category.key] = source.map((item) => ({
      ...item,
      available: item?.available === false ? false : true,
    }));
    return acc;
  }, {});

  return { categories, items };
};

const blankFormValues = {
  categoryKey: DEFAULT_CATEGORIES[0].key,
  name: '',
  description: '',
  price: '',
  image: '',
  veg: false,
  bestseller: false,
  chefSpecial: false,
  spicy: 0,
  rating: '',
  reviews: '',
};

const slugifyLabel = (label) => {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `category-${Date.now()}`;
};

const generateMenuId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `menu-${Date.now()}`;

export default function EditMenuPage() {
  const [menuData, setMenuData] = useState(createEmptyMenu);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentTarget, setCurrentTarget] = useState(null);
  const [formValues, setFormValues] = useState(blankFormValues);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [categoryToRemove, setCategoryToRemove] = useState(null);
  const fileInputRef = useRef(null);

  const categoryOptions = menuData.categories;
  const hasCategories = categoryOptions.length > 0;
  const canRemoveCategory = categoryOptions.length > 1;

  useEffect(() => {
    let active = true;
    const fetchMenu = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/menu');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load menu data.');
        }
        if (active) {
          setMenuData(normalizeMenuData(payload.menu));
        }
      } catch (menuError) {
        if (active) {
          setError(menuError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchMenu();
    return () => {
      active = false;
    };
  }, []);

  const getItemsForCategory = (key) => menuData.items[key] || [];
  const getAllItems = () => categoryOptions.flatMap((category) => getItemsForCategory(category.key));

  const findCategoryKey = (itemId) => {
    for (const category of categoryOptions) {
      if ((menuData.items[category.key] || []).some((item) => item.id === itemId)) {
        return category.key;
      }
    }
    return categoryOptions[0]?.key ?? '';
  };

  const getCategoryLabel = (key) => categoryOptions.find((category) => category.key === key)?.label || fallbackLabel(key);

  const itemsToShow = useMemo(() => {
    let items = activeCategory === 'all' ? getAllItems() : getItemsForCategory(activeCategory);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name?.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query),
      );
    }
    return items;
  }, [menuData, categoryOptions, activeCategory, searchQuery]);

  const persistMenu = async (updatedMenu, successMessage) => {
    const response = await fetch('/api/menu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu: updatedMenu }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to save menu data.');
    }
    setMenuData(normalizeMenuData(payload.menu));
    if (successMessage) {
      setSnackbar(successMessage);
    }
  };

  const handleEditClick = (categoryKey, item) => {
    const resolvedCategory = categoryKey || findCategoryKey(item.id);
    setCurrentTarget({ categoryKey: resolvedCategory, id: item.id });
    setFormValues({
      categoryKey: resolvedCategory,
      name: item.name || '',
      description: item.description || '',
      price: item.price?.toString() ?? '',
      image: item.image || '',
      veg: Boolean(item.veg),
      bestseller: Boolean(item.bestseller),
      chefSpecial: Boolean(item.chefSpecial),
      spicy: Number.isFinite(item.spicy) ? item.spicy : 0,
      rating: item.rating?.toString() ?? '',
      reviews: item.reviews?.toString() ?? '',
    });
    setDialogOpen(true);
  };

  const handleAddNewClick = () => {
    const defaultCategory = activeCategory === 'all' ? categoryOptions[0]?.key : activeCategory;
    if (!defaultCategory) {
      setSnackbar('Create a category before adding dishes.');
      return;
    }
    setCurrentTarget({ categoryKey: defaultCategory, id: null });
    setFormValues({ ...blankFormValues, categoryKey: defaultCategory });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setCurrentTarget(null);
    setFormValues((prev) => ({ ...blankFormValues, categoryKey: prev.categoryKey }));
  };

  const handleDeleteClick = (categoryKey, item) => {
    setDeleteTarget({ categoryKey, id: item.id, name: item.name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return;
    }
    setSaving(true);
    try {
      const updatedItems = {
        ...menuData.items,
        [deleteTarget.categoryKey]: (menuData.items[deleteTarget.categoryKey] || []).filter(
          (item) => item.id !== deleteTarget.id,
        ),
      };
      await persistMenu({ categories: menuData.categories, items: updatedItems }, 'Menu item removed.');
      setDeleteTarget(null);
    } catch (deleteError) {
      setSnackbar(deleteError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (categoryKey, item) => {
    const currentlyAvailable = item.available !== false;
    setSaving(true);
    try {
      const updatedItems = {
        ...menuData.items,
        [categoryKey]: (menuData.items[categoryKey] || []).map((entry) =>
          entry.id === item.id ? { ...entry, available: !currentlyAvailable } : entry,
        ),
      };
      const message = currentlyAvailable ? 'Dish marked out of stock.' : 'Dish is back on the menu.';
      await persistMenu({ categories: menuData.categories, items: updatedItems }, message);
    } catch (toggleError) {
      setSnackbar(toggleError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const response = await fetch('/api/menu/upload', {
        method: 'POST',
        body: data,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Image upload failed.');
      }
      setFormValues((prev) => ({ ...prev, image: payload.url }));
      setSnackbar('Image uploaded.');
    } catch (uploadError) {
      setSnackbar(uploadError.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!currentTarget) {
      return;
    }
    if (!formValues.name.trim() || !formValues.description.trim()) {
      setSnackbar('Name and description are required.');
      return;
    }
    if (!formValues.categoryKey) {
      setSnackbar('Choose a category.');
      return;
    }
    const parsedPrice = Number(formValues.price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setSnackbar('Enter a valid price.');
      return;
    }

    const parsedRating = formValues.rating ? Number(formValues.rating) : 0;
    const parsedReviews = formValues.reviews ? Number(formValues.reviews) : 0;

    const updatedItem = {
      name: formValues.name.trim(),
      description: formValues.description.trim(),
      price: Number(parsedPrice.toFixed(2)),
      image: formValues.image,
      veg: Boolean(formValues.veg),
      bestseller: Boolean(formValues.bestseller),
      chefSpecial: Boolean(formValues.chefSpecial),
      spicy: Math.max(0, Math.min(3, Number(formValues.spicy) || 0)),
      rating: parsedRating >= 0 ? Number(parsedRating.toFixed(1)) : 0,
      reviews: parsedReviews > 0 ? Math.round(parsedReviews) : 0,
    };

    const isEditing = Boolean(currentTarget.id);
    const originalCategory = currentTarget.categoryKey;
    const destinationCategory = formValues.categoryKey;
    const itemsCopy = Object.keys(menuData.items).reduce((acc, key) => {
      acc[key] = [...(menuData.items[key] || [])];
      return acc;
    }, {});

    setSaving(true);
    try {
      if (isEditing) {
        const existingItem = (menuData.items[originalCategory] || []).find(
          (item) => item.id === currentTarget.id,
        );
        const availability = existingItem?.available === false ? false : true;
        if (originalCategory === destinationCategory) {
          itemsCopy[destinationCategory] = (itemsCopy[destinationCategory] || []).map((item) =>
            item.id === currentTarget.id ? { ...item, ...updatedItem, available: availability } : item,
          );
        } else {
          itemsCopy[originalCategory] = (itemsCopy[originalCategory] || []).filter(
            (item) => item.id !== currentTarget.id,
          );
          itemsCopy[destinationCategory] = [
            ...(itemsCopy[destinationCategory] || []),
            { ...updatedItem, available: availability, id: currentTarget.id },
          ];
        }
      } else {
        itemsCopy[destinationCategory] = [
          ...(itemsCopy[destinationCategory] || []),
          { ...updatedItem, available: true, id: generateMenuId() },
        ];
      }

      await persistMenu(
        { categories: menuData.categories, items: itemsCopy },
        isEditing ? 'Menu updated.' : 'Menu item added.',
      );
      handleDialogClose();
    } catch (saveError) {
      setSnackbar(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryCreate = async () => {
    const trimmed = categoryLabel.trim();
    if (!trimmed) {
      setSnackbar('Category name is required.');
      return;
    }
    const existingKeys = new Set(categoryOptions.map((category) => category.key));
    let slug = slugifyLabel(trimmed);
    while (existingKeys.has(slug)) {
      slug = `${slug}-${existingKeys.size + 1}`;
    }
    try {
      await persistMenu(
        {
          categories: [...menuData.categories, { key: slug, label: trimmed }],
          items: { ...menuData.items, [slug]: [] },
        },
        `Category "${trimmed}" added.`,
      );
      setActiveCategory(slug);
      setCategoryLabel('');
      setCategoryDialogOpen(false);
    } catch (categoryError) {
      setSnackbar(categoryError.message);
    }
  };

  const handleRemoveCategoryClick = () => {
    if (!canRemoveCategory) {
      setSnackbar('Keep at least one category.');
      return;
    }
    if (activeCategory === 'all') {
      setSnackbar('Select a category tab to remove.');
      return;
    }
    const target = categoryOptions.find((category) => category.key === activeCategory);
    if (target) {
      setCategoryToRemove(target);
    }
  };

  const handleCategoryRemove = async () => {
    if (!categoryToRemove) {
      return;
    }
    setSaving(true);
    try {
      const updatedCategories = menuData.categories.filter(
        (category) => category.key !== categoryToRemove.key,
      );
      const { [categoryToRemove.key]: _removed, ...rest } = menuData.items;
      await persistMenu({ categories: updatedCategories, items: rest }, 'Category removed.');
      if (activeCategory === categoryToRemove.key) {
        setActiveCategory('all');
      }
      setCategoryToRemove(null);
    } catch (removeError) {
      setSnackbar(removeError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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

  return (
    <Box sx={{ bgcolor: '#0f0b07', color: '#f7f2ed', minHeight: '100vh' }}>
      <Box
        component="section"
        sx={{
          background: 'radial-gradient(circle at top, rgba(248,194,141,0.12), transparent 60%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          py: { xs: 4, md: 6 },
        }}
      >
        <Container maxWidth="xl">
          <Stack spacing={2}>
            <Typography variant="overline" sx={{ letterSpacing: 2, color: 'rgba(247,242,237,0.7)' }}>
              Menu Manager
            </Typography>
            <Typography variant="h3" sx={{ fontFamily: 'var(--font-heading)', lineHeight: 1.1 }}>
              Edit live dishes without leaving the dashboard.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(247,242,237,0.75)', maxWidth: 600 }}>
              Use the pencil icon on any card to change its name, description, price, or hero image.
            </Typography>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: 5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <PaperSection
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          categories={categoryOptions}
          onAddCategoryClick={() => setCategoryDialogOpen(true)}
          onRemoveCategoryClick={handleRemoveCategoryClick}
          canRemoveCategory={canRemoveCategory && activeCategory !== 'all'}
        />

        <Grid container spacing={2} sx={{ mt: 2 }}>
          {hasCategories && (
            <Grid item xs={12} sm={6} md={4}>
              <Card
                onClick={handleAddNewClick}
                sx={{
                  height: '100%',
                  minHeight: 360,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  border: '1px dashed rgba(248,194,141,0.5)',
                  background: 'rgba(255,255,255,0.02)',
                  color: '#f8c28d',
                  cursor: 'pointer',
                  transition: 'border-color 0.3s ease, transform 0.3s ease',
                  '&:hover': {
                    borderColor: '#f8c28d',
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <AddCircleOutline sx={{ fontSize: 48, mb: 1 }} />
                <Typography fontWeight={600}>Add new dish</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(248,194,141,0.7)', mt: 0.5 }}>
                  Opens a fresh card in the editor
                </Typography>
              </Card>
            </Grid>
          )}

          {itemsToShow.map((item) => {
            const cardCategory = activeCategory === 'all' ? findCategoryKey(item.id) : activeCategory;
            const isOutOfStock = item.available === false;
            return (
              <Grid item xs={12} sm={6} md={4} key={item.id}>
                <Card
                  sx={{
                    height: '100%',
                    minHeight: 360,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#f7f2ed',
                    position: 'relative',
                  }}
                >
                  <Box sx={{ position: 'relative', height: 180, overflow: 'hidden' }}>
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
                          bgcolor: 'rgba(248,194,141,0.08)',
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
                          bgcolor: 'rgba(15,11,7,0.65)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f8c28d',
                          fontWeight: 700,
                          letterSpacing: 1,
                          textTransform: 'uppercase',
                          pointerEvents: 'none',
                        }}
                      >
                        Out of stock
                      </Box>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleEditClick(cardCategory, item)}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(15,11,7,0.6)',
                        border: '1px solid rgba(255,255,255,0.35)',
                        color: '#ffffff',
                        '&:hover': { bgcolor: 'rgba(15,11,7,0.9)', color: '#ffffff' },
                      }}
                    >
                      <Edit fontSize="small" sx={{ color: '#ffffff' }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(cardCategory, item)}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        bgcolor: 'rgba(198,30,30,0.7)',
                        border: '1px solid rgba(255,255,255,0.35)',
                        color: '#ffffff',
                        '&:hover': { bgcolor: 'rgba(198,30,30,0.9)', color: '#ffffff' },
                      }}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={saving}
                      onClick={() => handleToggleAvailability(cardCategory, item)}
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        bgcolor: isOutOfStock ? 'rgba(43,110,57,0.8)' : 'rgba(248,194,141,0.7)',
                        border: '1px solid rgba(255,255,255,0.35)',
                        color: '#ffffff',
                        '&:hover': {
                          bgcolor: isOutOfStock ? 'rgba(43,110,57,0.95)' : 'rgba(248,194,141,0.9)',
                          color: '#ffffff',
                        },
                      }}
                    >
                      {isOutOfStock ? <PlayArrow fontSize="small" /> : <Pause fontSize="small" />}
                    </IconButton>
                  </Box>

                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="subtitle1" fontWeight={600}>
                        {item.name}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        {item.veg && <Chip label="Veg" size="small" sx={{ fontSize: 10, height: 20 }} />}
                        {item.bestseller && (
                          <Chip label="Bestseller" size="small" sx={{ fontSize: 10, height: 20 }} />
                        )}
                        {item.chefSpecial && (
                          <Chip label="Chef's Special" size="small" sx={{ fontSize: 10, height: 20 }} />
                        )}
                      </Stack>
                    </Stack>
                    {isOutOfStock && (
                      <Chip
                        label="Out of stock"
                        size="small"
                        sx={{
                          mt: 0.5,
                          fontSize: 10,
                          height: 20,
                          bgcolor: 'rgba(198,30,30,0.25)',
                          color: '#ff9b9b',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      />
                    )}
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'rgba(247,242,237,0.7)',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        minHeight: 60,
                      }}
                    >
                      {item.description}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <Typography variant="subtitle1" sx={{ color: '#f8c28d', fontWeight: 700 }}>
                      ${item.price?.toFixed(2)}
                    </Typography>
                    <Chip label={getCategoryLabel(cardCategory)} size="small" sx={{ fontSize: 10, fontWeight: 600 }} />
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {itemsToShow.length === 0 && (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="h6" sx={{ color: 'rgba(247,242,237,0.7)' }}>
              No dishes match your filters.
            </Typography>
          </Box>
        )}
      </Container>

      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>{currentTarget?.id ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={formValues.categoryKey}
                onChange={(event) => setFormValues((prev) => ({ ...prev, categoryKey: event.target.value }))}
              >
                {categoryOptions.map((category) => (
                  <MenuItem key={category.key} value={category.key}>
                    {category.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Name"
              value={formValues.name}
              onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Description"
              value={formValues.description}
              onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Price"
              type="number"
              inputProps={{ step: '0.01', min: 0 }}
              value={formValues.price}
              onChange={(event) => setFormValues((prev) => ({ ...prev, price: event.target.value }))}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFileChange}
              />
              <Button
                variant="outlined"
                startIcon={<FileUpload />}
                onClick={handleUploadClick}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Image'}
              </Button>
              {formValues.image && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Image attached
                </Typography>
              )}
            </Stack>
            <TextField
              label="Image URL"
              value={formValues.image}
              onChange={(event) => setFormValues((prev) => ({ ...prev, image: event.target.value }))}
              fullWidth
            />
            {formValues.image && (
              <Box
                component="img"
                src={formValues.image}
                alt="Preview"
                sx={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 2, mt: 1 }}
              />
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formValues.veg}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, veg: event.target.checked }))}
                  />
                }
                label="Vegetarian"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formValues.bestseller}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, bestseller: event.target.checked }))}
                  />
                }
                label="Bestseller"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formValues.chefSpecial}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, chefSpecial: event.target.checked }))}
                  />
                }
                label="Chef's special"
              />
            </Stack>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Spice level
              </Typography>
              <Slider
                value={formValues.spicy}
                onChange={(_, value) => setFormValues((prev) => ({ ...prev, spicy: value }))}
                step={1}
                marks
                min={0}
                max={3}
              />
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Rating"
                type="number"
                inputProps={{ min: 0, max: 5, step: '0.1' }}
                value={formValues.rating}
                onChange={(event) => setFormValues((prev) => ({ ...prev, rating: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Reviews count"
                type="number"
                inputProps={{ min: 0, step: '1' }}
                value={formValues.reviews}
                onChange={(event) => setFormValues((prev) => ({ ...prev, reviews: event.target.value }))}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar('')}
        message={snackbar}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remove Menu Item</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove {deleteTarget?.name} from the menu?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={saving}>
            Cancel
          </Button>
          <Button color="error" onClick={handleDeleteConfirm} disabled={saving}>
            {saving ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Category</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Category name"
            value={categoryLabel}
            onChange={(event) => setCategoryLabel(event.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCategoryCreate} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(categoryToRemove)} onClose={() => setCategoryToRemove(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove Category</DialogTitle>
        <DialogContent>
          <Typography>
            Removing "{categoryToRemove?.label}" will also delete its dishes. Continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryToRemove(null)} disabled={saving}>
            Cancel
          </Button>
          <Button color="error" onClick={handleCategoryRemove} disabled={saving}>
            {saving ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function PaperSection({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  categories,
  onAddCategoryClick,
  onRemoveCategoryClick,
  canRemoveCategory,
}) {
  const tabs = [{ key: 'all', label: 'All Items' }, ...categories];
  return (
    <Card
      sx={{
        p: 3,
        borderRadius: 3,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Stack spacing={2.5}>
        <TextField
          placeholder="Search dishes..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          fullWidth
          InputProps={{
            sx: {
              color: '#f7f2ed',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#f8c28d' },
            },
          }}
        />
        <Stack direction="row" alignItems="center" spacing={1}>
          <Tabs
            value={activeCategory}
            onChange={(_, value) => onCategoryChange(value)}
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
            {tabs.map((category) => (
              <Tab key={category.key} value={category.key} label={category.label} />
            ))}
          </Tabs>
          <Tooltip title="Add category">
            <IconButton onClick={onAddCategoryClick} sx={{ color: '#f8c28d' }}>
              <Add />
            </IconButton>
          </Tooltip>
          <Tooltip title={canRemoveCategory ? 'Remove category' : 'Select another tab to remove'}>
            <span>
              <IconButton
                onClick={onRemoveCategoryClick}
                disabled={!canRemoveCategory}
                sx={{ color: canRemoveCategory ? '#f46d6d' : 'rgba(255,255,255,0.3)' }}
              >
                <DeleteOutline />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
    </Card>
  );
}
