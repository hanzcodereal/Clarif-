import { NextRequest, NextResponse } from 'next/server';
import { upscale, type WinkMode } from '@/lib/wink';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('image') as File | null;
    const mode = (form.get('mode') as string) || 'uhd ai';
    const keepSize = form.get('keepSize') === 'true';

    if (!file) {
      return NextResponse.json({ success: false, error: 'File tidak ada' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await upscale(buffer, mode as WinkMode, { keepSize, fixRatio: true });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
        }
