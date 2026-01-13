import { promises as fs } from 'fs';
import path from 'path';
import { getSupabaseAdminClient } from '@/lib/supabaseServer';

const dataDirectory = path.join(process.cwd(), 'data');
const statusFilePath = path.join(dataDirectory, 'kitchen-status.json');
const KITCHEN_TABLE = 'kitchen_status';
const STATUS_ID = 'default'; // Single row for kitchen status

const defaultStatus = {
  isOpen: true,
  message: 'We will be back shortly.',
};

const supabase = getSupabaseAdminClient();
const supabaseEnabled = Boolean(supabase);

async function ensureStatusFile() {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    await fs.access(statusFilePath);
  } catch {
    await fs.writeFile(statusFilePath, JSON.stringify(defaultStatus, null, 2), 'utf-8');
  }
}

function normalizeStatus(status = {}) {
  return {
    ...defaultStatus,
    ...status,
    isOpen: typeof status?.isOpen === 'boolean' ? status.isOpen : defaultStatus.isOpen,
    message: status?.message || defaultStatus.message,
  };
}

async function readStatusFromFile() {
  await ensureStatusFile();
  try {
    const raw = await fs.readFile(statusFilePath, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    return normalizeStatus(parsed);
  } catch (error) {
    console.error('Unable to read kitchen status from file', error);
    return { ...defaultStatus };
  }
}

async function writeStatusToFile(status) {
  await ensureStatusFile();
  await fs.writeFile(statusFilePath, JSON.stringify(status, null, 2), 'utf-8');
}

async function readStatusFromSupabase() {
  if (!supabaseEnabled) {
    return null;
  }
  try {
    const { data, error } = await supabase
      .from(KITCHEN_TABLE)
      .select('*')
      .eq('id', STATUS_ID)
      .maybeSingle();

    if (error) {
      console.error('Unable to read kitchen status from Supabase:', error.message);
      return null;
    }

    if (data) {
      return normalizeStatus({
        isOpen: data.is_open,
        message: data.message,
      });
    }
  } catch (error) {
    console.error('Unable to fetch kitchen status from Supabase:', error);
  }
  return null;
}

async function writeStatusToSupabase(status) {
  if (!supabaseEnabled) {
    console.warn('Supabase not enabled, kitchen status not persisted');
    return false;
  }
  try {
    const { error } = await supabase
      .from(KITCHEN_TABLE)
      .upsert(
        {
          id: STATUS_ID,
          is_open: status.isOpen,
          message: status.message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.error('Unable to write kitchen status to Supabase:', error.message);
      return false;
    }
    console.log('Kitchen status persisted to Supabase');
    return true;
  } catch (error) {
    console.error('Unable to persist kitchen status to Supabase:', error);
    return false;
  }
}

export async function getKitchenStatus() {
  // Try Supabase first
  if (supabaseEnabled) {
    const status = await readStatusFromSupabase();
    if (status) {
      return status;
    }
  }
  // Fallback to file
  return readStatusFromFile();
}

export async function setKitchenStatus({ isOpen, message }) {
  const nextStatus = normalizeStatus({ isOpen, message });

  // Try Supabase first
  if (supabaseEnabled) {
    const success = await writeStatusToSupabase(nextStatus);
    if (success) {
      return nextStatus;
    }
  }

  // Fallback to file
  await writeStatusToFile(nextStatus);
  return nextStatus;
}
