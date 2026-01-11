import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getSupabaseAdminClient } from '@/lib/supabaseServer';

const dataDirectory = path.join(process.cwd(), 'data');
const menuJsonPath = path.join(dataDirectory, 'menu.json');
const seedYamlPath = path.join(process.cwd(), 'public', 'menu.yaml');
const assetsDirectory = path.join(process.cwd(), 'public', 'assets');
const MENU_ROW_ID = 'active-menu';
const supabase = getSupabaseAdminClient();
const supabaseEnabled = Boolean(supabase);

const DEFAULT_CATEGORIES = [
  { key: 'starters', label: 'Starters' },
  { key: 'mains', label: 'Main Course' },
  { key: 'breads', label: 'Breads' },
  { key: 'desserts', label: 'Desserts' },
];

const fallbackLabel = (key) => key
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (match) => match.toUpperCase())
  .trim() || 'Menu';

function normalizeCategory(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map(item => ({
    ...item,
    price: typeof item.price === 'number' ? item.price : Number(item.price) || 0,
    name: item.name ?? 'Menu Item',
    description: item.description ?? '',
    available: item.available === false ? false : true,
    veg: item.veg === true,
    bestseller: item.bestseller === true,
    chefSpecial: item.chefSpecial === true,
    spicy: Number.isFinite(item.spicy) ? Math.max(0, Math.min(3, Number(item.spicy))) : 0,
    rating: typeof item.rating === 'number' ? item.rating : Number(item.rating) || 0,
    reviews: Number.isFinite(item.reviews) ? Number(item.reviews) : 0,
  }));
}

function normalizeCategories(categories) {
  const source = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES;
  const seen = new Set();
  const normalized = [];
  for (const entry of source) {
    if (!entry || typeof entry !== 'object') continue;
    const key = typeof entry.key === 'string' ? entry.key.trim() : '';
    if (!key || seen.has(key)) continue;
    normalized.push({ key, label: entry.label?.trim() || fallbackLabel(key) });
    seen.add(key);
  }
  return normalized.length ? normalized : DEFAULT_CATEGORIES;
}

function normalizeMenu(menu = {}) {
  const categories = normalizeCategories(menu.categories);
  const itemsBucket = typeof menu.items === 'object' && menu.items ? menu.items : {};

  const items = categories.reduce((acc, category) => {
    const key = category.key;
    const legacyItems = Array.isArray(menu[key]) ? menu[key] : [];
    const sourceItems = Array.isArray(itemsBucket[key]) ? itemsBucket[key] : legacyItems;
    acc[key] = normalizeCategory(sourceItems);
    return acc;
  }, {});

  return { categories, items };
}

async function ensureMenuFile() {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    await fs.access(menuJsonPath);
    return;
  } catch {
    // fall through to seeding
  }

  try {
    const rawYaml = await fs.readFile(seedYamlPath, 'utf-8');
    const parsedYaml = yaml.load(rawYaml) || {};
    const normalized = normalizeMenu(parsedYaml);
    await fs.writeFile(menuJsonPath, JSON.stringify(normalized, null, 2), 'utf-8');
    return;
  } catch (seedError) {
    console.warn('Unable to seed menu from YAML, falling back to empty menu.', seedError);
  }

  await fs.writeFile(menuJsonPath, JSON.stringify(normalizeMenu(), null, 2), 'utf-8');
}

async function readMenuFromSupabase() {
  const { data, error } = await supabase
    .from('menus')
    .select('payload')
    .eq('id', MENU_ROW_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.payload) {
    return normalizeMenu(data.payload);
  }

  const seeded = normalizeMenu();
  const insertResult = await supabase
    .from('menus')
    .upsert({ id: MENU_ROW_ID, payload: seeded })
    .select('payload')
    .single();

  if (insertResult.error) {
    throw insertResult.error;
  }

  return normalizeMenu(insertResult.data.payload);
}

async function writeMenuToSupabase(nextMenu) {
  const normalized = normalizeMenu(nextMenu);
  const { error } = await supabase
    .from('menus')
    .upsert({ id: MENU_ROW_ID, payload: normalized });
  if (error) {
    throw error;
  }
  return normalized;
}

export async function readMenuData() {
  if (supabaseEnabled) {
    try {
      return await readMenuFromSupabase();
    } catch (error) {
      console.error('Unable to read menu data from Supabase, falling back to file store.', error);
    }
  }

  try {
    await ensureMenuFile();
    const raw = await fs.readFile(menuJsonPath, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    return normalizeMenu(parsed);
  } catch (error) {
    console.error('Unable to read menu data from file store', error);
    return normalizeMenu();
  }
}

export async function writeMenuData(nextMenu = {}) {
  if (supabaseEnabled) {
    try {
      return await writeMenuToSupabase(nextMenu);
    } catch (error) {
      console.error('Unable to write menu data to Supabase, falling back to file store.', error);
    }
  }

  await ensureMenuFile();
  const normalized = normalizeMenu(nextMenu);
  await fs.writeFile(menuJsonPath, JSON.stringify(normalized, null, 2), 'utf-8');
  return normalized;
}

export async function ensureAssetsDirectory() {
  await fs.mkdir(assetsDirectory, { recursive: true });
  return assetsDirectory;
}

export { DEFAULT_CATEGORIES };
