import { promises as fs } from 'fs';
import path from 'path';

const dataDirectory = path.join(process.cwd(), 'data');
const statusFilePath = path.join(dataDirectory, 'kitchen-status.json');
const defaultStatus = {
  isOpen: true,
  message: 'We will be back shortly.',
};

async function ensureStatusFile() {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    await fs.access(statusFilePath);
  } catch {
    await fs.writeFile(statusFilePath, JSON.stringify(defaultStatus, null, 2), 'utf-8');
  }
}

export async function getKitchenStatus() {
  await ensureStatusFile();
  try {
    const raw = await fs.readFile(statusFilePath, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    return {
      ...defaultStatus,
      ...parsed,
      isOpen: typeof parsed?.isOpen === 'boolean' ? parsed.isOpen : defaultStatus.isOpen,
      message: parsed?.message || defaultStatus.message,
    };
  } catch (error) {
    console.error('Unable to read kitchen status', error);
    return { ...defaultStatus };
  }
}

export async function setKitchenStatus({ isOpen, message }) {
  await ensureStatusFile();
  const nextStatus = {
    isOpen: Boolean(isOpen),
    message: message || defaultStatus.message,
  };
  await fs.writeFile(statusFilePath, JSON.stringify(nextStatus, null, 2), 'utf-8');
  return nextStatus;
}
