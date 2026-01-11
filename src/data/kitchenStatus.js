import { promises as fs } from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';

const dataDirectory = path.join(process.cwd(), 'data');
const statusFilePath = path.join(dataDirectory, 'kitchen-status.json');
const STATUS_KEY = 'kitchen:status';
const defaultStatus = {
  isOpen: true,
  message: 'We will be back shortly.',
};

const kvAvailable = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

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

export async function getKitchenStatus() {
  if (kvAvailable) {
    try {
      const stored = await kv.get(STATUS_KEY);
      if (stored) {
        return normalizeStatus(stored);
      }
    } catch (error) {
      console.error('Unable to read kitchen status from KV', error);
    }
  }
  return readStatusFromFile();
}

export async function setKitchenStatus({ isOpen, message }) {
  const nextStatus = normalizeStatus({ isOpen, message });

  if (kvAvailable) {
    try {
      await kv.set(STATUS_KEY, nextStatus);
      return nextStatus;
    } catch (error) {
      console.error('Unable to write kitchen status to KV', error);
    }
  }

  await writeStatusToFile(nextStatus);
  return nextStatus;
}
