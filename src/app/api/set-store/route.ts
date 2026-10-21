import { NextRequest, NextResponse } from 'next/server';
import { setStoreCookie } from '@/utils/store-cookie';
import { parseBody } from '@/lib/validation';
import { sellerStoreIdSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, sellerStoreIdSchema);
    if (!parsed.ok) return parsed.response;
    await setStoreCookie(parsed.data.storeId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
