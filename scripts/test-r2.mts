import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// PNG 1x1 rouge
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const key = `test/${Date.now()}-pixel.png`;
await s3.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET,
  Key: key,
  Body: png,
  ContentType: 'image/png',
  CacheControl: 'public, max-age=31536000, immutable',
}));
console.log('UPLOAD OK:', key);

const url = `${process.env.R2_PUBLIC_URL}/${key}`;
const res = await fetch(url);
console.log('LECTURE PUBLIQUE:', res.status, res.headers.get('content-type'), `${png.length}o`);
if (res.status === 200) console.log('R2 FULLY OPERATIONAL ✓');
else {
  console.log('body:', await res.text());
  process.exit(1);
}
