#!/usr/bin/env node
import 'dotenv/config';
import { access, readFile } from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const DEFAULT_JSON_PATH = path.join(projectRoot, 'data', 'menu.json');
const DEFAULT_YAML_PATH = path.join(projectRoot, 'public', 'menu.yaml');
const MENU_ROW_ID = 'active-menu';

async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveSourcePath(inputPath) {
  if (!inputPath) {
    return DEFAULT_JSON_PATH;
  }
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.join(projectRoot, inputPath);
}

async function pickDefaultSourcePath() {
  if (await fileExists(DEFAULT_JSON_PATH)) {
    return DEFAULT_JSON_PATH;
  }
  if (await fileExists(DEFAULT_YAML_PATH)) {
    return DEFAULT_YAML_PATH;
  }
  throw new Error('No menu seed file found. Add data/menu.json or public/menu.yaml.');
}

async function loadMenuPayload(sourcePath) {
  const raw = await readFile(sourcePath, 'utf-8');
  if (sourcePath.endsWith('.yaml') || sourcePath.endsWith('.yml')) {
    return yaml.load(raw) || {};
  }
  return JSON.parse(raw || '{}');
}

async function main() {
  const sourceArg = process.argv[2];
  const sourcePath = sourceArg ? resolveSourcePath(sourceArg) : await pickDefaultSourcePath();
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }

  const payload = await loadMenuPayload(sourcePath);

  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        'X-Client-Info': 'rajskitchen-menu-sync',
      },
    },
  });

  const { error } = await client
    .from('menus')
    .upsert({ id: MENU_ROW_ID, payload })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  console.log(`Menu synced to Supabase from ${path.relative(projectRoot, sourcePath)}.`);
}

main().catch((error) => {
  console.error('Failed to sync menu:', error.message || error);
  process.exit(1);
});
