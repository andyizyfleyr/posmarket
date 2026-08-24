import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let _client: S3Client | null = null;

function getClient(): S3Client | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return _client;
}

export function isR2Configured(): boolean {
  return !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    (process.env.R2_PUBLIC_URL || process.env.R2_BUCKET)
  );
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

/**
 * Uploads a data URI to Cloudflare R2 and returns its public URL.
 * Returns null when R2 is not configured or the source is not a data URI.
 */
export async function uploadDataUriToR2(
  dataUri: string,
  folder: string
): Promise<string | null> {
  const client = getClient();
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!client || !bucket || !publicUrl) return null;

  const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/.exec(dataUri);
  if (!match) return null;

  const ext = EXT_BY_MIME[match[1]] || 'bin';
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0) return null;

  const key = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: match[1],
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
  return `${publicUrl.replace(/\/$/, '')}/${key}`;
}
