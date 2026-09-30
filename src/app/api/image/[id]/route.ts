import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { products, stores } from '@/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// L'optimiseur d'images de Next ne suit pas la redirection d'une source
// locale : il renvoie 400 « the requested resource isn't a valid image » et le
// logo se voit cassé. On sert donc les octets nous-memes, mais uniquement pour
// les hotes qu'on controle, ce qui evite d'exposer le serveur a des URL
// arbitraires choisies par un vendeur. Ces hotes sont les memes que
// `images.remotePatterns` de next.config.ts.
const PROXY_HOSTS = new Set([
  'pub-18d489375e4146f48984e82e8f24581f.r2.dev',
  'updrjzaapvbtjdnpicra.supabase.co',
  'images.unsplash.com',
]);

export const revalidate = 86400;

function isProxyable(source: string): boolean {
  try {
    return PROXY_HOSTS.has(new URL(source).hostname);
  } catch {
    return false;
  }
}

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
    return typeof settings.logo === 'string' && settings.logo.trim()
      ? settings.logo
      : null;
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
      if (isProxyable(source)) {
        const upstream = await fetch(source, { cache: 'force-cache' });
        if (upstream.ok && upstream.body) {
          return new Response(upstream.body, {
            headers: {
              'Content-Type':
                upstream.headers.get('content-type') ?? 'application/octet-stream',
              'Cache-Control':
                'public, max-age=86400, stale-while-revalidate=2592000',
            },
          });
        }
        return new Response('Upstream error', { status: 502 });
      }
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
