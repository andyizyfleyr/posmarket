import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function imageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === 'string' && item.length > 0,
        );
      }
    } catch {
      // jsonb déjà désérialisé par le driver : rien à faire.
    }
  }
  return [];
}

function parseDataImage(value: string) {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(value);
  if (!match) return null;

  const mime = match[1] || 'application/octet-stream';
  if (!/^image\//i.test(mime)) return null;

  try {
    const buffer = match[2]
      ? Buffer.from(match[3], 'base64')
      : Buffer.from(decodeURIComponent(match[3]), 'utf8');
    if (buffer.length === 0) return null;
    return { mime, buffer };
  } catch {
    return null;
  }
}

/**
 * GET /api/products/[id]/image?i=0
 *
 * Sert l'image d'un produit sans l'inclure en base64 dans le HTML/RSC.
 * Public : les images produits sont déjà visibles sur la vitrine, et
 * l'optimiseur `next/image` les récupère sans cookie de session.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const [row] = await db
    .select({ image: products.image, images: products.images })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!row) {
    return new NextResponse('Not found', { status: 404 });
  }

  const list = imageList(row.images);
  const indexParam = request.nextUrl.searchParams.get('i');
  const index = indexParam === null ? null : Number(indexParam);

  let raw: string | null | undefined;
  if (index === null) {
    raw = row.image || list[0];
  } else if (Number.isInteger(index) && index >= 0) {
    raw = list[index] ?? (index === 0 ? row.image : undefined);
  }

  if (!raw) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (/^https?:\/\//i.test(raw)) {
    return NextResponse.redirect(new URL(raw, request.url));
  }

  if (raw.startsWith('/')) {
    return NextResponse.redirect(new URL(raw, request.url));
  }

  const parsed = parseDataImage(raw);
  if (!parsed) {
    return new NextResponse('Unsupported image', { status: 415 });
  }

  return new NextResponse(
    new Uint8Array(parsed.buffer.buffer, parsed.buffer.byteOffset, parsed.buffer.byteLength),
    {
      status: 200,
      headers: {
        'Content-Type': parsed.mime,
        'Cache-Control':
          'public, max-age=86400, stale-while-revalidate=604800',
      },
    },
  );
}
