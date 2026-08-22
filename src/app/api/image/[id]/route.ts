import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { products, stores } from '@/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getImageSource(id: string): Promise<string | null | undefined> {
  if (id.startsWith('s')) {
    const storeId = id.slice(1);
    if (!UUID_RE.test(storeId)) return null;
    const [row] = await db
      .select({ settings: stores.settings })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    const settings = (row?.settings ?? {}) as Record<string, unknown>;
    return typeof settings.logo === 'string' ? settings.logo : null;
  }
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .select({ image: products.image })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return row?.image;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const source = await getImageSource(id);

    if (!source) {
      return new Response('Not found', { status: 404 });
    }

    if (!source.startsWith('data:')) {
      return Response.redirect(source, 302);
    }

    const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/.exec(source);
    if (!match) {
      return new Response('Unsupported media type', { status: 415 });
    }

    const bytes = Buffer.from(match[2], 'base64');
    return new Response(bytes, {
      headers: {
        'Content-Type': match[1],
        'Content-Length': String(bytes.length),
        'Cache-Control':
          'public, max-age=86400, stale-while-revalidate=2592000',
      },
    });
  } catch {
    return new Response('Internal error', { status: 500 });
  }
}
