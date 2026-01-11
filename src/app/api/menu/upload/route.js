import { NextResponse } from 'next/server';
import path from 'path';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { ensureAssetsDirectory } from '@/data/menuStore';
import { getSupabaseAdminClient } from '@/lib/supabaseServer';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const supabase = getSupabaseAdminClient();
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'menu-assets';

export async function POST(request) {
  try {
    const adminCookie = request.cookies.get('adminAuth');
    if (adminCookie?.value !== '1') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File is required.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer.byteLength) {
      return NextResponse.json({ error: 'File is empty.' }, { status: 400 });
    }

    const originalName = file.name || 'upload';
    const ext = path.extname(originalName).toLowerCase() || '.png';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
    }

    const safeName = `menu-${Date.now()}-${randomUUID()}${ext}`;

    if (supabase) {
      const pathKey = `uploads/${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(pathKey, Buffer.from(arrayBuffer), {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        });
      if (uploadError) {
        console.error('Unable to upload image to Supabase storage', uploadError);
        return NextResponse.json({ error: uploadError.message || 'Failed to upload image.' }, { status: 500 });
      }
      const { data: publicData } = supabase.storage.from(storageBucket).getPublicUrl(pathKey);
      return NextResponse.json({ url: publicData.publicUrl });
    }

    const assetsDir = await ensureAssetsDirectory();
    const outputPath = path.join(assetsDir, safeName);
    await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
    return NextResponse.json({ url: `/assets/${safeName}` });
  } catch (error) {
    console.error('Unable to upload image', error);
    return NextResponse.json({ error: 'Failed to upload image.' }, { status: 500 });
  }
}
