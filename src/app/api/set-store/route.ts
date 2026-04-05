import { NextRequest, NextResponse } from 'next/server';
import { setStoreCookie } from '@/utils/store-cookie';

export async function POST(req: NextRequest) {
  try {
    const { storeId } = await req.json();
    if (storeId) {
      await setStoreCookie(storeId);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
