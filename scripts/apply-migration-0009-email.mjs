import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const steps = [
  { label: 'ADD notification_outbox.recipient_email', stmt: `ALTER TABLE "notification_outbox" ADD COLUMN IF NOT EXISTS "recipient_email" text` },
  { label: 'ADD notification_preferences.email', stmt: `ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "email" text` },
  { label: 'CREATE index notification_outbox_status_provider_idx', stmt: `CREATE INDEX IF NOT EXISTS "notification_outbox_status_provider_idx" ON "notification_outbox" ("status", "provider")` },
  { label: 'ALTER notification_outbox.recipient_phone SET DEFAULT empty', stmt: `ALTER TABLE "notification_outbox" ALTER COLUMN "recipient_phone" SET DEFAULT ''` },
  { label: 'ALTER notification_preferences.phone SET DEFAULT empty', stmt: `ALTER TABLE "notification_preferences" ALTER COLUMN "phone" SET DEFAULT ''` },
];

console.log(`Applying ${steps.length} steps to Neon...\n`);

for (const { label, stmt } of steps) {
  console.log('▶', label);
  try {
    await sql([stmt]);
    console.log('  ✅ OK\n');
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.includes('already exists') || msg.includes('does not exist')) {
      console.log('  ⚠️ Skipped:', msg.split('\n')[0], '\n');
    } else {
      console.error('  ❌ ERROR:', msg, '\n');
      process.exit(1);
    }
  }
}

const [emailCol] = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'notification_preferences' AND column_name = 'email'
`;
console.log('notification_preferences.email:', emailCol ? '✅' : '❌ MISSING');

const [recEmailCol] = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'notification_outbox' AND column_name = 'recipient_email'
`;
console.log('notification_outbox.recipient_email:', recEmailCol ? '✅' : '❌ MISSING');

console.log('\n✅ Migration email appliquée.');